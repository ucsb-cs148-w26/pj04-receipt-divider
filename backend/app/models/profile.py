from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import GroupMember, Receipt, Group, ItemClaim

import uuid
from datetime import datetime
from typing import List

from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    email: Mapped[str] = mapped_column(Text, server_default="")

    # Relationships
    profile_groups_created: Mapped[List["Group"]] = relationship(
        back_populates="group_creator", foreign_keys="Group.created_by"
    )
    profile_group_memberships: Mapped[List["GroupMember"]] = relationship(
        back_populates="group_member_profile"
    )
    profile_receipts_created: Mapped[List["Receipt"]] = relationship(
        back_populates="receipt_creator"
    )
    profile_item_claims: Mapped[List["ItemClaim"]] = relationship(
        back_populates="item_claim_profile"
    )
