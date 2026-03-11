from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass  # no ORM relationships needed; queries use raw SQLAlchemy selects

import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base

# Enum is defined here (moved from group_member.py which no longer uses it)
paid_status_enum = SAEnum(
    "verified", "pending", "requested", "unrequested", name="paid_status_enum"
)


class PaymentDebt(Base):
    __tablename__ = "payment_debts"

    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("groups.id"), primary_key=True
    )
    debtor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), primary_key=True
    )
    creditor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), primary_key=True
    )
    paid_status: Mapped[str] = mapped_column(
        paid_status_enum, nullable=False, server_default="unrequested"
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
