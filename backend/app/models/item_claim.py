from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import User, Item

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class ItemClaim(Base):
    __tablename__ = "item_claims"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    share: Mapped[float] = mapped_column(nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    item_claim_item: Mapped["Item"] = relationship(back_populates="item_claims")
    item_claim_user: Mapped["User"] = relationship(back_populates="user_item_claims")
