"""
Multi-Tenancy Module for Auto Claude Marketing Hub

This module provides comprehensive multi-tenant support including:
- Tenant isolation and data separation
- Per-tenant rate limiting with Redis
- Tenant resolution from subdomains/headers
- Request middleware for tenant context
- Data namespace management
"""

import os
import re
import json
import time
import hashlib
from typing import Optional, Dict, Any, List, Callable, Tuple
from functools import wraps
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

from redis import Redis
from redis.exceptions import RedisError

from core.tenant_context import (
    Tenant, TenantStatus, TierType, TenantBranding, TenantLimits,
    set_tenant, get_tenant, get_tenant_safe, get_tenant_id,
    tenant_context, TenantNotFoundError, TenantInactiveError,
    is_multi_tenant_mode, get_default_tenant
)

logger = logging.getLogger(__name__)


@dataclass
class TenantConfig:
    """Configuration for multi-tenancy system."""
    enabled: bool = False
    default_tenant_id: str = "default"
    tenant_header: str = "X-Tenant-ID"
    subdomain_pattern: str = r"^([a-z0-9-]+)\."
    redis_prefix: str = "tenant"
    cache_ttl_seconds: int = 3600
    enable_rate_limiting: bool = True
    enable_branding: bool = True
    storage_path: str = ".auto-claude/tenants"


class TenantResolver:
    """
    Resolves tenant from various sources (subdomain, header, token).
    Implements priority order: subdomain > header > token > default.
    """

    def __init__(self, config: TenantConfig):
        self.config = config
        self.subdomain_regex = re.compile(config.subdomain_pattern)
        self._tenant_cache: Dict[str, Tenant] = {}

    def resolve_from_subdomain(self, host: str) -> Optional[str]:
        """
        Extract tenant ID from subdomain.

        Args:
            host: HTTP Host header value

        Returns:
            Tenant ID or None if no subdomain pattern matches
        """
        if not host:
            return None

        # Extract subdomain from host
        match = self.subdomain_regex.match(host.lower())
        if match:
            subdomain = match.group(1)
            # Skip system subdomains
            if subdomain in ["www", "api", "app", "admin"]:
                return None
            return subdomain

        return None

    def resolve_from_header(self, headers: Dict[str, str]) -> Optional[str]:
        """
        Extract tenant ID from request headers.

        Args:
            headers: Request headers dictionary

        Returns:
            Tenant ID or None if header not present
        """
        # Try exact header name match
        if self.config.tenant_header in headers:
            return headers[self.config.tenant_header]

        # Try common variations (case-insensitive)
        header_lower = self.config.tenant_header.lower()
        for key, value in headers.items():
            if key.lower() == header_lower:
                return value

        return None

    def resolve_from_token(self, token: str) -> Optional[str]:
        """
        Extract tenant ID from JWT token claim.

        Args:
            token: JWT token string

        Returns:
            Tenant ID or None if claim not present
        """
        try:
            # Simple JWT parsing without verification (for internal use)
            # In production, use proper JWT library with verification
            parts = token.split(".")
            if len(parts) != 3:
                return None

            import base64
            import json

            # Decode payload (add padding if needed)
            payload = parts[1]
            payload += "=" * (4 - len(payload) % 4)
            decoded = base64.urlsafe_b64decode(payload)
            claims = json.loads(decoded)

            return claims.get("tenant_id")

        except Exception as e:
            logger.debug(f"Failed to extract tenant from token: {e}")
            return None

    def resolve_tenant(
        self,
        host: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        token: Optional[str] = None
    ) -> Optional[str]:
        """
        Resolve tenant ID using priority order: subdomain > header > token.

        Args:
            host: HTTP Host header
            headers: Request headers dictionary
            token: JWT token string

        Returns:
            Resolved tenant ID or default tenant ID
        """
        # Priority 1: Subdomain
        if host:
            tenant_id = self.resolve_from_subdomain(host)
            if tenant_id:
                logger.debug(f"Resolved tenant from subdomain: {tenant_id}")
                return tenant_id

        # Priority 2: Header
        if headers:
            tenant_id = self.resolve_from_header(headers)
            if tenant_id:
                logger.debug(f"Resolved tenant from header: {tenant_id}")
                return tenant_id

        # Priority 3: Token
        if token:
            tenant_id = self.resolve_from_token(token)
            if tenant_id:
                logger.debug(f"Resolved tenant from token: {tenant_id}")
                return tenant_id

        # Fallback to default
        logger.debug(f"Using default tenant: {self.config.default_tenant_id}")
        return self.config.default_tenant_id


class TenantStore:
    """
    Persistent storage for tenant configurations.
    Supports JSON file storage with in-memory caching.
    """

    def __init__(self, config: TenantConfig):
        self.config = config
        self.storage_path = Path(config.storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, Tenant] = {}
        self._load_all_tenants()

    def _get_tenant_file(self, tenant_id: str) -> Path:
        """Get the file path for a tenant's data."""
        return self.storage_path / f"{tenant_id}.json"

    def _load_all_tenants(self) -> None:
        """Load all tenant configurations from storage."""
        for file_path in self.storage_path.glob("*.json"):
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    tenant = Tenant.from_dict(data)
                    self._cache[tenant.tenant_id] = tenant
            except Exception as e:
                logger.warning(f"Failed to load tenant from {file_path}: {e}")

        logger.info(f"Loaded {len(self._cache)} tenants from storage")

    def get(self, tenant_id: str) -> Optional[Tenant]:
        """
        Get tenant by ID.

        Args:
            tenant_id: Unique tenant identifier

        Returns:
            Tenant instance or None if not found
        """
        # Check cache first
        if tenant_id in self._cache:
            return self._cache[tenant_id]

        # Try loading from storage
        file_path = self._get_tenant_file(tenant_id)
        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    data = json.load(f)
                    tenant = Tenant.from_dict(data)
                    self._cache[tenant_id] = tenant
                    return tenant
            except Exception as e:
                logger.error(f"Failed to load tenant {tenant_id}: {e}")

        return None

    def save(self, tenant: Tenant) -> bool:
        """
        Save tenant configuration to storage.

        Args:
            tenant: Tenant instance to save

        Returns:
            True if saved successfully
        """
        try:
            file_path = self._get_tenant_file(tenant.tenant_id)
            tenant.updated_at = datetime.utcnow().isoformat()

            with open(file_path, "w") as f:
                json.dump(tenant.to_dict(), f, indent=2)

            self._cache[tenant.tenant_id] = tenant
            logger.info(f"Saved tenant: {tenant.tenant_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to save tenant {tenant.tenant_id}: {e}")
            return False

    def delete(self, tenant_id: str) -> bool:
        """
        Delete tenant from storage.

        Args:
            tenant_id: Tenant ID to delete

        Returns:
            True if deleted successfully
        """
        try:
            file_path = self._get_tenant_file(tenant_id)
            if file_path.exists():
                file_path.unlink()

            if tenant_id in self._cache:
                del self._cache[tenant_id]

            logger.info(f"Deleted tenant: {tenant_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete tenant {tenant_id}: {e}")
            return False

    def list_all(self, status: Optional[TenantStatus] = None) -> List[Tenant]:
        """
        List all tenants optionally filtered by status.

        Args:
            status: Optional status filter

        Returns:
            List of Tenant instances
        """
        tenants = list(self._cache.values())

        if status:
            tenants = [t for t in tenants if t.status == status]

        return tenants

    def create_tenant(
        self,
        tenant_id: str,
        name: str,
        tier: TierType = TierType.FREE,
        **kwargs
    ) -> Tenant:
        """
        Create a new tenant.

        Args:
            tenant_id: Unique tenant identifier
            name: Human-readable tenant name
            tier: Subscription tier
            **kwargs: Additional tenant properties

        Returns:
            Created Tenant instance
        """
        tenant = Tenant(
            tenant_id=tenant_id,
            name=name,
            status=TenantStatus.TRIAL,
            tier=tier,
            created_at=datetime.utcnow().isoformat(),
            metadata=kwargs.get("metadata", {})
        )

        # Apply tier-based limits
        tenant.limits = self._get_limits_for_tier(tier)
        tenant.branding = kwargs.get("branding", TenantBranding())

        self.save(tenant)
        return tenant

    def _get_limits_for_tier(self, tier: TierType) -> TenantLimits:
        """Get default limits for a subscription tier."""
        limits_map = {
            TierType.FREE: TenantLimits(
                max_users=1,
                max_specs=5,
                max_agents=3,
                max_storage_mb=500,
                api_calls_per_minute=30,
                concurrent_sessions=1,
                enable_team_features=False,
                enable_custom_branding=False,
                enable_sso=False,
                enable_priority_queue=False,
            ),
            TierType.STARTER: TenantLimits(
                max_users=5,
                max_specs=25,
                max_agents=10,
                max_storage_mb=5000,
                api_calls_per_minute=100,
                concurrent_sessions=3,
                enable_team_features=True,
                enable_custom_branding=False,
                enable_sso=False,
                enable_priority_queue=False,
            ),
            TierType.PROFESSIONAL: TenantLimits(
                max_users=20,
                max_specs=100,
                max_agents=50,
                max_storage_mb=20000,
                api_calls_per_minute=500,
                concurrent_sessions=10,
                enable_team_features=True,
                enable_custom_branding=True,
                enable_sso=False,
                enable_priority_queue=True,
            ),
            TierType.ENTERPRISE: TenantLimits(
                max_users=9999,
                max_specs=9999,
                max_agents=9999,
                max_storage_mb=999999,
                api_calls_per_minute=10000,
                concurrent_sessions=100,
                enable_team_features=True,
                enable_custom_branding=True,
                enable_sso=True,
                enable_priority_queue=True,
            ),
        }
        return limits_map.get(tier, limits_map[TierType.FREE])


class TenantRateLimiter:
    """
    Per-tenant rate limiting using Redis sliding window algorithm.

    Features:
    - Per-tenant rate limits
    - Per-endpoint limits
    - Configurable time windows
    - Distributed support via Redis
    """

    def __init__(
        self,
        redis_client: Optional[Redis] = None,
        config: Optional[TenantConfig] = None
    ):
        self.redis = redis_client
        self.config = config or TenantConfig()
        self._local_counters: Dict[str, List[float]] = {}

    def _get_redis_key(self, tenant_id: str, endpoint: str = "*") -> str:
        """Generate Redis key for rate limit counter."""
        return f"{self.config.redis_prefix}:ratelimit:{tenant_id}:{endpoint}"

    def check_rate_limit(
        self,
        tenant_id: str,
        limit: int,
        window_seconds: int = 60,
        endpoint: str = "*"
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check if tenant has exceeded rate limit.

        Args:
            tenant_id: Tenant identifier
            limit: Maximum requests allowed
            window_seconds: Time window in seconds
            endpoint: Endpoint identifier (default: "*")

        Returns:
            Tuple of (allowed: bool, info: dict with remaining requests)
        """
        key = self._get_redis_key(tenant_id, endpoint)
        now = time.time()
        window_start = now - window_seconds

        if self.redis:
            return self._check_redis(key, limit, window_seconds, now, window_start)
        else:
            return self._check_local(key, limit, window_seconds, now, window_start)

    def _check_redis(
        self,
        key: str,
        limit: int,
        window_seconds: int,
        now: float,
        window_start: float
    ) -> Tuple[bool, Dict[str, int]]:
        """Check rate limit using Redis."""
        try:
            pipe = self.redis.pipeline()

            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)

            # Count current requests
            pipe.zcard(key)

            # Add current request
            pipe.zadd(key, {str(now): now})

            # Set expiration
            pipe.expire(key, window_seconds + 1)

            results = pipe.execute()
            current_count = results[1]

            remaining = max(0, limit - current_count)
            allowed = current_count < limit

            return allowed, {
                "limit": limit,
                "remaining": remaining,
                "used": current_count,
                "reset": int(now + window_seconds)
            }

        except RedisError as e:
            logger.warning(f"Redis rate limit error, falling back: {e}")
            return self._check_local(key, limit, window_seconds, now, window_start)

    def _check_local(
        self,
        key: str,
        limit: int,
        window_seconds: int,
        now: float,
        window_start: float
    ) -> Tuple[bool, Dict[str, int]]:
        """Check rate limit using local counters."""
        if key not in self._local_counters:
            self._local_counters[key] = []

        # Remove expired entries
        self._local_counters[key] = [
            t for t in self._local_counters[key] if t > window_start
        ]

        current_count = len(self._local_counters[key])
        allowed = current_count < limit

        if allowed:
            self._local_counters[key].append(now)

        remaining = max(0, limit - current_count - 1)

        return allowed, {
            "limit": limit,
            "remaining": remaining,
            "used": current_count,
            "reset": int(now + window_seconds)
        }

    def check_tenant_limits(self, tenant: Tenant) -> Tuple[bool, List[str]]:
        """
        Check all tenant limits against current usage.

        Args:
            tenant: Tenant to check

        Returns:
            Tuple of (all_passed: bool, errors: list of error messages)
        """
        errors = []

        # API rate limit
        allowed, info = self.check_rate_limit(
            tenant.tenant_id,
            tenant.limits.api_calls_per_minute,
            60
        )

        if not allowed:
            errors.append(
                f"API rate limit exceeded: {info['used']}/{info['limit']} per minute"
            )

        # Additional limit checks would go here
        # - Concurrent sessions
        # - Storage usage
        # - User count

        return len(errors) == 0, errors


class TenantMiddleware:
    """
    Middleware for automatic tenant context management.

    Automatically:
    1. Resolves tenant from request
    2. Loads tenant configuration
    3. Sets tenant context
    4. Enforces rate limits
    5. Cleans up context after request
    """

    def __init__(
        self,
        config: Optional[TenantConfig] = None,
        tenant_store: Optional[TenantStore] = None,
        rate_limiter: Optional[TenantRateLimiter] = None
    ):
        self.config = config or TenantConfig()
        self.resolver = TenantResolver(self.config)
        self.store = tenant_store or TenantStore(self.config)
        self.rate_limiter = rate_limiter or TenantRateLimiter(config=self.config)

    def process_request(
        self,
        host: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        token: Optional[str] = None
    ) -> Tenant:
        """
        Process incoming request and set tenant context.

        Args:
            host: HTTP Host header
            headers: Request headers
            token: JWT token

        Returns:
            Resolved Tenant instance

        Raises:
            TenantNotFoundError: If tenant not found
            TenantInactiveError: If tenant is not active
            TenantLimitExceededError: If tenant exceeded limits
        """
        # In single-tenant mode, skip all resolution
        if not self.config.enabled:
            default = get_default_tenant()
            set_tenant(default)
            return default

        # Resolve tenant ID
        tenant_id = self.resolver.resolve_tenant(host, headers, token)

        # Load tenant
        tenant = self.store.get(tenant_id)
        if not tenant:
            logger.warning(f"Tenant not found: {tenant_id}, creating default")
            tenant = self.store.create_tenant(
                tenant_id=tenant_id,
                name=f"Tenant {tenant_id}",
                tier=TierType.FREE
            )

        # Check status
        if tenant.status != TenantStatus.ACTIVE and tenant.status != TenantStatus.TRIAL:
            raise TenantInactiveError(
                f"Tenant {tenant_id} is not active. Status: {tenant.status.value}"
            )

        # Check rate limits
        if self.config.enable_rate_limiting:
            passed, errors = self.rate_limiter.check_tenant_limits(tenant)
            if not passed:
                from core.tenant_context import TenantLimitExceededError
                raise TenantLimitExceededError(
                    "rate_limit",
                    0,
                    tenant.limits.api_calls_per_minute
                )

        # Set context
        set_tenant(tenant)
        return tenant

    def cleanup_request(self) -> None:
        """Clean up tenant context after request."""
        clear_tenant()


def require_tenant(func: Callable) -> Callable:
    """
    Decorator to require tenant context for a function.

    Raises:
        TenantNotFoundError: If no tenant context is set
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if is_multi_tenant_mode():
            tenant = get_tenant_safe()
            if tenant is None:
                raise TenantNotFoundError(
                    f"Function {func.__name__} requires tenant context"
                )
        return func(*args, **kwargs)
    return wrapper


def with_tenant(tenant_id: str) -> Callable:
    """
    Decorator to execute function with specific tenant context.

    Args:
        tenant_id: Tenant ID to use for execution
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # This requires access to tenant store
            # In real implementation, use dependency injection
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Global middleware instance
_middleware_instance: Optional[TenantMiddleware] = None


def get_middleware() -> TenantMiddleware:
    """Get or create global tenant middleware instance."""
    global _middleware_instance

    if _middleware_instance is None:
        config = TenantConfig(
            enabled=is_multi_tenant_mode(),
            storage_path=os.getenv(
                "TENANT_STORAGE_PATH",
                ".auto-claude/tenants"
            )
        )

        # Try to initialize Redis if available
        redis_client = None
        if config.enable_rate_limiting:
            try:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                redis_client = Redis.from_url(redis_url, decode_responses=True)
                redis_client.ping()
            except Exception as e:
                logger.warning(f"Redis not available for rate limiting: {e}")

        rate_limiter = TenantRateLimiter(
            redis_client=redis_client,
            config=config
        ) if config.enable_rate_limiting else None

        _middleware_instance = TenantMiddleware(
            config=config,
            rate_limiter=rate_limiter
        )

    return _middleware_instance


def clear_tenant() -> None:
    """Clear the current tenant context."""
    from core.tenant_context import clear_tenant as _clear
    _clear()


# Export key classes and functions
__all__ = [
    "TenantConfig",
    "TenantResolver",
    "TenantStore",
    "TenantRateLimiter",
    "TenantMiddleware",
    "require_tenant",
    "get_middleware",
    "clear_tenant",
]
