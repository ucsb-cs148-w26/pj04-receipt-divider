import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models import Profile, Group, GroupMember, Item, ItemClaim, Receipt
from app.services.ocr_service import CleanedItem
from app.services.receipt_parser.types import DebugReceipt


def _make_user(
    db_session, name: str | None = None, email: str | None = None
) -> Profile:
    user = Profile(id=uuid.uuid4(), email=email or f"{uuid.uuid4()}@test.com")
    db_session.add(user)
    db_session.flush()
    return user


def _make_group(db_session, host: Profile, name: str = "Test group") -> Group:
    group = Group(created_by=host.id, name=name)
    db_session.add(group)
    db_session.flush()
    member = GroupMember(group_id=group.id, profile_id=host.id)
    db_session.add(member)
    db_session.flush()
    return group


def _add_item(
    db_session,
    group: Group,
    name: str,
    unit_price: float,
    receipt: Receipt | None = None,
) -> Item:
    group = Item(
        group_id=group.id,
        name=name,
        amount=1,
        unit_price=unit_price,
        receipt_id=receipt.id if receipt else None,
    )
    db_session.add(group)
    db_session.flush()
    return group


def _add_member(db_session, user: Profile, group: Group) -> GroupMember:
    member = GroupMember(profile_id=user.id, group_id=group.id)
    db_session.add(member)
    db_session.flush()
    return member


def _claim_item(db_session, user: Profile, item: Item, share: float = 1.0) -> ItemClaim:
    claim = ItemClaim(item_id=item.id, profile_id=user.id, share=share)
    db_session.add(claim)
    db_session.flush()
    return claim


def _mock_detect_receipt(items: list[tuple[str, float]]):
    """Return a context-manager that patches OCRService.extract_items.

    Each tuple is (name, final_price).
    """
    cleaned_items = [
        CleanedItem(name=name, original_name=name, unit_price=price, taxed=False)
        for name, price in items
    ]
    mock_receipt = DebugReceipt(
        lines=[],
        angle=0.0,
        detected_store=None,
        items=[],
        total_lines=0,
        total_items=len(cleaned_items),
        total_untaxed_items=len(cleaned_items),
        total_taxed_items=0,
        untaxed_items_value=sum(p for _, p in items),
        taxed_items_value=0.0,
        ocr_subtotal=None,
        ocr_tax=None,
        ocr_total=None,
        calculated_subtotal=sum(p for _, p in items),
        tax_rate=None,
        tax_rates=[],
        tender_amount=None,
        confidence=None,
    )
    return patch(
        "app.services.ocr_service.OCRService.extract_items",
        new=AsyncMock(return_value=(cleaned_items, mock_receipt)),
    )


def _setup_group_with_item(
    db_session,
    host_name: str = "Host user",
    item_name: str = "Burger",
    price: float = 9.99,
):
    host = _make_user(db_session, host_name)
    group = _make_group(db_session, host, "Group 1")
    item = _add_item(db_session, group, item_name, price)

    return host, group, item


def _configure_supabase(supabase, public_url="https://example.com/img.jpg"):
    supabase.storage.from_.return_value.upload.return_value = None
    supabase.storage.from_.return_value.get_public_url.return_value = public_url


class TestIsHost:
    def test_returns_true_when_user_created_the_group(self, user_service, db_session):
        user = _make_user(db_session)
        group_id = user_service.create_group(str(user.id), "My Group")

        assert user_service._is_host(str(user.id), group_id) is True

    def test_returns_false_for_a_different_user(self, user_service, db_session):
        host = _make_user(db_session)
        other = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "My Group")

        assert user_service._is_host(str(other.id), group_id) is False

    def test_raises_when_group_does_not_exist(self, user_service):
        non_existent_group_id = str(uuid.uuid4())

        with pytest.raises((HTTPException, TypeError)):
            user_service._is_host(str(uuid.uuid4()), non_existent_group_id)


class TestIsHostOfGroupByItem:
    def test_returns_true_when_user_is_host(self, user_service, db_session):
        host = _make_user(db_session)
        group = _make_group(db_session, host, "Group 1")
        item = _add_item(db_session, group, "Item 1", 0)

        assert user_service._is_host_of_item(str(host.id), str(item.id)) is True

    def test_returns_false_for_non_host(self, user_service, db_session):
        host = _make_user(db_session)
        member = _make_user(db_session)
        group = _make_group(db_session, host, "Group 1")
        item = _add_item(db_session, group, "Item 1", 0)
        _add_member(db_session, member, group)

        assert user_service._is_host_of_item(str(member.id), str(item.id)) is False


class TestCreateGroup:
    def test_creates_group_row_in_db(self, user_service, db_session):
        user = _make_user(db_session)

        group_id = user_service.create_group(str(user.id), "Team Lunch")

        group = db_session.get(Group, uuid.UUID(group_id))
        assert group is not None
        assert group.name == "Team Lunch"
        assert str(group.created_by) == str(user.id)

    def test_host_is_automatically_added_as_member(self, user_service, db_session):
        user = _make_user(db_session)

        group_id = user_service.create_group(str(user.id), "Team Lunch")

        member = db_session.get(
            GroupMember, {"profile_id": user.id, "group_id": uuid.UUID(group_id)}
        )
        assert member is not None

    def test_returns_a_valid_uuid_string(self, user_service, db_session):
        user = _make_user(db_session)

        group_id = user_service.create_group(str(user.id), "Team Lunch")

        # Should not raise
        uuid.UUID(group_id)


class TestJoinGroup:
    def test_user_can_join_an_existing_group(self, user_service, db_session):
        host = _make_user(db_session)
        joiner = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        user_service.join_group(str(joiner.id), group_id)

        member = db_session.get(
            GroupMember, {"profile_id": joiner.id, "group_id": uuid.UUID(group_id)}
        )
        assert member is not None

    def test_joining_twice_does_not_raise(self, user_service, db_session):
        host = _make_user(db_session)
        joiner = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        user_service.join_group(str(joiner.id), group_id)
        user_service.join_group(
            str(joiner.id), group_id
        )  # on_conflict_do_nothing — no error

        members = (
            db_session.execute(
                select(GroupMember).where(GroupMember.group_id == uuid.UUID(group_id))
            )
            .scalars()
            .all()
        )
        assert len(members) == 2

    def test_raises_404_for_nonexistent_group(self, user_service, db_session):
        user = _make_user(db_session)

        with pytest.raises(HTTPException) as exc:
            user_service.join_group(str(user.id), str(uuid.uuid4()))

        assert exc.value.status_code == 404


class TestLeaveGroup:
    def test_member_can_leave_group(self, user_service, db_session):
        host = _make_user(db_session)
        member = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")
        user_service.join_group(str(member.id), group_id)

        user_service.leave_group(str(member.id), group_id)

        row = db_session.get(
            GroupMember, {"profile_id": member.id, "group_id": uuid.UUID(group_id)}
        )
        assert row is None

    def test_host_cannot_leave_their_own_group(self, user_service, db_session):
        host = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        with pytest.raises(HTTPException) as exc:
            user_service.leave_group(str(host.id), group_id)

        assert exc.value.status_code == 400

    def test_leaving_a_group_you_never_joined_is_a_no_op(
        self, user_service, db_session
    ):
        host = _make_user(db_session)
        non_member = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        # Should not raise
        user_service.leave_group(str(non_member.id), group_id)


class TestGetAllGroups:
    def test_returns_only_groups_the_user_belongs_to(self, user_service, db_session):
        user = _make_user(db_session)
        other = _make_user(db_session)

        my_group_id = user_service.create_group(str(user.id), "My Group")
        user_service.create_group(
            str(other.id), "Other Group"
        )  # user is not in this one

        groups = user_service.get_all_groups(str(user.id))

        assert len(groups) == 1
        assert str(groups[0].id) == my_group_id

    def test_returns_joined_groups_as_well(self, user_service, db_session):
        host = _make_user(db_session)
        user = _make_user(db_session)

        group_id = user_service.create_group(str(host.id), "Shared Group")
        user_service.join_group(str(user.id), group_id)

        groups = user_service.get_all_groups(str(user.id))

        assert any(str(g.id) == group_id for g in groups)

    def test_returns_empty_list_when_user_has_no_groups(self, user_service, db_session):
        user = _make_user(db_session)

        groups = user_service.get_all_groups(str(user.id))

        assert groups == []


class TestRemoveMember:
    def test_host_can_remove_a_member(self, user_service, db_session):
        host = _make_user(db_session)
        member = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")
        user_service.join_group(str(member.id), group_id)

        user_service.remove_member(str(host.id), group_id, str(member.id))

        row = db_session.get(
            GroupMember, {"profile_id": member.id, "group_id": uuid.UUID(group_id)}
        )
        assert row is None

    def test_host_cannot_remove_themselves(self, user_service, db_session):
        host = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        with pytest.raises(HTTPException) as exc:
            user_service.remove_member(str(host.id), group_id, str(host.id))

        assert exc.value.status_code == 400

    def test_non_host_cannot_remove_members(self, user_service, db_session):
        host = _make_user(db_session)
        member_a = _make_user(db_session)
        member_b = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")
        user_service.join_group(str(member_a.id), group_id)
        user_service.join_group(str(member_b.id), group_id)

        with pytest.raises(HTTPException) as exc:
            user_service.remove_member(str(member_a.id), group_id, str(member_b.id))

        assert exc.value.status_code == 403

    def test_removing_nonexistent_member_does_not_raise(self, user_service, db_session):
        host = _make_user(db_session)
        ghost = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        # ghost never joined — should be a no-op, not an error
        user_service.remove_member(str(host.id), group_id, str(ghost.id))

    def test_removing_member_unclaims_their_items(self, user_service, db_session):
        """
        The db_session trigger unclaim_items_on_member_leave should fire and remove
        all item_claims for the removed member inside that group.
        """
        from sqlalchemy import select
        from app.models import Item, ItemClaim

        host = _make_user(db_session)
        member = _make_user(db_session)
        group = _make_group(db_session, host, "Group 1")
        _add_member(db_session, member, group)

        item = _add_item(db_session, group, "Item 1", 6.00)

        # Member claims the item
        user_service.claim_item(str(member.id), str(item.id))

        claim_before = db_session.get(
            ItemClaim, {"profile_id": member.id, "item_id": item.id}
        )
        assert claim_before is not None

        # Host removes the member — trigger should unclaim
        user_service.remove_member(str(host.id), str(group.id), str(member.id))
        db_session.expire_all()

        claim_after = db_session.get(
            ItemClaim, {"profile_id": member.id, "item_id": item.id}
        )
        assert claim_after is None


class TestGetItemsInGroup:
    def test_returns_items_for_a_group_member(self, user_service, db_session):
        host, group, item = _setup_group_with_item(db_session)

        items = user_service.get_items_in_group(str(host.id), str(group.id))

        assert len(items) == 1
        assert items[0].id == item.id

    def test_raises_403_for_non_member(self, user_service, db_session):
        _, group, _ = _setup_group_with_item(db_session)
        outsider = _make_user(db_session)

        with pytest.raises(HTTPException) as exc:
            user_service.get_items_in_group(str(outsider.id), str(group.id))

        assert exc.value.status_code == 403


class TestClaimItem:
    def test_member_can_claim_an_item(self, user_service, db_session):
        host, _, item = _setup_group_with_item(db_session)

        user_service.claim_item(str(host.id), str(item.id))
        db_session.expire_all()

        claim = db_session.get(ItemClaim, {"profile_id": host.id, "item_id": item.id})
        assert claim is not None

    def test_claiming_twice_does_not_create_duplicate(self, user_service, db_session):
        host, _, item = _setup_group_with_item(db_session)

        user_service.claim_item(str(host.id), str(item.id))
        user_service.claim_item(str(host.id), str(item.id))  # on_conflict_do_nothing
        db_session.expire_all()

        claims = (
            db_session.execute(select(ItemClaim).where(ItemClaim.item_id == item.id))
            .scalars()
            .all()
        )
        assert len(claims) == 1

    def test_raises_404_for_nonexistent_item(self, user_service, db_session):
        user = _make_user(db_session)

        with pytest.raises(HTTPException) as exc:
            user_service.claim_item(str(user.id), str(uuid.uuid4()))

        assert exc.value.status_code == 404

    def test_raises_403_when_user_not_in_items_group(self, user_service, db_session):
        host, _, item = _setup_group_with_item(db_session)
        outsider = _make_user(db_session)

        with pytest.raises(HTTPException) as exc:
            user_service.claim_item(str(outsider.id), str(item.id))

        assert exc.value.status_code == 403


class TestUnclaimItem:
    def test_member_can_unclaim_an_item(self, user_service, db_session):
        host, _, item = _setup_group_with_item(db_session)
        user_service.claim_item(str(host.id), str(item.id))

        user_service.unclaim_item(str(host.id), str(item.id))
        db_session.expire_all()

        claim = db_session.get(ItemClaim, {"profile_id": host.id, "item_id": item.id})
        assert claim is None

    def test_unclaiming_an_item_not_claimed_is_a_no_op(self, user_service, db_session):
        host, _, item = _setup_group_with_item(db_session)

        # Should not raise
        user_service.unclaim_item(str(host.id), str(item.id))


class TestAssignItem:
    def test_host_can_assign_item_to_member(self, user_service, db_session):
        host, group, item = _setup_group_with_item(db_session)
        member = _make_user(db_session)
        user_service.join_group(str(member.id), group.id)

        user_service.assign_item(str(host.id), str(member.id), str(item.id))
        db_session.expire_all()

        claim = db_session.get(ItemClaim, {"profile_id": member.id, "item_id": item.id})
        assert claim is not None

    def test_non_host_cannot_assign_items(self, user_service, db_session):
        _, group, item = _setup_group_with_item(db_session)
        member_a = _make_user(db_session)
        member_b = _make_user(db_session)
        user_service.join_group(str(member_a.id), group.id)
        user_service.join_group(str(member_b.id), group.id)

        with pytest.raises((HTTPException, TypeError)):
            user_service.assign_item(str(member_a.id), str(member_b.id), str(item.id))


class TestUnassignItem:
    def test_host_can_unassign_item_from_member(self, user_service, db_session):
        host, group, item = _setup_group_with_item(db_session)
        member = _make_user(db_session)
        user_service.join_group(str(member.id), group.id)
        user_service.assign_item(str(host.id), str(member.id), str(item.id))

        user_service.unassign_item(str(host.id), str(member.id), str(item.id))
        db_session.expire_all()

        claim = db_session.get(ItemClaim, {"profile_id": member.id, "item_id": item.id})
        assert claim is None

    def test_non_host_cannot_unassign_items(self, user_service, db_session):
        host, group, item = _setup_group_with_item(db_session)
        member = _make_user(db_session)
        user_service.join_group(str(member.id), group.id)
        user_service.assign_item(str(host.id), str(member.id), str(item.id))

        with pytest.raises((HTTPException, TypeError)):
            user_service.unassign_item(str(member.id), str(host.id), str(item.id))


class TestAddReceipt:
    @pytest.mark.asyncio
    async def test_creates_receipt_row_in_db(self, user_service, db_session, supabase):
        user = _make_user(db_session)
        group = _make_group(db_session, user, "Group 1")
        _configure_supabase(supabase)

        with _mock_detect_receipt([("Burger", 9.99)]):
            await user_service.add_receipt(str(user.id), str(group.id), b"img", "jpg")
        db_session.expire_all()

        receipts = db_session.execute(select(Receipt)).scalars().all()
        assert len(receipts) == 1
        assert receipts[0].image == "https://example.com/img.jpg"

    @pytest.mark.asyncio
    async def test_creates_one_item_per_extracted_item(
        self, user_service, db_session, supabase
    ):
        user = _make_user(db_session)
        group_id = user_service.create_group(str(user.id), "Group")
        _configure_supabase(supabase)
        # each ReceiptItem becomes one DB row
        with _mock_detect_receipt([
            ("Coffee", 3.00),
            ("Coffee", 3.00),
            ("Coffee", 3.00),
        ]):
            await user_service.add_receipt(str(user.id), group_id, b"img", "jpg")
        db_session.expire_all()

        items = db_session.execute(select(Item)).scalars().all()
        assert len(items) == 3
        assert all(i.name == "Coffee" for i in items)

    @pytest.mark.asyncio
    async def test_creates_items_for_multiple_extracted_lines(
        self, user_service, db_session, supabase
    ):
        user = _make_user(db_session)
        group_id = user_service.create_group(str(user.id), "Group")
        _configure_supabase(supabase)

        with _mock_detect_receipt([("Burger", 9.99), ("Fries", 3.50)]):
            await user_service.add_receipt(str(user.id), group_id, b"img", "jpg")
        db_session.expire_all()

        items = db_session.execute(select(Item)).scalars().all()
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_raises_403_when_user_not_in_group(
        self, user_service, db_session, supabase
    ):
        host = _make_user(db_session)
        outsider = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")
        _configure_supabase(supabase)

        with pytest.raises(HTTPException) as exc:
            with _mock_detect_receipt([]):
                await user_service.add_receipt(
                    str(outsider.id), group_id, b"img", "jpg"
                )

        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_raises_500_when_storage_upload_fails(
        self, user_service, db_session, supabase
    ):
        user = _make_user(db_session)
        group_id = user_service.create_group(str(user.id), "Group")
        supabase.storage.from_.return_value.upload.side_effect = Exception("S3 down")

        with pytest.raises(HTTPException) as exc:
            with _mock_detect_receipt([]):
                await user_service.add_receipt(str(user.id), group_id, b"img", "jpg")

        assert exc.value.status_code == 500


class TestGetReceiptsInGroup:
    @pytest.mark.asyncio
    async def test_returns_receipts_for_group_member(
        self, user_service, db_session, supabase
    ):
        user = _make_user(db_session)
        group_id = user_service.create_group(str(user.id), "Group")
        _configure_supabase(supabase)
        with _mock_detect_receipt([("Tea", 2.00)]):
            await user_service.add_receipt(str(user.id), group_id, b"img", "jpg")
        db_session.expire_all()

        receipts = user_service.get_receipts_in_group(str(user.id), group_id)

        assert len(receipts) == 1

    def test_raises_403_for_non_member(self, user_service, db_session):
        host = _make_user(db_session)
        outsider = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")

        with pytest.raises(HTTPException) as exc:
            user_service.get_receipts_in_group(str(outsider.id), group_id)

        assert exc.value.status_code == 403


class TestRemoveReceipt:
    @pytest.mark.asyncio
    async def test_creator_can_remove_their_receipt(
        self, user_service, db_session, supabase
    ):
        user = _make_user(db_session)
        group_id = user_service.create_group(str(user.id), "Group")
        _configure_supabase(supabase)
        with _mock_detect_receipt([("Tea", 2.00)]):
            await user_service.add_receipt(str(user.id), group_id, b"img", "jpg")
        db_session.expire_all()

        receipt = db_session.execute(select(Receipt)).scalars().first()
        user_service.remove_receipt(str(user.id), str(receipt.id))
        db_session.expire_all()

        assert db_session.execute(select(Receipt)).scalars().first() is None

    @pytest.mark.asyncio
    async def test_host_can_remove_another_members_receipt(
        self, user_service, db_session, supabase
    ):
        host = _make_user(db_session)
        member = _make_user(db_session)
        group = _make_group(db_session, host, "Group 1")
        _add_member(db_session, member, group)
        _configure_supabase(supabase)
        with _mock_detect_receipt([("Salad", 5.00)]):
            await user_service.add_receipt(str(member.id), str(group.id), b"img", "jpg")
        db_session.expire_all()

        receipt = db_session.execute(select(Receipt)).scalars().first()
        user_service.remove_receipt(str(host.id), str(receipt.id))
        db_session.expire_all()

        assert db_session.execute(select(Receipt)).scalars().first() is None

    @pytest.mark.asyncio
    async def test_raises_403_when_neither_owner_nor_host(
        self, user_service, db_session, supabase
    ):
        host = _make_user(db_session)
        member_a = _make_user(db_session)
        member_b = _make_user(db_session)
        group_id = user_service.create_group(str(host.id), "Group")
        user_service.join_group(str(member_a.id), group_id)
        user_service.join_group(str(member_b.id), group_id)
        _configure_supabase(supabase)
        with _mock_detect_receipt([("Soup", 4.00)]):
            await user_service.add_receipt(str(member_a.id), group_id, b"img", "jpg")
        db_session.expire_all()

        receipt = db_session.execute(select(Receipt)).scalars().first()
        with pytest.raises(HTTPException) as exc:
            user_service.remove_receipt(str(member_b.id), str(receipt.id))

        assert exc.value.status_code == 403

    def test_raises_404_for_nonexistent_receipt(self, user_service, db_session):
        user = _make_user(db_session)

        with pytest.raises(HTTPException) as exc:
            user_service.remove_receipt(str(user.id), str(uuid.uuid4()))

        assert exc.value.status_code == 404
