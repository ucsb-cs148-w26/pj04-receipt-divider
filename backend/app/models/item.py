import uuid
from datetime import datetime
from typing import List

from sqlalchemy import ForeignKey, SmallInteger, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    receipt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("receipts.id"))
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    unit_price: Mapped[float] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    item_receipt: Mapped["Receipt"] = relationship(back_populates="receipt_items")
    item_receipt_group: Mapped["Group"] = relationship(back_populates="group_items")
    item_claims: Mapped[List["ItemClaim"]] = relationship(
        back_populates="item_claim_item"
    )
