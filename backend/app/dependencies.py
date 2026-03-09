from fastapi import Depends
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.database import get_db
from app.services import InviteService, ProfileService, AuthService, UserService
from app.supabase import client as supabase_client

security = HTTPBearer()


def get_profile_service(db: Session = Depends(get_db)) -> ProfileService:
    return ProfileService(
        db,
        settings.supabase_jwt_private_key,
        settings.supabase_jwt_kid,
        settings.supabase_jwt_algo,
    )


def get_auth_service(http_auth: HTTPAuthorizationCredentials = Depends(security)):
    return AuthService(http_auth.credentials)


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(db, supabase_client)


def get_invite_service(db: Session = Depends(get_db)) -> InviteService:
    return InviteService(db, settings.frontend_url)
