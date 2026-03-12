from fastapi import HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.models import GroupMember
from app.models.group import Group


class InviteService:
    def __init__(self, db: DBSession, frontend_url: str) -> None:
        self.db = db
        self.frontend_url = frontend_url

    def create_invite(self, group_id: str, profile_id: str) -> str:
        member = self.db.get(
            GroupMember, {"group_id": group_id, "profile_id": profile_id}
        )
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile is not a member of this group",
            )
        return f"{self.frontend_url}/join?roomId={group_id}"

    def validate_invite(self, group_id: str) -> bool:
        group = self.db.get(Group, group_id)
        return group is not None
