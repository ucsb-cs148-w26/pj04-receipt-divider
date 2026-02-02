from fastapi import Depends

from app.database import get_db
from app.services.user_service import UserService


def get_user_service(db=Depends(get_db)):
    return UserService(db)
