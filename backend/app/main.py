from fastapi import FastAPI

from app.routers import index, health, room
from app.database import init_db

app = FastAPI(
    title="Example FastAPI App",
    version="1.0.0",
)


# Initialize database or other startup logic
@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(index.router, prefix="", tags=["Index"])
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(room.router, prefix="/room", tags=["Room"])
