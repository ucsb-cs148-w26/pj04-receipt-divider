from fastapi import APIRouter

from app.schemas.health import HealthCheckResponse

router = APIRouter()


@router.get("/")
def running_check():
    return "Running: OK"


@router.get("/check", response_model=HealthCheckResponse)
def health_check():
    return HealthCheckResponse(status="OK")
