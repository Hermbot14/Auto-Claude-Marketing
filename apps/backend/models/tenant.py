"""
Tenant Database Models for Auto Claude Marketing Hub

This module defines SQLAlchemy models for multi-tenant architecture.
Implements row-level security with tenant_id scoping on all models.
"""

from datetime import datetime, timedelta
from typing import Optional, List, TYPE_CHECKING
from enum import Enum
import uuid

try:
    from sqlalchemy import (
        Column, String, DateTime, Boolean, Integer, Text, JSON,
        ForeignKey, Index, UniqueConstraint, event
    )
    from sqlalchemy.orm import (
        relationship, declarative_base, validates, Session
    )
    from sqlalchemy.sql import func
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    # Fallback for environments without SQLAlchemy
    SQLALCHEMY_AVAILABLE = False
    Column = None
    relationship = None

if TYPE_CHECKING and SQLALCHEMY_AVAILABLE:
    from sqlalchemy.orm import Mapped, mapped_column

if SQLALCHEMY_AVAILABLE:
    Base = declarative_base()
else:
    # Base class for non-SQLAlchemy environments
    class Base:
        pass


class TenantStatus(str, Enum):
    """Tenant status enumeration."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    PENDING_VERIFICATION = "pending_verification"
    DELETED = "deleted"


class TierType(str, Enum):
    """Subscription tier types."""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class TeamRole(str, Enum):
    """Team member roles."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


if SQLALCHEMY_AVAILABLE:
    class Tenant(Base):
        """
        Main tenant model for multi-tenant isolation.

        Each tenant represents an organization/customer with isolated data.
        Uses row-level security via tenant_id scoping on related models.
        """
        __tablename__ = "tenants"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        tenant_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

        # Basic info
        name: Mapped[str] = mapped_column(String(255), nullable=False)
        display_name: Mapped[Optional[str]] = mapped_column(String(255))

        # Status and tier
        status: Mapped[str] = mapped_column(String(50), nullable=False, default=TenantStatus.TRIAL.value)
        tier: Mapped[str] = mapped_column(String(50), nullable=False, default=TierType.FREE.value)

        # Branding configuration (JSON)
        branding: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

        # Resource limits (JSON)
        limits: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

        # Additional metadata
        metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
        updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
        trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Relationships
        team_members: Mapped[List["TeamMember"]] = relationship(
            "TeamMember", back_populates="tenant", cascade="all, delete-orphan"
        )
        tenant_invites: Mapped[List["TenantInvite"]] = relationship(
            "TenantInvite", back_populates="tenant", cascade="all, delete-orphan"
        )
        tenant_configs: Mapped[List["TenantConfigModel"]] = relationship(
            "TenantConfigModel", back_populates="tenant", cascade="all, delete-orphan"
        )

        # Indexes
        __table_args__ = (
            Index("idx_tenant_status", "status"),
            Index("idx_tenant_tier", "tier"),
            UniqueConstraint("tenant_id", name="uq_tenant_tenant_id"),
        )

        @validates("status")
        def validate_status(self, key, value):
            """Validate status is a valid TenantStatus."""
            if value not in [s.value for s in TenantStatus]:
                raise ValueError(f"Invalid status: {value}")
            return value

        @validates("tier")
        def validate_tier(self, key, value):
            """Validate tier is a valid TierType."""
            if value not in [t.value for t in TierType]:
                raise ValueError(f"Invalid tier: {value}")
            return value

        @property
        def is_active(self) -> bool:
            """Check if tenant is active."""
            return self.status == TenantStatus.ACTIVE.value

        @property
        def is_trial(self) -> bool:
            """Check if tenant is in trial period."""
            if self.status != TenantStatus.TRIAL.value:
                return False
            if self.trial_ends_at is None:
                return True
            return datetime.utcnow() < self.trial_ends_at

        @property
        def trial_days_remaining(self) -> Optional[int]:
            """Get remaining trial days."""
            if self.trial_ends_at is None:
                return None
            delta = self.trial_ends_at - datetime.utcnow()
            return max(0, delta.days)

        def to_dict(self) -> dict:
            """Convert to dictionary representation."""
            return {
                "id": self.id,
                "tenant_id": self.tenant_id,
                "name": self.name,
                "display_name": self.display_name,
                "status": self.status,
                "tier": self.tier,
                "branding": self.branding,
                "limits": self.limits,
                "metadata": self.metadata,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
                "trial_ends_at": self.trial_ends_at.isoformat() if self.trial_ends_at else None,
                "is_active": self.is_active,
                "is_trial": self.is_trial,
                "trial_days_remaining": self.trial_days_remaining,
            }

        def __repr__(self) -> str:
            return f"<Tenant(id={self.id}, tenant_id={self.tenant_id}, name={self.name})>"


    class TeamMember(Base):
        """
        Team member model for tenant collaboration.

        Represents users within a tenant with role-based permissions.
        """
        __tablename__ = "team_members"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign keys
        tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
        user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

        # Member info
        role: Mapped[str] = mapped_column(String(50), nullable=False, default=TeamRole.MEMBER.value)
        display_name: Mapped[Optional[str]] = mapped_column(String(255))
        email: Mapped[Optional[str]] = mapped_column(String(255))

        # Permissions (JSON - can be customized per member)
        permissions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

        # Status
        is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
        email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

        # Timestamps
        invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
        joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
        last_active_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="team_members")

        # Indexes and constraints
        __table_args__ = (
            Index("idx_team_member_user", "user_id"),
            Index("idx_team_member_tenant_user", "tenant_id", "user_id", unique=True),
            UniqueConstraint("tenant_id", "user_id", name="uq_team_member_tenant_user"),
        )

        @validates("role")
        def validate_role(self, key, value):
            """Validate role is a valid TeamRole."""
            if value not in [r.value for r in TeamRole]:
                raise ValueError(f"Invalid role: {value}")
            return value

        @property
        def is_owner(self) -> bool:
            """Check if member is tenant owner."""
            return self.role == TeamRole.OWNER.value

        @property
        def is_admin(self) -> bool:
            """Check if member is admin."""
            return self.role in [TeamRole.OWNER.value, TeamRole.ADMIN.value]

        def has_permission(self, permission: str) -> bool:
            """Check if member has specific permission."""
            # Owners and admins have all permissions
            if self.is_admin:
                return True

            # Check explicit permission grant
            return self.permissions.get(permission, False)

        def to_dict(self) -> dict:
            """Convert to dictionary representation."""
            return {
                "id": self.id,
                "tenant_id": self.tenant_id,
                "user_id": self.user_id,
                "role": self.role,
                "display_name": self.display_name,
                "email": self.email,
                "permissions": self.permissions,
                "is_active": self.is_active,
                "email_verified": self.email_verified,
                "invited_at": self.invited_at.isoformat() if self.invited_at else None,
                "joined_at": self.joined_at.isoformat() if self.joined_at else None,
                "last_active_at": self.last_active_at.isoformat() if self.last_active_at else None,
                "is_owner": self.is_owner,
                "is_admin": self.is_admin,
            }

        def __repr__(self) -> str:
            return f"<TeamMember(id={self.id}, user_id={self.user_id}, role={self.role})>"


    class TenantInvite(Base):
        """
        Tenant invitation model for team collaboration.

        Represents pending invitations for users to join a tenant.
        """
        __tablename__ = "tenant_invites"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign keys
        tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
        invited_by: Mapped[str] = mapped_column(String(36), nullable=False)  # TeamMember ID

        # Invite details
        email: Mapped[str] = mapped_column(String(255), nullable=False)
        role: Mapped[str] = mapped_column(String(50), nullable=False, default=TeamRole.MEMBER.value)
        token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

        # Status
        status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending, accepted, declined, expired

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
        expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
        accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="tenant_invites")

        # Indexes
        __table_args__ = (
            Index("idx_invite_email", "email"),
            Index("idx_invite_token", "token"),
            Index("idx_invite_status", "status"),
            Index("idx_invite_expires", "expires_at"),
        )

        @property
        def is_expired(self) -> bool:
            """Check if invitation has expired."""
            return datetime.utcnow() > self.expires_at

        @property
        def is_pending(self) -> bool:
            """Check if invitation is pending."""
            return self.status == "pending" and not self.is_expired

        @classmethod
        def generate_token(cls) -> str:
            """Generate a unique invite token."""
            return str(uuid.uuid4())

        def to_dict(self) -> dict:
            """Convert to dictionary representation."""
            return {
                "id": self.id,
                "tenant_id": self.tenant_id,
                "invited_by": self.invited_by,
                "email": self.email,
                "role": self.role,
                "status": self.status,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "expires_at": self.expires_at.isoformat() if self.expires_at else None,
                "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
                "is_expired": self.is_expired,
                "is_pending": self.is_pending,
            }

        def __repr__(self) -> str:
            return f"<TenantInvite(id={self.id}, email={self.email}, status={self.status})>"


    class TenantConfigModel(Base):
        """
        Tenant-specific configuration model.

        Stores additional configuration options per tenant.
        """
        __tablename__ = "tenant_configs"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign key
        tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)

        # Configuration key-value pairs
        config_key: Mapped[str] = mapped_column(String(255), nullable=False)
        config_value: Mapped[dict] = mapped_column(JSON, nullable=False)

        # Type information for validation
        value_type: Mapped[str] = mapped_column(String(50), nullable=False, default="string")

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
        updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="tenant_configs")

        # Indexes and constraints
        __table_args__ = (
            Index("idx_tenant_config_key", "tenant_id", "config_key", unique=True),
            UniqueConstraint("tenant_id", "config_key", name="uq_tenant_config_key_value"),
        )

        def to_dict(self) -> dict:
            """Convert to dictionary representation."""
            return {
                "id": self.id,
                "tenant_id": self.tenant_id,
                "config_key": self.config_key,
                "config_value": self.config_value,
                "value_type": self.value_type,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

        def __repr__(self) -> str:
            return f"<TenantConfigModel(id={self.id}, key={self.config_key})>"


class TenantScopedModel:
    """
    Mixin for models that need tenant isolation.

    Adds tenant_id column and automatic filtering.
    """

    if SQLALCHEMY_AVAILABLE:
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True
        )

        @declared_attr
        def __table_args__(cls):
            return (
                Index(f"idx_{cls.__tablename__}_tenant", "tenant_id"),
            )


# Default branding and limits templates
DEFAULT_BRANDING = {
    "company_name": "Auto Claude",
    "logo_url": None,
    "favicon_url": None,
    "primary_color": "#3b82f6",
    "secondary_color": "#8b5cf6",
    "custom_domain": None,
    "custom_css": None,
    "hide_powered_by": False,
}

DEFAULT_LIMITS = {
    "max_users": 1,
    "max_specs": 10,
    "max_agents": 5,
    "max_storage_mb": 1000,
    "api_calls_per_minute": 60,
    "concurrent_sessions": 1,
    "enable_team_features": False,
    "enable_custom_branding": False,
    "enable_sso": False,
    "enable_priority_queue": False,
}

TIER_LIMITS = {
    TierType.FREE: {
        "max_users": 1,
        "max_specs": 5,
        "max_agents": 3,
        "max_storage_mb": 500,
        "api_calls_per_minute": 30,
        "concurrent_sessions": 1,
        "enable_team_features": False,
        "enable_custom_branding": False,
        "enable_sso": False,
        "enable_priority_queue": False,
    },
    TierType.STARTER: {
        "max_users": 5,
        "max_specs": 25,
        "max_agents": 10,
        "max_storage_mb": 5000,
        "api_calls_per_minute": 100,
        "concurrent_sessions": 3,
        "enable_team_features": True,
        "enable_custom_branding": False,
        "enable_sso": False,
        "enable_priority_queue": False,
    },
    TierType.PROFESSIONAL: {
        "max_users": 20,
        "max_specs": 100,
        "max_agents": 50,
        "max_storage_mb": 20000,
        "api_calls_per_minute": 500,
        "concurrent_sessions": 10,
        "enable_team_features": True,
        "enable_custom_branding": True,
        "enable_sso": False,
        "enable_priority_queue": True,
    },
    TierType.ENTERPRISE: {
        "max_users": 9999,
        "max_specs": 9999,
        "max_agents": 9999,
        "max_storage_mb": 999999,
        "api_calls_per_minute": 10000,
        "concurrent_sessions": 100,
        "enable_team_features": True,
        "enable_custom_branding": True,
        "enable_sso": True,
        "enable_priority_queue": True,
    },
}


def get_limits_for_tier(tier: TierType) -> dict:
    """Get default limits for a subscription tier."""
    return TIER_LIMITS.get(tier, TIER_LIMITS[TierType.FREE]).copy()
