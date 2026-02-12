"""
Tenant Context Module for Auto Claude Marketing Hub

This module provides tenant context management for multi-tenant SaaS operations.
It implements a thread-local context for tenant isolation throughout the request lifecycle.

Architecture:
- ThreadLocal storage for tenant context per request
- Tenant identification via subdomain, header, or JWT claim
- Context propagation through async operations
"""

import contextvars
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from enum import Enum
import threading
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


class TenantStatus(Enum):
    """Tenant status enumeration for lifecycle management."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    PENDING_VERIFICATION = "pending_verification"
    DELETED = "deleted"


class TierType(Enum):
    """Subscription tier definitions with feature limits."""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


@dataclass
class TenantBranding:
    """Tenant branding configuration for white-label support."""
    company_name: str = "Auto Claude"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#3b82f6"
    secondary_color: str = "#8b5cf6"
    custom_domain: Optional[str] = None
    custom_css: Optional[str] = None
    hide_powered_by: bool = False


@dataclass
class TenantLimits:
    """Per-tenant resource limits based on subscription tier."""
    max_users: int = 1
    max_specs: int = 10
    max_agents: int = 5
    max_storage_mb: int = 1000
    api_calls_per_minute: int = 60
    concurrent_sessions: int = 1
    enable_team_features: bool = False
    enable_custom_branding: bool = False
    enable_sso: bool = False
    enable_priority_queue: bool = False


@dataclass
class Tenant:
    """Tenant entity representing an organization/customer."""
    tenant_id: str
    name: str
    status: TenantStatus = TenantStatus.TRIAL
    tier: TierType = TierType.FREE
    branding: TenantBranding = field(default_factory=TenantBranding)
    limits: TenantLimits = field(default_factory=TenantLimits)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Tenant":
        """Create Tenant from dictionary representation."""
        branding_data = data.pop("branding", {})
        limits_data = data.pop("limits", {})

        branding = TenantBranding(**branding_data) if branding_data else TenantBranding()
        limits = TenantLimits(**limits_data) if limits_data else TenantLimits()

        # Handle enum conversions
        status = TenantStatus(data.get("status", "trial"))
        tier = TierType(data.get("tier", "free"))

        return cls(
            branding=branding,
            limits=limits,
            status=status,
            tier=tier,
            **data
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert Tenant to dictionary representation."""
        return {
            "tenant_id": self.tenant_id,
            "name": self.name,
            "status": self.status.value,
            "tier": self.tier.value,
            "branding": {
                "company_name": self.branding.company_name,
                "logo_url": self.branding.logo_url,
                "favicon_url": self.branding.favicon_url,
                "primary_color": self.branding.primary_color,
                "secondary_color": self.branding.secondary_color,
                "custom_domain": self.branding.custom_domain,
                "custom_css": self.branding.custom_css,
                "hide_powered_by": self.branding.hide_powered_by,
            },
            "limits": {
                "max_users": self.limits.max_users,
                "max_specs": self.limits.max_specs,
                "max_agents": self.limits.max_agents,
                "max_storage_mb": self.limits.max_storage_mb,
                "api_calls_per_minute": self.limits.api_calls_per_minute,
                "concurrent_sessions": self.limits.concurrent_sessions,
                "enable_team_features": self.limits.enable_team_features,
                "enable_custom_branding": self.limits.enable_custom_branding,
                "enable_sso": self.limits.enable_sso,
                "enable_priority_queue": self.limits.enable_priority_queue,
            },
            "metadata": self.metadata,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def is_active(self) -> bool:
        """Check if tenant is in active state."""
        return self.status == TenantStatus.ACTIVE

    def can_access_team_features(self) -> bool:
        """Check if tenant has team feature access."""
        return self.limits.enable_team_features

    def can_use_custom_branding(self) -> bool:
        """Check if tenant can use custom branding."""
        return self.limits.enable_custom_branding


# Context variable for tenant storage (thread-safe and async-safe)
_tenant_context: contextvars.ContextVar[Optional[Tenant]] = contextvars.ContextVar(
    "_tenant_context", default=None
)


class TenantContextError(Exception):
    """Base exception for tenant context errors."""
    pass


class TenantNotFoundError(TenantContextError):
    """Raised when tenant is not found or not set in context."""
    pass


class TenantInactiveError(TenantContextError):
    """Raised when tenant is not in active state."""
    pass


class TenantLimitExceededError(TenantContextError):
    """Raised when tenant exceeds resource limits."""
    def __init__(self, limit_type: str, current: int, maximum: int):
        self.limit_type = limit_type
        self.current = current
        self.maximum = maximum
        super().__init__(
            f"Tenant limit exceeded for {limit_type}: {current}/{maximum}"
        )


def set_tenant(tenant: Tenant) -> None:
    """
    Set the current tenant context.

    Args:
        tenant: Tenant instance to set as current context

    Raises:
        TenantInactiveError: If tenant is not active
    """
    if not tenant.is_active() and tenant.status != TenantStatus.TRIAL:
        raise TenantInactiveError(
            f"Tenant {tenant.tenant_id} is not active. Status: {tenant.status.value}"
        )

    _tenant_context.set(tenant)
    logger.debug(f"Set tenant context: {tenant.tenant_id} ({tenant.name})")


def get_tenant() -> Tenant:
    """
    Get the current tenant from context.

    Returns:
        Current Tenant instance

    Raises:
        TenantNotFoundError: If no tenant is set in context
    """
    tenant = _tenant_context.get()
    if tenant is None:
        raise TenantNotFoundError("No tenant context found. Call set_tenant() first.")
    return tenant


def get_tenant_id() -> str:
    """
    Get the current tenant ID from context.

    Returns:
        Current tenant ID string

    Raises:
        TenantNotFoundError: If no tenant is set in context
    """
    tenant = get_tenant()
    return tenant.tenant_id


def get_tenant_safe() -> Optional[Tenant]:
    """
    Get the current tenant from context without raising an exception.

    Returns:
        Current Tenant instance or None if not set
    """
    return _tenant_context.get()


def clear_tenant() -> None:
    """Clear the current tenant context."""
    _tenant_context.set(None)
    logger.debug("Cleared tenant context")


def tenant_context(tenant: Tenant):
    """
    Context manager for temporary tenant context.

    Usage:
        with tenant_context(my_tenant):
            # All operations here use my_tenant context
            process_request()

    Args:
        tenant: Tenant instance to use in this context

    Yields:
        Tenant context manager
    """
    token = _tenant_context.set(tenant)
    try:
        logger.debug(f"Entered tenant context: {tenant.tenant_id}")
        yield tenant
    finally:
        _tenant_context.reset(token)
        logger.debug(f"Exited tenant context: {tenant.tenant_id}")


def require_tenant(func):
    """
    Decorator to require tenant context for a function.

    Usage:
        @require_tenant
        def my_function():
            # Guaranteed to have tenant context
            tenant = get_tenant()

    Args:
        func: Function to decorate

    Returns:
        Decorated function that validates tenant context
    """
    def wrapper(*args, **kwargs):
        tenant = get_tenant_safe()
        if tenant is None:
            raise TenantNotFoundError(
                f"Function {func.__name__} requires tenant context. "
                "Use @tenant_context() or set_tenant() first."
            )
        return func(*args, **kwargs)
    return wrapper


@lru_cache(maxsize=128)
def get_default_tenant() -> Tenant:
    """
    Get the default single-tenant instance for backward compatibility.

    Returns:
        Default Tenant instance for single-tenant mode
    """
    return Tenant(
        tenant_id="default",
        name="Default Tenant",
        status=TenantStatus.ACTIVE,
        tier=TierType.ENTERPRISE,
        branding=TenantBranding(
            company_name="Auto Claude",
            primary_color="#3b82f6",
            secondary_color="#8b5cf6"
        ),
        limits=TenantLimits(
            max_users=9999,
            max_specs=9999,
            max_agents=9999,
            max_storage_mb=999999,
            api_calls_per_minute=10000,
            concurrent_sessions=100,
            enable_team_features=True,
            enable_custom_branding=True,
            enable_sso=False,
            enable_priority_queue=True,
        )
    )


def is_multi_tenant_mode() -> bool:
    """
    Check if the application is running in multi-tenant mode.

    Returns:
        True if multi-tenant mode is enabled
    """
    import os
    return os.getenv("MULTI_TENANT_ENABLED", "false").lower() == "true"


def get_effective_tenant() -> Tenant:
    """
    Get the effective tenant for the current context.

    In single-tenant mode, returns the default tenant.
    In multi-tenant mode, returns the current tenant from context.

    Returns:
        Effective Tenant instance

    Raises:
        TenantNotFoundError: In multi-tenant mode with no context set
    """
    if is_multi_tenant_mode():
        return get_tenant()
    return get_default_tenant()


# Convenience constants for common operations
DEFAULT_TENANT_ID = "default"
SYSTEM_TENANT_ID = "system"
