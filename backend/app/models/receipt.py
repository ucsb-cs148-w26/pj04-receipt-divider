from sqlalchemy import (
    Column,
    ForeignKey,
    Text,
    Float,
    DateTime,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    image = Column(Text, nullable=False)
    total = Column(Float, nullable=False)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id"),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    creator = relationship("User", back_populates="receipts_created")
    items = relationship("Item", back_populates="receipt")
