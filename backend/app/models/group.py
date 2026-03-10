from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Profile, GroupMember, Receipt, Item

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import ForeignKey, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), nullable=False
    )
    name: Mapped[Optional[str]] = mapped_column(Text)
    is_finished: Mapped[bool] = mapped_column(default=False, server_default="false")

    # Relationships
    group_creator: Mapped["Profile"] = relationship(
        back_populates="profile_groups_created", foreign_keys=[created_by]
    )
    group_members: Mapped[List["GroupMember"]] = relationship(
        back_populates="group_member_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    group_receipts: Mapped[List["Receipt"]] = relationship(
        back_populates="receipt_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    group_items: Mapped[List["Item"]] = relationship(
        back_populates="item_receipt_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
