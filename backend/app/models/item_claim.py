from sqlalchemy import (
    Column,
    ForeignKey,
    Float,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class ItemClaim(Base):
    __tablename__ = "item_claims"

    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.items.id"),
        primary_key=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id"),
        primary_key=True,
    )
    share = Column(Float, nullable=False)
    claimed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    item = relationship("Item", back_populates="claims")
    user = relationship("User", back_populates="item_claims")
