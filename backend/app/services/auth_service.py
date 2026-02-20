from fastapi import HTTPException, status
from supabase import client


class AuthService:
    def __init__(self, token: str):
        self.token = token
        self._user = None

    def _authenticate_user(self):
        if not self._user:
            response = client.auth.get_user(self.token)
            if not response or not response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                )
            self._user = response.user
        return self._user

    def authenticate_any_user(self) -> str:
        return self._authenticate_user().id

    def is_anonymous(self) -> bool:
        return self._authenticate_user().is_anonymous

    def authenticate_registered_user(self) -> str:
        if self.is_anonymous():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anonymous users cannot perform this action",
            )
        return self.authenticate_any_user()
