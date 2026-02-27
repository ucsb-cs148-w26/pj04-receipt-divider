from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import User, Receipt, Group, Item

import uuid
from datetime import datetime
from typing import List

from sqlalchemy import ForeignKey, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"), nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    total: Mapped[float] = mapped_column(nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    receipt_creator: Mapped["User"] = relationship(
        back_populates="user_receipts_created"
    )
    receipt_items: Mapped[List["Item"]] = relationship(back_populates="item_receipt")
    receipt_group: Mapped["Group"] = relationship(back_populates="group_receipts")
