import uuid
import base64

from fastapi import HTTPException, status
from supabase import Client as SupabaseClient
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.models import Group, Item, Receipt, GroupMember, ItemClaim
from app.services.ocr_service import OCRService


class UserService:
    def __init__(self, db: DBSession, supabase: SupabaseClient) -> None:
        self.db = db
        self.supabse = supabase

    def _is_host(self, host_user_id: str, group_id: str) -> bool:
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(
                status_codes=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        return str(group.created_by) == host_user_id

    def _is_host_of_item(self, host_user_id: str, item_id: str) -> bool:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(
                status_codes=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )
        return self._is_host(host_user_id, item.group_id)

    def create_group(self, user_id: str, name: str) -> str:
        group = Group(created_by=user_id, name=name)
        self.db.add(group)
        self.db.flush()  # Flush to get the generated group.id before committing

        member = GroupMember(user_id=user_id, group_id=group.id)
        self.db.add(member)
        self.db.commit()

        return str(group.id)

    def join_group(self, user_id: str, group_id: str) -> None:
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # NOTE: If user already a member, db should ignore this request natively
        stmt = (
            insert(GroupMember)
            .values(user_id=user_id, group_id=group_id)
            .on_conflict_do_nothing(index_elements=["user_id", "group_id"])
        )
        self.db.execute(stmt)
        self.db.commit()

    def leave_group(self, user_id: str, group_id: str) -> None:
        # NOTE: host can't leave group
        if self._is_host(user_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Host cannot leave the group",
            )

        member = self.db.get(GroupMember, {"user_id": user_id, "group_id": group_id})
        if member is not None:
            self.db.delete(member)
            self.db.commit()

    def get_all_groups(self, user_id: str) -> list[Group]:
        stmt = (
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(GroupMember.user_id == user_id)
        )

        return self.db.execute(stmt).scalars().all()

    def remove_member(
        self, host_user_id: str, group_id: str, member_user_id: str
    ) -> None:
        if not self._is_host(host_user_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the host can remove members",
            )

        # NOTE: host can't remove themselves
        if host_user_id == member_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Host cannot remove themselves from the group",
            )

        member = self.db.get(
            GroupMember, {"user_id": member_user_id, "group_id": group_id}
        )
        if member is not None:
            self.db.delete(member)

        # NOTE: db auto handels unclaiming items, have to expire everything in session
        self.db.expire_all()

    def add_receipt(
        self,
        user_id: str,
        group_id: str,
        ocr_service: OCRService,
        image_bytes: bytes,
        image_ext: str,
    ) -> None:
        member = self.db.get(GroupMember, {"user_id": user_id, "group_id": group_id})
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="User is not in group"
            )

        file_path = f"{group_id}/{uuid.uuid4()}.{image_ext}"

        try:
            response = self.supabse.storage.from_(settings.receipt_image_bucket).upload(
                file=image_bytes, path=file_path
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image: {str(e)}",
            )

        image_url = self.supabse.storage.from_(
            settings.receipt_image_bucket
        ).get_public_url(file_path)

        extracted_items = ocr_service.extract_items(
            base64.b64encode(image_bytes).decode()
        )
        total_price = 0.0
        receipt_id = uuid.uuid4()
        for extracted_item in extracted_items:
            for _ in range(extracted_item.quantity):
                item = Item(
                    receipt_id=receipt_id,
                    name=extracted_item.name,
                    unit_price=float(extracted_item.price.replace("$", "")),
                    amount=1,
                )
                self.db.add(item)

        receipt = Receipt(
            id=receipt_id, image=image_url, total=total_price, created_by=user_id
        )
        self.db.add(receipt)

        self.db.commit()

    def remove_receipt(self, user_id: str, receipt_id: str) -> None:
        receipt = self.db.get(Receipt, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found"
            )

        if str(receipt.created_by) != user_id and not self._is_host_of_item(
            user_id, receipt_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the receipt owner or group host can remove receipts",
            )

        self.db.delete(receipt)
        self.db.commit()

    def get_items_in_group(self, user_id: str, group_id: str) -> list[Item]:
        member = self.db.get(GroupMember, {"user_id": user_id, "group_id": group_id})
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this group",
            )

        stmt = select(Item).where(Item.group_id == group_id)

        return self.db.execute(stmt).scalars().all()

    def get_receipts_in_group(self, user_id: str, group_id: str) -> list[Receipt]:
        member = self.db.get(GroupMember, {"user_id": user_id, "group_id": group_id})
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this group",
            )

        stmt = select(Receipt).where(Receipt.group_id == group_id)

        return self.db.execute(stmt).scalars().all()

    def claim_item(self, user_id: str, item_id: str) -> None:
        item = self.db.get(Item, item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
            )

        member = self.db.get(
            GroupMember, {"user_id": user_id, "group_id": item.group_id}
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User can't claim an item outside of their group",
            )

        claim_portion = 1
        stmt = (
            insert(ItemClaim)
            .values(item_id=item_id, user_id=user_id, share=claim_portion)
            .on_conflict_do_nothing()
        )
        self.db.execute(stmt)
        self.db.commit()

    def unclaim_item(self, user_id: str, item_id: str) -> None:
        claim = self.db.get(ItemClaim, {"user_id": user_id, "item_id": item_id})
        if claim is None:
            return

        self.db.delete(claim)
        self.db.commit()

    def assign_item(self, host_user_id: str, guest_user_id: str, item_id: str) -> None:
        if not self._is_host_of_item(host_user_id, item_id):
            raise HTTPException(
                status_codes=status.HTTP_403_FORBIDDEN,
                detail="Only host can assign items",
            )

        self.claim_item(guest_user_id, item_id)

    def unassign_item(
        self, host_user_id: str, guest_user_id: str, item_id: str
    ) -> None:
        if not self._is_host_of_item(host_user_id, item_id):
            raise HTTPException(
                status_codes=status.HTTP_403_FORBIDDEN,
                detail="Only host can unassign items",
            )

        self.unclaim_item(guest_user_id, item_id)
