from contextlib import asynccontextmanager

from fastapi import FastAPI
from dotenv import load_dotenv

from app.routers import index, health, group
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv()
    try:
        init_db()
    except Exception:
        raise

    yield


app = FastAPI(
    title="Example FastAPI App",
    version="1.0.0",
    lifespan=lifespan,
)


app.include_router(index.router, prefix="", tags=["Index"])
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(group.router, prefix="/group", tags=["Receipt Group"])
