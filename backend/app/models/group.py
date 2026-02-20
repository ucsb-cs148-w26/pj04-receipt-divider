from sqlalchemy import (
    Column,
    ForeignKey,
    Text,
    DateTime,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id"),
        nullable=False,
    )
    name = Column(Text, nullable=True)

    # Relationships
    creator = relationship(
        "User", back_populates="groups_created", foreign_keys=[created_by]
    )
    members = relationship("GroupMember", back_populates="group")
