import uuid
from typing import Optional

from fastapi import HTTPException, status
from supabase import Client as SupabaseClient
from sqlalchemy import case, select, func
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.models import Group, Item, Receipt, GroupMember, ItemClaim, PaymentDebt
from app.models.profile import Profile
from app.services.ocr_service import OCRService
from app.services.receipt_parser.types import ReceiptConfidence


class UserService:
    def __init__(self, db: DBSession, supabase: SupabaseClient) -> None:
        self.db = db
        self.supabse = supabase

    def _is_host(self, host_profile_id: str, group_id: str) -> bool:
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        return str(group.created_by) == host_profile_id

    def _is_host_of_item(self, host_profile_id: str, item_id: str) -> bool:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )
        return self._is_host(host_profile_id, item.group_id)

    def _is_host_of_receipt(self, host_profile_id: str, receipt_id: str) -> bool:
        recepit = self.db.get(Receipt, receipt_id)
        if recepit is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )
        return self._is_host(host_profile_id, recepit.group_id)

    def _assert_group_mutable(self, profile_id: str, group: Optional[Group]) -> None:
        """Raise 403 if the group is finished and the caller is not the host."""
        if (
            group is not None
            and group.is_finished
            and str(group.created_by) != profile_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Room is completed. Only the host can make changes.",
            )

    def create_group(self, profile_id: str, name: str) -> Group:
        group = Group(created_by=profile_id, name=name)
        self.db.add(group)
        self.db.flush()  # Flush to get the generated group.id before committing

        member = GroupMember(profile_id=profile_id, group_id=group.id)
        self.db.add(member)
        self.db.commit()

        return group

    def join_group(self, profile_id: str, group_id: str) -> None:
        group = self.db.get(Group, group_id)
        # TODO: check invite link
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # NOTE: If user already a member, db should ignore this request natively
        stmt = (
            insert(GroupMember)
            .values(profile_id=profile_id, group_id=group_id)
            .on_conflict_do_nothing(index_elements=["profile_id", "group_id"])
        )
        self.db.execute(stmt)
        self.db.commit()

    def leave_group(self, profile_id: str, group_id: str) -> None:
        # NOTE: host can't leave group
        if self._is_host(profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Host cannot leave the group",
            )

        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is not None:
            self.db.delete(member)
            self.db.commit()

    def remove_guest_member(
        self, host_profile_id: str, group_id: str, target_profile_id: str
    ) -> None:
        if not self._is_host(host_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can remove participants",
            )
        target = self.db.get(Profile, target_profile_id)
        if target is None or target.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only remove guest participants",
            )
        member = self.db.get(
            GroupMember, {"profile_id": target_profile_id, "group_id": group_id}
        )
        if member is not None:
            self.db.delete(member)
            self.db.commit()

    def get_all_groups(self, profile_id: str) -> list[Group]:
        stmt = (
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(GroupMember.profile_id == profile_id)
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_group_debts(self, caller_id: str, group_id: str) -> list[PaymentDebt]:
        """Return all payment_debts rows for a group (caller must be a member)."""
        member = self.db.get(
            GroupMember, {"profile_id": caller_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        stmt = select(PaymentDebt).where(PaymentDebt.group_id == group_id)
        return list(self.db.execute(stmt).scalars().all())

    def update_debt_status(
        self,
        caller_profile_id: str,
        group_id: str,
        debtor_id: str,
        creditor_id: str,
        new_status: str,
    ) -> None:
        """Update the paid_status for a specific (debtor, creditor) debt within a group.

        Rules:
        - 'pending'     : only the debtor may self-report payment.
        - 'requested'   : the creditor may request payment; the debtor may also
                          set this to undo their own 'pending' self-report.
        - 'verified' / 'unrequested' : only the creditor may set these.
        """
        _VALID = {"verified", "pending", "requested", "unrequested"}
        if new_status not in _VALID:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"paid_status must be one of: {', '.join(sorted(_VALID))}",
            )

        if new_status == "pending":
            if caller_profile_id != debtor_id:
                # Allow the creditor to mark a guest debtor as pending, since
                # guests cannot log in to self-report payment.
                debtor_profile = self.db.get(Profile, debtor_id)
                is_guest_debtor = (
                    debtor_profile is not None and not debtor_profile.email
                )
                if not is_guest_debtor or caller_profile_id != creditor_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Only the debtor can self-report payment",
                    )
        elif new_status == "requested":
            # The creditor can request payment, and the debtor can undo their
            # self-reported 'pending' status by reverting back to 'requested'.
            if caller_profile_id != creditor_id and caller_profile_id != debtor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the creditor or debtor can set this status",
                )
        else:
            # verified / unrequested — only the creditor
            if caller_profile_id != creditor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the creditor can verify or unrequest payment",
                )

        # Verify both parties are members of the group
        for pid in (debtor_id, creditor_id):
            m = self.db.get(GroupMember, {"profile_id": pid, "group_id": group_id})
            if m is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Profile {pid} is not a member of this group",
                )

        stmt = (
            insert(PaymentDebt)
            .values(
                group_id=group_id,
                debtor_id=debtor_id,
                creditor_id=creditor_id,
                paid_status=new_status,
            )
            .on_conflict_do_update(
                index_elements=["group_id", "debtor_id", "creditor_id"],
                set_={"paid_status": new_status, "updated_at": func.now()},
            )
        )
        self.db.execute(stmt)
        self.db.commit()

    def delete_item(self, profile_id: str, item_id: str) -> None:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": str(item.group_id)}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        # If the item belongs to a receipt, only the receipt owner or group host may delete it.
        if item.receipt_id is not None:
            receipt = self.db.get(Receipt, str(item.receipt_id))
            if (
                receipt is not None
                and str(receipt.created_by) != profile_id
                and not self._is_host(profile_id, str(item.group_id))
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the receipt owner or group host can delete items from this receipt",
                )
        group = self.db.get(Group, str(item.group_id))
        self._assert_group_mutable(profile_id, group)
        self.db.delete(item)
        self.db.commit()

    def update_item(
        self,
        profile_id: str,
        item_id: str,
        name: Optional[str] = None,
        unit_price: Optional[float] = None,
    ) -> None:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": str(item.group_id)}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        group = self.db.get(Group, str(item.group_id))
        self._assert_group_mutable(profile_id, group)
        if name is not None:
            item.name = name
        if unit_price is not None:
            item.unit_price = unit_price
        self.db.commit()

    def delete_group(self, profile_id: str, group_id: str) -> None:
        if not self._is_host(profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can delete the group",
            )
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        self.db.delete(group)
        self.db.commit()

    def update_group_name(self, profile_id: str, group_id: str, name: str) -> None:
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        group.name = name
        self.db.commit()

    def finish_group(self, profile_id: str, group_id: str) -> None:
        """Mark a group as finished (host only)."""
        if not self._is_host(profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can finish the group",
            )
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )
        group.is_finished = True
        self.db.commit()

    def get_groups_summary(self, profile_id: str):
        """Return one row per group the user belongs to:
        group id, name, member count, total claimed amount, the user's aggregate
        paid_status (derived from payment_debts), whether the room is finished,
        and whether all outstanding payments in the group are settled.
        """
        # Subquery: member count per group
        member_count_sq = (
            select(
                GroupMember.group_id,
                func.count(GroupMember.profile_id).label("member_count"),
            )
            .group_by(GroupMember.group_id)
            .subquery()
        )

        # Subquery: sum of items claimed by this user per group
        claimed_sum_sq = (
            select(
                Item.group_id,
                func.coalesce(func.sum(Item.unit_price * ItemClaim.share), 0.0).label(
                    "total_claimed"
                ),
            )
            .join(ItemClaim, ItemClaim.item_id == Item.id)
            .where(ItemClaim.profile_id == profile_id)
            .group_by(Item.group_id)
            .subquery()
        )

        # Subquery: sum of items from receipts uploaded by this user per group
        uploaded_sum_sq = (
            select(
                Receipt.group_id,
                func.coalesce(func.sum(Item.unit_price * Item.amount), 0.0).label(
                    "total_uploaded"
                ),
            )
            .join(Item, Item.receipt_id == Receipt.id)
            .where(Receipt.created_by == profile_id)
            .group_by(Receipt.group_id)
            .subquery()
        )

        # Subquery: count distinct debtors with at least one unverified debt per group
        outstanding_sq = (
            select(
                PaymentDebt.group_id,
                func.count(func.distinct(PaymentDebt.debtor_id)).label(
                    "outstanding_count"
                ),
            )
            .where(PaymentDebt.paid_status != "verified")
            .group_by(PaymentDebt.group_id)
            .subquery()
        )

        # Subquery: this user's aggregate paid_status across all their debts per group.
        # Worst-status wins: unrequested(4) > requested(3) > pending(2) > verified(1).
        # No debt rows → NULL max_priority → coalesces to 'verified' (nothing owed).
        _priority = case(
            (PaymentDebt.paid_status == "unrequested", 4),
            (PaymentDebt.paid_status == "requested", 3),
            (PaymentDebt.paid_status == "pending", 2),
            else_=1,
        )
        user_debt_sq = (
            select(PaymentDebt.group_id, func.max(_priority).label("max_priority"))
            .where(PaymentDebt.debtor_id == profile_id)
            .group_by(PaymentDebt.group_id)
            .subquery()
        )

        paid_status_expr = func.coalesce(
            case(
                (user_debt_sq.c.max_priority == 4, "unrequested"),
                (user_debt_sq.c.max_priority == 3, "requested"),
                (user_debt_sq.c.max_priority == 2, "pending"),
                else_="verified",
            ),
            "verified",
        ).label("paid_status")

        stmt = (
            select(
                Group.id,
                Group.name,
                member_count_sq.c.member_count,
                func.coalesce(claimed_sum_sq.c.total_claimed, 0.0).label(
                    "total_claimed"
                ),
                func.coalesce(uploaded_sum_sq.c.total_uploaded, 0.0).label(
                    "total_uploaded"
                ),
                paid_status_expr,
                Group.is_finished,
                func.coalesce(outstanding_sq.c.outstanding_count, 0).label(
                    "outstanding_count"
                ),
            )
            .join(GroupMember, GroupMember.group_id == Group.id)
            .join(member_count_sq, member_count_sq.c.group_id == Group.id)
            .outerjoin(claimed_sum_sq, claimed_sum_sq.c.group_id == Group.id)
            .outerjoin(uploaded_sum_sq, uploaded_sum_sq.c.group_id == Group.id)
            .outerjoin(outstanding_sq, outstanding_sq.c.group_id == Group.id)
            .outerjoin(user_debt_sq, user_debt_sq.c.group_id == Group.id)
            .where(GroupMember.profile_id == profile_id)
            .order_by(Group.id)
        )

        return self.db.execute(stmt).all()

    def remove_member(
        self, host_profile_id: str, group_id: str, member_profile_id: str
    ) -> None:
        if not self._is_host(host_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can remove members",
            )

        # NOTE: host can't remove themselves
        if host_profile_id == member_profile_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Host cannot remove themselves from the group",
            )

        member = self.db.get(
            GroupMember, {"profile_id": member_profile_id, "group_id": group_id}
        )
        if member is not None:
            self.db.delete(member)

        # NOTE: db auto handels unclaiming items, have to expire everything in session
        self.db.expire_all()

    async def add_receipt(
        self, profile_id: str, group_id: str, image_bytes: bytes, image_ext: str
    ) -> tuple[
        uuid.UUID, Optional[float], Optional[float], Optional[ReceiptConfidence]
    ]:
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="User is not in group"
            )
        group = self.db.get(Group, group_id)
        self._assert_group_mutable(profile_id, group)

        file_path = f"{group_id}/{uuid.uuid4()}.{image_ext}"

        try:
            _ = self.supabse.storage.from_(settings.receipt_image_bucket).upload(
                file=image_bytes,
                path=file_path,
                file_options={"content-type": f"image/{image_ext}"},
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image: {str(e)}",
            )

        image_url = self.supabse.storage.from_(
            settings.receipt_image_bucket
        ).get_public_url(file_path)

        ocr = OCRService()
        try:
            cleaned_items, parsed = await ocr.extract_items(image_bytes)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OCR failed: {str(e)}",
            )

        total_price = parsed.calculated_subtotal
        tax = parsed.ocr_tax
        receipt_id = uuid.uuid4()
        for cleaned_item in cleaned_items:
            item = Item(
                receipt_id=receipt_id,
                group_id=group_id,
                name=cleaned_item.name,
                unit_price=cleaned_item.unit_price,
                amount=1,
            )
            self.db.add(item)

        receipt = Receipt(
            id=receipt_id,
            group_id=group_id,
            image=image_url,
            is_manual=False,
            total=total_price,
            tax=tax,
            created_by=profile_id,
        )
        self.db.add(receipt)

        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save receipt: {str(e)}",
            )

        return receipt_id, tax, parsed.ocr_total, parsed.confidence

    def remove_receipt(self, profile_id: str, receipt_id: str) -> None:
        receipt = self.db.get(Receipt, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found"
            )

        if str(receipt.created_by) != profile_id and not self._is_host_of_receipt(
            profile_id, receipt_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the receipt owner or group host can remove receipts",
            )

        group = self.db.get(Group, str(receipt.group_id))
        self._assert_group_mutable(profile_id, group)

        # Explicitly delete associated items so Supabase realtime propagates
        # the DELETE events for each item (cascade deletes aren't always broadcast).
        items = (
            self.db.execute(select(Item).where(Item.receipt_id == receipt.id))
            .scalars()
            .all()
        )
        for item in items:
            self.db.delete(item)

        self.db.delete(receipt)
        self.db.commit()

    def get_items_in_group(self, profile_id: str, group_id: str) -> list[Item]:
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this group",
            )

        stmt = select(Item).where(Item.group_id == group_id)

        return self.db.execute(stmt).scalars().all()

    def get_receipts_in_group(self, profile_id: str, group_id: str) -> list[Receipt]:
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this group",
            )

        stmt = select(Receipt).where(Receipt.group_id == group_id)

        return self.db.execute(stmt).scalars().all()

    def claim_item(
        self,
        profile_id: str,
        item_id: str,
        authorizing_profile_id: Optional[str] = None,
    ) -> None:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )

        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": item.group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User can't claim an item outside of their group",
            )

        group = self.db.get(Group, str(item.group_id))
        self._assert_group_mutable(authorizing_profile_id or profile_id, group)

        claim_portion = 1
        stmt = (
            insert(ItemClaim)
            .values(item_id=item_id, profile_id=profile_id, share=claim_portion)
            .on_conflict_do_nothing()
        )
        self.db.execute(stmt)
        self.db.commit()

    def unclaim_item(
        self,
        profile_id: str,
        item_id: str,
        authorizing_profile_id: Optional[str] = None,
    ) -> None:
        item = self.db.get(Item, item_id)
        if item is not None:
            group = self.db.get(Group, str(item.group_id))
            self._assert_group_mutable(authorizing_profile_id or profile_id, group)

        claim = self.db.get(ItemClaim, {"profile_id": profile_id, "item_id": item_id})
        if claim is None:
            return

        self.db.delete(claim)
        self.db.commit()

    def assign_item(
        self, host_profile_id: str, guest_profile_id: str, item_id: str
    ) -> None:
        if (
            not self._is_host_of_item(host_profile_id, item_id)
            and host_profile_id != guest_profile_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only host can assign items",
            )

        self.claim_item(
            guest_profile_id, item_id, authorizing_profile_id=host_profile_id
        )

    def assign_items(
        self, host_profile_id: str, guest_profile_id: str, item_ids: list[str]
    ) -> None:
        for item_id in item_ids:
            self.assign_item(host_profile_id, guest_profile_id, item_id)

    def unassign_item(
        self, host_profile_id: str, guest_profile_id: str, item_id: str
    ) -> None:
        if (
            not self._is_host_of_item(host_profile_id, item_id)
            and host_profile_id != guest_profile_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only host can unassign items",
            )

        self.unclaim_item(
            guest_profile_id, item_id, authorizing_profile_id=host_profile_id
        )

    def unassign_items(
        self, host_profile_id: str, guest_profile_id: str, item_ids: list[str]
    ) -> None:
        for item_id in item_ids:
            self.unassign_item(host_profile_id, guest_profile_id, item_id)

    def add_item(
        self,
        profile_id: str,
        group_id: str,
        receipt_id: Optional[str] = None,
        name: str = "",
        unit_price: float = 0.0,
    ) -> uuid.UUID:
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        group = self.db.get(Group, group_id)
        self._assert_group_mutable(profile_id, group)
        item = Item(
            group_id=group_id,
            receipt_id=receipt_id,
            name=name,
            unit_price=unit_price,
            amount=1,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item.id

    def create_manual_receipt(
        self, profile_id: str, group_id: str, tax: Optional[float] = None
    ) -> uuid.UUID:
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        group = self.db.get(Group, group_id)
        self._assert_group_mutable(profile_id, group)
        receipt = Receipt(
            group_id=group_id,
            image=None,
            is_manual=True,
            total=0.0,
            tax=tax,
            created_by=profile_id,
        )
        self.db.add(receipt)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt.id

    def update_receipt_tax(
        self, profile_id: str, receipt_id: str, tax: Optional[float]
    ) -> None:
        receipt = self.db.get(Receipt, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found"
            )
        member = self.db.get(
            GroupMember, {"profile_id": profile_id, "group_id": str(receipt.group_id)}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group",
            )
        receipt.tax = tax
        self.db.commit()

    def update_receipt_owner(
        self, profile_id: str, receipt_id: str, new_owner_profile_id: str
    ) -> None:
        receipt = self.db.get(Receipt, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found"
            )
        if str(receipt.created_by) != profile_id and not self._is_host_of_receipt(
            profile_id, receipt_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the receipt owner or group host can change receipt ownership",
            )
        # Verify the new owner is a member of the same group
        member = self.db.get(
            GroupMember,
            {"profile_id": new_owner_profile_id, "group_id": str(receipt.group_id)},
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="New owner must be a member of this group",
            )
        receipt.created_by = uuid.UUID(new_owner_profile_id)
        self.db.commit()
