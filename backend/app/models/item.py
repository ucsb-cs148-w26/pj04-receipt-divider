from sqlalchemy import (
    Column,
    ForeignKey,
    SmallInteger,
    Text,
    Float,
    DateTime,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    receipt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("public.receipts.id"),
        nullable=False,
    )
    name = Column(Text, nullable=False)
    amount = Column(SmallInteger, nullable=False)
    unit_price = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    receipt = relationship("Receipt", back_populates="items")
    claims = relationship("ItemClaim", back_populates="item")
