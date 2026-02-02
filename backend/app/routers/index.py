from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def index_get():
    return "Hello, world!"
