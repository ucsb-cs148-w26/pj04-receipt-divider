from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Profile, Group

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base


class GroupMember(Base):
    __tablename__ = "group_members"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), primary_key=True
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("groups.id"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    group_member_profile: Mapped["Profile"] = relationship(
        back_populates="profile_group_memberships"
    )
    group_member_group: Mapped["Group"] = relationship(back_populates="group_members")
