import uuid
from pathlib import Path
from typing import Iterator
from unittest.mock import MagicMock

import pytest
from psycopg import Connection
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker, scoped_session
from sqlalchemy.pool import NullPool

from app.models import Base
from app.services.user_service import UserService


def get_sql_files(directory: str) -> list[Path]:
    base_path = Path(__file__).parent.parent / directory
    return sorted(base_path.glob("*.sql"))


@pytest.fixture
def db_session(postgresql: Connection) -> Iterator[Session]:
    user = postgresql.info.user
    host = postgresql.info.host
    port = postgresql.info.port
    dbname = postgresql.info.dbname

    connection_str = f"postgresql+psycopg://{user}:@{host}:{port}/{dbname}"
    engine = create_engine(connection_str, echo=False, poolclass=NullPool)

    folders = ["sql/tables", "sql/functions"]
    with engine.connect() as conn:
        for folder in folders:
            for sql_file in get_sql_files(folder):
                conn.execute(text(sql_file.read_text()))

            conn.commit()

    SessionLocal = scoped_session(sessionmaker(bind=engine))
    session = SessionLocal()

    yield session

    SessionLocal.close()

    with engine.connect() as conn:
        conn.execute(
            text(
                "DROP TABLE IF EXISTS item_claims, items, receipts, group_members, groups, users_public_info, profiles CASCADE"
            )
        )
        conn.commit()


@pytest.fixture
def supabase():
    return MagicMock()


@pytest.fixture
def user_service(db_session, supabase):
    return UserService(db=db_session, supabase=supabase)
