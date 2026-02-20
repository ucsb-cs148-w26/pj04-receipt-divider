from app.services.auth_service import AuthService
from fastapi import Depends
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_db
from app.services.user_service import UserService

security = HTTPBearer()


def get_auth_service(http_auth: HTTPAuthorizationCredentials = Depends(security)):
    return AuthService(http_auth.credentials)


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(db)
