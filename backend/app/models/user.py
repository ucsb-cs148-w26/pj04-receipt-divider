from sqlalchemy import (
    Column,
    Text,
    DateTime,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    email = Column(Text, nullable=False, server_default="")

    # Relationships
    groups_created = relationship(
        "Group", back_populates="creator", foreign_keys="Group.created_by"
    )
    group_memberships = relationship("GroupMember", back_populates="user")
    receipts_created = relationship("Receipt", back_populates="creator")
    item_claims = relationship("ItemClaim", back_populates="user")
