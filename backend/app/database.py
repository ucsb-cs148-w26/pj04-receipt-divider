from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

from app.config import settings

engine = create_engine(
    str(settings.database_url),
    connect_args={"sslmode": "require"},
    poolclass=(
        NullPool
        if settings.serverless
        else QueuePool(
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_recycle=settings.db_pool_recycle,
            pool_pre_ping=True,
            pool_timeout=settings.db_pool_timeout,
        )
    ),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
