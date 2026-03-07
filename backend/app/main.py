from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import index, health, group, receipt
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv()
    try:
        init_db()
    except Exception:
        raise

    yield


app = FastAPI(title="Example FastAPI App", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

app.include_router(index.router, prefix="", tags=["Index"])
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(group.router, prefix="/group", tags=["Receipt Group"])
app.include_router(receipt.router, prefix="/receipt", tags=["Receipt"])
