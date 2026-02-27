from app.models.group_member import GroupMember
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from app.models import Group, Item, Receipt


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_group(self, user_id: str, name: str) -> str:
        # 1. Create a new group with user as the host
        group = Group(created_by=user_id, name=name)
        self.db.add(group)
        self.db.flush()  # Flush to get the generated group.id before committing

        # 2. Add user to the member table
        member = GroupMember(user_id=user_id, group_id=group.id)
        self.db.add(member)
        self.db.commit()

        return str(group.id)

    def join_group(self, user_id: str, group_id: str) -> None:
        # 1. Check group exists
        group = self.db.get(Group, group_id)
        if group is None:
            raise HTTPException(status_code=404, detail="Group not found")

        # 2. Add user to group via group_member table
        #    2.1 If user already a member, db should ignore this request natively
        stmt = (
            insert(GroupMember)
            .values(user_id=user_id, group_id=group_id)
            .on_conflict_do_nothing(index_elements=["user_id", "group_id"])
        )
        self.db.execute(stmt)
        self.db.commit()

    def leave_group(self, user_id: str, group_id: str) -> None:
        # TODO:
        # 1. Check if group exists, if not return appropriate http error
        # 2. Check if user is host (host can't levae group)
        # 3. Remove user from group (OK if user isn't in group)
        pass

    def get_groups(self, user_id: str) -> list[Group]:
        # TODO: return all groups that member is a part of
        pass

    def remove_member(
        self, host_user_id: str, group_id: str, member_user_id: str
    ) -> None:
        # TODO:
        # 1. Check that group exists
        # 2. Check host user != member user (host can't remove themselves)
        # 3. Check host is actual host (guest can't remove others)
        # 4. Remove user from group via group_member table
        # 5. Unclaim their claimed items in the group
        pass

    def add_receipt(self, user_id: str, group_id: str, image_64_enc: bytes) -> None:
        # TODO:
        # 1. Check if user is host of group
        # 2. If not, return http unauthorized
        # 3. Add receipt to receipt table
        # 4. Process receipt using OCRService
        # 5. Store items in item table

        pass

    def remove_receipt(self, user_id: str, receipt_id: str) -> None:
        # TODO:
        # 1. Check if user own receipt or user is host of the group receipt belongs to, if not return http unauthorized
        # 2. Remove the receipt and cascade it to the items attatched to the receipts
        # 3. Cascade removal of items to claim
        pass

    def get_items_in_group(self, user_id: str, group_id: str) -> list[Item]:
        # TODO:
        # 1. check if user is in group
        # 2. if user in group return all items in that group
        # 3. else raise HTTP unauthorized error
        pass

    def get_receipts_in_group(self, user_id: str, group_id: str) -> list[Receipt]:
        # TODO:
        # 1. check if user is in group
        # 2. if user in group return all receipts in that group
        # 3. else raise HTTP unauthorized error
        pass

    def claim_item(self, user_id: str, item_id: str, claim_portion: float) -> None:
        # TODO:
        # 1. check if user in group that has the item
        # 2. If not, return http unautorized error
        # 3. Claim the item with that portion
        #   3.1 Use atomic action via native db function to check if claim is possible and claim it
        # 4. If the native db function returns error, return http error
        pass

    def unclaim_item(self, user_id: str, item_id: str) -> None:
        # TODO:
        # 1. check if user claimed the item already
        # 2. If not, return appropriate http error
        # 3. Unclaim the item
        #   3.1 Use atomic action via native db function to unclaim the item
        pass

    def assign_item(
        self, host_user_id: str, guest_user_id: str, item_id: str, assign_portion: float
    ) -> None:
        # TODO:
        # 1. Find which group item belongs to
        # 2. If Item doesn't exists, return http error
        # 3. For that group check if host is host and guest is in group
        # 4. If not, return appropriate http error
        # 5. assign the item with the given portion
        #   5.1 Use atomic action via native db function to check if claim is possible and claim it
        # 6. If the native db function returns error, return http error
        pass

    def unassign_item(
        self, host_user_id: str, guest_user_id: str, item_id: str
    ) -> None:
        # TODO:
        # 1. Find which group item belongs to
        # 2. If Item doesn't exists, return http error
        # 3. For that group check if host is host and guest is in group
        # 4. If not, return appropriate http error
        # 5. unassign the item for guest
        #   5.1 Use atomic action via native db function to umclaim item
        # 6. If the native db function returns error, return http error
        pass
