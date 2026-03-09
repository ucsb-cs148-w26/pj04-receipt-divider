import datetime

from app.models.profile import Profile
from app.schemas.group import ProfileIdWithAccentColor
import jwt
from sqlalchemy import select

from app.models import Group, GroupMember
from app.supabase import client


class ProfileNotFoundError(Exception):
    pass


class ProfileService:
    def __init__(self, db, jwt_private_key: str, jwt_kid: str, jwt_algo: str):
        self.db = db
        self.jwt_kid = jwt_kid
        self.jwt_algo = jwt_algo
        self.jwt_private_key = jwt_private_key

    def _issue_jwt(self, profile_id: str) -> str:
        now = datetime.datetime.utcnow()
        header = {"alg": self.jwt_algo, "kid": self.jwt_kid, "typ": "JWT"}
        payload = {
            "sub": profile_id,
            "aud": "authenticated",
            "role": "authenticated",
            "iat": now,
            "exp": now + datetime.timedelta(minutes=15),
            "is_anonymous": True,
        }
        return jwt.encode(
            payload, self.jwt_private_key, algorithm=self.jwt_algo, headers=header
        )

    def get_group_profiles_id_with_accent(
        self, group_id: str
    ) -> list[ProfileIdWithAccentColor]:
        group = self.db.get(Group, group_id)
        if not group:
            raise ValueError(f"Group '{group_id}' not found.")

        profiles = self.db.scalars(
            select(Profile).join(GroupMember).where(GroupMember.group_id == group_id)
        ).all()

        return [
            ProfileIdWithAccentColor(profile_id=p.id, accent_color=p.accent_color or "")
            for p in profiles
        ]

    def login_as(self, group_id: str, profile_id: str) -> str:
        member = self.db.get(
            GroupMember, {"group_id": group_id, "profile_id": profile_id}
        )

        if not member:
            raise ProfileNotFoundError(
                f"No profile '{profile_id}' found in group '{group_id}'."
            )

        return self._issue_jwt(profile_id)

    def create_profile_and_login(self, group_id: str, username: str) -> str:
        response = client.auth.sign_in_anonymously()
        profile = self.db.get(Profile, response.user.id)
        profile.username = username

        membership = GroupMember(group_id=group_id, profile_id=response.user.id)
        self.db.add(membership)
        self.db.commit()

        return response.session.access_token
