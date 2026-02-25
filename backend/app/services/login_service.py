import datetime

import jwt
from sqlalchemy import select

from app.models import Group, User, GroupMember
from app.supabase import client


class InvalidInviteTokenError(Exception):
    pass


class ProfileNotFoundError(Exception):
    pass


class LoginService:
    def __init__(self, db, supabase_jwt_secret: str):
        self.db = db
        self.supabase_jwt_secret = supabase_jwt_secret

    def _verify_invite_token(self, group_id: str, invite_token: str) -> None:
        """
        Raises InvalidInviteTokenError if the token doesn't match the group's invite token.
        """
        group = self.db.get(Group, group_id)
        if not group:
            raise ValueError(f"Group '{group_id}' not found.")
        if group.invite_token != invite_token:
            raise InvalidInviteTokenError(
                f"Invalid invite token for group '{group_id}'."
            )

    def _issue_jwt(self, user_id: str, group_id: str) -> str:
        now = datetime.datetime.utcnow()
        payload = {
            "sub": user_id,
            "role": "authenticated",
            "iss": "supabase",
            "aud": "authenticated",
            "iat": now,
            "exp": now + datetime.timedelta(hours=1),
            "group_id": group_id,
        }
        return jwt.encode(payload, self.supabase_jwt_secret, algorithm="HS256")

    def get_group_profiles_id(self, group_id: str, invite_token: str) -> list[str]:
        self._verify_invite_token(group_id, invite_token)

        group = self.db.get(Group, group_id)
        if not group:
            raise ValueError(f"Group '{group_id}' not found.")

        return self.db.scalars(
            select(GroupMember.user_id).where(GroupMember.group_id == group_id)
        ).all()

    def login_as(self, group_id: str, user_id: str, invite_token: str) -> str:
        self._verify_invite_token(group_id, invite_token)
        member = self.db.get(GroupMember, {"group_id": group_id, "user_id": user_id})

        if not member:
            raise ProfileNotFoundError(
                f"No profile '{user_id}' found in group '{group_id}'."
            )

        return self._issue_jwt(user_id, group_id)

    def create_profile_and_login(
        self,
        group_id: str,
        username: str,
        invite_token: str,
    ) -> str:
        self._verify_invite_token(group_id, invite_token)
        response = client.auth.sign_in_anonymously()

        membership = GroupMember(group_id=group_id, user_id=response.user.id)
        self.db.add(membership)
        self.db.commit()

        return response.session.access_token
