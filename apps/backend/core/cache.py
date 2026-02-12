"""
Multi-Tier Intelligent Caching System
===================================

Provides a comprehensive caching layer with three tiers:

L1 Cache (In-Memory):
- Fastest access for hot data
- LRU eviction policy
- Thread-safe operations
- TTL-based expiration

L2 Cache (Redis - Optional):
- Shared cache across processes/containers
- Persistent across restarts
- Network access (slower than L1)
- Requires Redis server

L3 Cache (Graphiti - Knowledge Cache):
- Persistent semantic knowledge storage
- Cross-session learning
- Graph-based relationships
- Used for long-term insights

Design Principles:
- Push frequently accessed data to L1
- Use L2 for shared state across processes
- Use L3 for persistent knowledge and patterns
- Smart invalidation based on content changes
- Graceful degradation (L1 works even without L2/L3)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import pickle
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import (
    Any,
    Callable,
    Generic,
    TypeVar,
    cast,
)

from pydantic import BaseModel, ValidationError, model_validator

logger = logging.getLogger(__name__)

# ============================================================================
# Type Definitions
# ============================================================================

T = TypeVar("T")


class CacheTier(str, Enum):
    """Cache tier identifiers for metrics and debugging."""

    L1_MEMORY = "l1_memory"
    L2_REDIS = "l2_redis"
    L3_GRAPHITI = "l3_graphiti"


class CacheStrategy(str, Enum):
    """Cache eviction strategies."""

    LRU = "lru"  # Least Recently Used
    TTL = "ttl"  # Time To Live
    FIFO = "fifo"  # First In First Out


# ============================================================================
# Cache Entry Models
# ============================================================================


@dataclass
class CacheEntry(Generic[T]):
    """A cached data entry with metadata."""

    value: T
    created_at: float
    accessed_at: float
    access_count: int = 0
    ttl: int | None = None  # Seconds until expiration
    tags: set[str] = field(default_factory=set)
    version: str = "v1"

    def is_expired(self) -> bool:
        """Check if this entry has expired."""
        if self.ttl is None:
            return False
        return time.time() - self.created_at > self.ttl

    def touch(self) -> None:
        """Update access time and count."""
        self.accessed_at = time.time()
        self.access_count += 1


@dataclass
class CacheMetrics:
    """Metrics for cache performance tracking."""

    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    max_size: int = 1000

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate (0.0 to 1.0)."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    @property
    def miss_rate(self) -> float:
        """Calculate cache miss rate (0.0 to 1.0)."""
        return 1.0 - self.hit_rate

    def to_dict(self) -> dict[str, Any]:
        """Convert metrics to dictionary for serialization."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "size": self.size,
            "max_size": self.max_size,
            "hit_rate": self.hit_rate,
            "miss_rate": self.miss_rate,
        }


@dataclass
class CacheConfig:
    """Configuration for cache tiers."""

    # L1 Configuration
    l1_max_size: int = 1000  # Max entries in L1 cache
    l1_default_ttl: int = 300  # 5 minutes default TTL
    l1_enabled: bool = True

    # L2 Configuration
    l2_enabled: bool = False  # Redis disabled by default
    l2_host: str = "localhost"
    l2_port: int = 6379
    l2_db: int = 0
    l2_default_ttl: int = 3600  # 1 hour default TTL
    l2_password: str | None = None

    # L3 Configuration
    l3_enabled: bool = True  # Graphiti enabled by default
    l3_min_score: float = 0.7  # Minimum relevance score
    l3_max_results: int = 10

    # Cache Warming
    warm_on_startup: bool = True
    warm_keys: list[str] = field(default_factory=list)

    # Invalidation
    invalidate_on_write: bool = True
    invalidate_strategy: str = "smart"  # smart, aggressive, conservative

    @classmethod
    def from_env(cls) -> CacheConfig:
        """Create configuration from environment variables."""
        return cls(
            l1_max_size=int(os.getenv("CACHE_L1_MAX_SIZE", "1000")),
            l1_default_ttl=int(os.getenv("CACHE_L1_DEFAULT_TTL", "300")),
            l1_enabled=os.getenv("CACHE_L1_ENABLED", "true").lower() == "true",
            l2_enabled=os.getenv("CACHE_L2_ENABLED", "false").lower() == "true",
            l2_host=os.getenv("CACHE_L2_HOST", "localhost"),
            l2_port=int(os.getenv("CACHE_L2_PORT", "6379")),
            l2_db=int(os.getenv("CACHE_L2_DB", "0")),
            l2_default_ttl=int(os.getenv("CACHE_L2_DEFAULT_TTL", "3600")),
            l2_password=os.getenv("CACHE_L2_PASSWORD"),
            l3_enabled=os.getenv("CACHE_L3_ENABLED", "true").lower() == "true",
            l3_min_score=float(os.getenv("CACHE_L3_MIN_SCORE", "0.7")),
            l3_max_results=int(os.getenv("CACHE_L3_MAX_RESULTS", "10")),
            warm_on_startup=os.getenv("CACHE_WARM_ON_STARTUP", "true").lower() == "true",
        )


# ============================================================================
# L1 Cache: In-Memory LRU Cache
# ============================================================================


class L1Cache(Generic[T]):
    """
    Thread-safe LRU in-memory cache with TTL support.

    Features:
    - LRU eviction when cache is full
    - TTL-based expiration (lazy evaluation)
    - Thread-safe operations
    - Tag-based invalidation
    - Access pattern tracking
    """

    def __init__(
        self,
        max_size: int = 1000,
        default_ttl: int = 300,
        name: str = "default",
    ) -> None:
        """
        Initialize L1 cache.

        Args:
            max_size: Maximum number of entries
            default_ttl: Default TTL in seconds (None = no expiration)
            name: Cache name for logging
        """
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._name = name

        # OrderedDict maintains insertion order for LRU
        self._cache: OrderedDict[str, CacheEntry[T]] = OrderedDict()
        self._tags: dict[str, set[str]] = {}  # tag -> set of keys

        # Thread safety
        self._lock = threading.RLock()

        # Metrics
        self._metrics = CacheMetrics(max_size=max_size)

    def get(self, key: str, default: T | None = None) -> T | None:
        """
        Get a value from cache.

        Args:
            key: Cache key
            default: Value to return if key not found

        Returns:
            Cached value or default if not found/expired
        """
        with self._lock:
            entry = self._cache.get(key)

            if entry is None:
                self._metrics.misses += 1
                return default

            if entry.is_expired():
                # Lazy expiration - remove on access
                self._remove_entry(key)
                self._metrics.misses += 1
                return default

            # Update access for LRU tracking
            entry.touch()

            # Move to end (most recently used)
            self._cache.move_to_end(key)

            self._metrics.hits += 1
            logger.debug(f"[L1:{self._name}] HIT: {key}")
            return entry.value

    def set(
        self,
        key: str,
        value: T,
        ttl: int | None = None,
        tags: set[str] | None = None,
    ) -> None:
        """
        Set a value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (None = use default)
            tags: Tags for group invalidation
        """
        with self._lock:
            ttl = ttl if ttl is not None else self._default_ttl

            # Create new entry
            entry = CacheEntry(
                value=value,
                created_at=time.time(),
                accessed_at=time.time(),
                ttl=ttl,
                tags=tags or set(),
            )

            # Check if we need to evict
            if key not in self._cache and len(self._cache) >= self._max_size:
                self._evict_lru()

            # Add to cache
            self._cache[key] = entry

            # Update tag index
            if entry.tags:
                for tag in entry.tags:
                    if tag not in self._tags:
                        self._tags[tag] = set()
                    self._tags[tag].add(key)

            self._metrics.size = len(self._cache)
            logger.debug(f"[L1:{self._name}] SET: {key} (tags: {entry.tags})")

    def delete(self, key: str) -> bool:
        """
        Delete a key from cache.

        Args:
            key: Cache key to delete

        Returns:
            True if key was found and deleted
        """
        with self._lock:
            if key not in self._cache:
                return False

            self._remove_entry(key)
            return True

    def invalidate_by_tag(self, tag: str) -> int:
        """
        Invalidate all entries with a specific tag.

        Args:
            tag: Tag to invalidate

        Returns:
            Number of entries invalidated
        """
        with self._lock:
            keys = self._tags.get(tag, set())
            count = 0

            for key in list(keys):  # Copy to avoid modification during iteration
                if self.delete(key):
                    count += 1

            logger.info(f"[L1:{self._name}] Invalidated {count} entries with tag '{tag}'")
            return count

    def invalidate_by_prefix(self, prefix: str) -> int:
        """
        Invalidate all keys with a specific prefix.

        Args:
            prefix: Key prefix to match

        Returns:
            Number of entries invalidated
        """
        with self._lock:
            count = 0
            for key in list(self._cache.keys()):
                if key.startswith(prefix):
                    if self.delete(key):
                        count += 1

            logger.info(f"[L1:{self._name}] Invalidated {count} entries with prefix '{prefix}'")
            return count

    def clear(self) -> None:
        """Clear all entries from cache."""
        with self._lock:
            self._cache.clear()
            self._tags.clear()
            self._metrics.size = 0
            logger.info(f"[L1:{self._name}] Cache cleared")

    def get_metrics(self) -> CacheMetrics:
        """Get cache metrics."""
        with self._lock:
            # Update size before returning
            self._metrics.size = len(self._cache)
            return self._metrics

    def get_keys(self) -> list[str]:
        """Get all cache keys."""
        with self._lock:
            return list(self._cache.keys())

    def has(self, key: str) -> bool:
        """Check if key exists and is not expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return False
            if entry.is_expired():
                self._remove_entry(key)
                return False
            return True

    def cleanup_expired(self) -> int:
        """
        Remove all expired entries.

        Returns:
            Number of entries removed
        """
        with self._lock:
            count = 0
            for key in list(self._cache.keys()):
                entry = self._cache.get(key)
                if entry and entry.is_expired():
                    self._remove_entry(key)
                    count += 1

            if count > 0:
                logger.info(f"[L1:{self._name}] Cleaned up {count} expired entries")

            return count

    def _remove_entry(self, key: str) -> None:
        """Remove entry and update tag index (must be called with lock held)."""
        entry = self._cache.get(key)
        if entry:
            # Remove from tag index
            for tag in entry.tags:
                if tag in self._tags:
                    self._tags[tag].discard(key)
                    if not self._tags[tag]:
                        del self._tags[tag]

            # Remove from cache
            del self._cache[key]

    def _evict_lru(self) -> None:
        """Evict the least recently used entry (must be called with lock held)."""
        if not self._cache:
            return

        # First key is LRU ( OrderedDict maintains insertion order)
        lru_key, lru_entry = next(iter(self._cache.items()))
        del self._cache[lru_key]

        # Update tag index
        for tag in lru_entry.tags:
            if tag in self._tags:
                self._tags[tag].discard(lru_key)
                if not self._tags[tag]:
                    del self._tags[tag]

        self._metrics.evictions += 1
        logger.debug(f"[L1:{self._name}] Evicted LRU key: {lru_key}")


# ============================================================================
# L2 Cache: Redis Integration
# ============================================================================


class L2Cache(Generic[T]):
    """
    Redis-based shared cache with LRU and TTL support.

    Features:
    - Shared across processes/containers
    - Persistent across restarts
    - Graceful degradation when Redis unavailable
    - Tag-based invalidation
    - Connection pooling
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: str | None = None,
        default_ttl: int = 3600,
        name: str = "default",
    ) -> None:
        """
        Initialize L2 Redis cache.

        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
            password: Redis password
            default_ttl: Default TTL in seconds
            name: Cache name for logging
        """
        self._host = host
        self._port = port
        self._db = db
        self._password = password
        self._default_ttl = default_ttl
        self._name = name

        self._client: Any | None = None  # redis.Redis client
        self._enabled = False
        self._metrics = CacheMetrics(max_size=10000)  # Redis can hold more

    def connect(self) -> bool:
        """
        Connect to Redis server.

        Returns:
            True if connection succeeded
        """
        try:
            import redis  # Import only when needed

            self._client = redis.Redis(
                host=self._host,
                port=self._port,
                db=self._db,
                password=self._password,
                decode_responses=False,  # Handle binary data
                socket_connect_timeout=2,
                socket_timeout=2,
            )

            # Test connection
            self._client.ping()

            self._enabled = True
            logger.info(f"[L2:{self._name}] Connected to Redis at {self._host}:{self._port}")
            return True

        except ImportError:
            logger.warning("[L2] redis package not installed. Install with: pip install redis")
            return False
        except Exception as e:
            logger.warning(f"[L2:{self._name}] Failed to connect to Redis: {e}")
            self._enabled = False
            return False

    def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            try:
                self._client.close()
                logger.info(f"[L2:{self._name}] Disconnected from Redis")
            except Exception as e:
                logger.warning(f"[L2:{self._name}] Error disconnecting: {e}")
            finally:
                self._enabled = False
                self._client = None

    def get(self, key: str, default: T | None = None) -> T | None:
        """
        Get a value from Redis cache.

        Args:
            key: Cache key
            default: Value to return if key not found

        Returns:
            Cached value or default
        """
        if not self._enabled or not self._client:
            self._metrics.misses += 1
            return default

        try:
            # Get serialized data
            data = self._client.get(self._make_key(key))

            if data is None:
                self._metrics.misses += 1
                logger.debug(f"[L2:{self._name}] MISS: {key}")
                return default

            # Deserialize
            entry = pickle.loads(data)

            if entry.is_expired():
                self.delete(key)
                self._metrics.misses += 1
                return default

            # Update access time in Redis (keep hot data fresh)
            entry.touch()
            self._client.setex(
                self._make_key(key),
                entry.ttl or self._default_ttl,
                pickle.dumps(entry),
            )

            self._metrics.hits += 1
            logger.debug(f"[L2:{self._name}] HIT: {key}")
            return entry.value

        except Exception as e:
            logger.warning(f"[L2:{self._name}] Error getting {key}: {e}")
            self._metrics.misses += 1
            return default

    def set(
        self,
        key: str,
        value: T,
        ttl: int | None = None,
        tags: set[str] | None = None,
    ) -> bool:
        """
        Set a value in Redis cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            tags: Tags for group invalidation

        Returns:
            True if successful
        """
        if not self._enabled or not self._client:
            return False

        try:
            ttl = ttl if ttl is not None else self._default_ttl

            entry = CacheEntry(
                value=value,
                created_at=time.time(),
                accessed_at=time.time(),
                ttl=ttl,
                tags=tags or set(),
            )

            # Store with TTL
            self._client.setex(
                self._make_key(key),
                ttl,
                pickle.dumps(entry),
            )

            # Store tag associations
            if entry.tags:
                for tag in entry.tags:
                    tag_key = self._make_tag_key(tag)
                    self._client.sadd(tag_key, key)
                    self._client.expire(tag_key, ttl)

            logger.debug(f"[L2:{self._name}] SET: {key} (ttl: {ttl}s)")
            return True

        except Exception as e:
            logger.warning(f"[L2:{self._name}] Error setting {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete a key from Redis cache.

        Args:
            key: Cache key to delete

        Returns:
            True if key was found and deleted
        """
        if not self._enabled or not self._client:
            return False

        try:
            result = self._client.delete(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.warning(f"[L2:{self._name}] Error deleting {key}: {e}")
            return False

    def invalidate_by_tag(self, tag: str) -> int:
        """
        Invalidate all entries with a specific tag.

        Args:
            tag: Tag to invalidate

        Returns:
            Number of entries invalidated
        """
        if not self._enabled or not self._client:
            return 0

        try:
            tag_key = self._make_tag_key(tag)
            keys = self._client.smembers(tag_key)

            if not keys:
                return 0

            # Delete all keys with this tag
            pipeline = self._client.pipeline()
            for key in keys:
                pipeline.delete(self._make_key(key.decode() if isinstance(key, bytes) else key))
            pipeline.delete(tag_key)
            pipeline.execute()

            count = len(keys)
            logger.info(f"[L2:{self._name}] Invalidated {count} entries with tag '{tag}'")
            return count

        except Exception as e:
            logger.warning(f"[L2:{self._name}] Error invalidating tag '{tag}': {e}")
            return 0

    def invalidate_by_prefix(self, prefix: str) -> int:
        """
        Invalidate all keys with a specific prefix.

        Args:
            prefix: Key prefix to match

        Returns:
            Number of entries invalidated
        """
        if not self._enabled or not self._client:
            return 0

        try:
            pattern = f"{self._make_key('')}{prefix}*"
            keys = self._client.keys(pattern)

            if not keys:
                return 0

            count = len(keys)
            self._client.delete(*keys)

            logger.info(f"[L2:{self._name}] Invalidated {count} entries with prefix '{prefix}'")
            return count

        except Exception as e:
            logger.warning(f"[L2:{self._name}] Error invalidating prefix '{prefix}': {e}")
            return 0

    def clear(self) -> bool:
        """
        Clear all entries from Redis cache.

        Returns:
            True if successful
        """
        if not self._enabled or not self._client:
            return False

        try:
            pattern = f"{self._make_key('')}"
            keys = self._client.keys(f"{pattern}*")

            if keys:
                self._client.delete(*keys)
                logger.info(f"[L2:{self._name}] Cleared {len(keys)} entries")

            return True

        except Exception as e:
            logger.warning(f"[L2:{self._name}] Error clearing cache: {e}")
            return False

    def get_metrics(self) -> CacheMetrics:
        """Get cache metrics."""
        return self._metrics

    def has(self, key: str) -> bool:
        """Check if key exists."""
        if not self._enabled or not self._client:
            return False

        try:
            return self._client.exists(self._make_key(key)) > 0
        except Exception:
            return False

    def _make_key(self, key: str) -> str:
        """Create a full Redis key with namespace."""
        return f"cache:{self._name}:{key}"

    def _make_tag_key(self, tag: str) -> str:
        """Create a Redis key for tag storage."""
        return f"cache:tags:{self._name}:{tag}"


# ============================================================================
# Multi-Tier Cache Manager
# ============================================================================


class MultiTierCache(Generic[T]):
    """
    Multi-tier cache manager with intelligent promotion/demotion.

    Cache Hierarchy:
    1. L1 (Memory) - Fastest, checked first
    2. L2 (Redis) - Fast, checked second (optional)
    3. L3 (Graphiti) - Slower, checked last (knowledge)

    Features:
    - Automatic cache promotion from lower tiers
    - Write-back to all tiers
    - Smart invalidation across tiers
    - Graceful degradation (L1 works without L2/L3)
    - Comprehensive metrics
    """

    def __init__(
        self,
        config: CacheConfig | None = None,
        name: str = "default",
    ) -> None:
        """
        Initialize multi-tier cache.

        Args:
            config: Cache configuration
            name: Cache name for namespacing
        """
        self._config = config or CacheConfig.from_env()
        self._name = name

        # Initialize tiers
        self._l1 = L1Cache[T](
            max_size=self._config.l1_max_size,
            default_ttl=self._config.l1_default_ttl,
            name=name,
        )

        self._l2: L2Cache[T] | None = None
        if self._config.l2_enabled:
            self._l2 = L2Cache[T](
                host=self._config.l2_host,
                port=self._config.l2_port,
                db=self._config.l2_db,
                password=self._config.l2_password,
                default_ttl=self._config.l2_default_ttl,
                name=name,
            )

        self._l3_enabled = self._config.l3_enabled

        # Metrics for all tiers
        self._tier_metrics: dict[CacheTier, CacheMetrics] = {
            CacheTier.L1_MEMORY: self._l1.get_metrics(),
            CacheTier.L2_REDIS: CacheMetrics(max_size=10000),
            CacheTier.L3_GRAPHITI: CacheMetrics(max_size=100000),
        }

        # Connect to L2 if enabled
        if self._l2:
            self._l2.connect()

        logger.info(
            f"[Cache:{name}] Initialized with L1, "
            f"L2={'enabled' if self._l2 else 'disabled'}, "
            f"L3={'enabled' if self._l3_enabled else 'disabled'}"
        )

    def get(self, key: str, default: T | None = None) -> T | None:
        """
        Get a value from the cache (checks all tiers).

        Args:
            key: Cache key
            default: Value to return if not found in any tier

        Returns:
            Cached value or default
        """
        # Try L1 first (fastest)
        value = self._l1.get(key, None)
        if value is not None:
            return value

        # Try L2 (second fastest)
        if self._l2:
            value = self._l2.get(key, None)
            if value is not None:
                # Promote to L1
                self._l1.set(key, value)
                return value

        # Not found in any tier
        self._tier_metrics[CacheTier.L1_MEMORY].misses += 1
        if self._l2:
            self._tier_metrics[CacheTier.L2_REDIS].misses += 1

        return default

    def set(
        self,
        key: str,
        value: T,
        ttl: int | None = None,
        tags: set[str] | None = None,
        persist_to_l3: bool = False,
    ) -> bool:
        """
        Set a value in all available cache tiers.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (None = use default)
            tags: Tags for group invalidation
            persist_to_l3: Whether to persist to Graphiti (L3)

        Returns:
            True if set in at least one tier
        """
        success = False

        # Always set in L1
        self._l1.set(key, value, ttl, tags)
        success = True

        # Set in L2 if available
        if self._l2:
            if self._l2.set(key, value, ttl, tags):
                success = True

        # Persist to L3 if requested and enabled
        if persist_to_l3 and self._l3_enabled:
            # L3 persistence happens asynchronously via background task
            self._schedule_l3_persist(key, value, tags)

        return success

    def delete(self, key: str) -> bool:
        """
        Delete a key from all cache tiers.

        Args:
            key: Cache key to delete

        Returns:
            True if deleted from at least one tier
        """
        deleted = False

        if self._l1.delete(key):
            deleted = True

        if self._l2 and self._l2.delete(key):
            deleted = True

        # L3 deletion is handled separately via Graphiti API
        if self._l3_enabled:
            self._schedule_l3_delete(key)

        return deleted

    def invalidate_by_tag(self, tag: str) -> int:
        """
        Invalidate all entries with a specific tag across all tiers.

        Args:
            tag: Tag to invalidate

        Returns:
            Total number of entries invalidated
        """
        total = 0
        total += self._l1.invalidate_by_tag(tag)

        if self._l2:
            total += self._l2.invalidate_by_tag(tag)

        # L3 invalidation via semantic search
        if self._l3_enabled:
            total += self._invalidate_l3_by_tag(tag)

        return total

    def invalidate_by_prefix(self, prefix: str) -> int:
        """
        Invalidate all keys with a specific prefix across all tiers.

        Args:
            prefix: Key prefix to match

        Returns:
            Total number of entries invalidated
        """
        total = 0
        total += self._l1.invalidate_by_prefix(prefix)

        if self._l2:
            total += self._l2.invalidate_by_prefix(prefix)

        if self._l3_enabled:
            total += self._invalidate_l3_by_prefix(prefix)

        return total

    def clear(self) -> None:
        """Clear all cache tiers."""
        self._l1.clear()

        if self._l2:
            self._l2.clear()

        logger.info(f"[Cache:{self._name}] All tiers cleared")

    def has(self, key: str) -> bool:
        """Check if key exists in any tier."""
        return self._l1.has(key) or (self._l2.has(key) if self._l2 else False)

    def get_metrics(self) -> dict[str, Any]:
        """
        Get metrics for all cache tiers.

        Returns:
            Dictionary with tier-specific metrics
        """
        self._tier_metrics[CacheTier.L1_MEMORY] = self._l1.get_metrics()

        if self._l2:
            self._tier_metrics[CacheTier.L2_REDIS] = self._l2.get_metrics()

        # Calculate aggregate metrics
        total_hits = sum(m.hits for m in self._tier_metrics.values())
        total_misses = sum(m.misses for m in self._tier_metrics.values())
        total_evictions = sum(m.evictions for m in self._tier_metrics.values())
        total_size = sum(m.size for m in self._tier_metrics.values())

        aggregate_hit_rate = total_hits / (total_hits + total_misses) if (total_hits + total_misses) > 0 else 0.0

        return {
            "aggregate": {
                "hits": total_hits,
                "misses": total_misses,
                "evictions": total_evictions,
                "size": total_size,
                "hit_rate": aggregate_hit_rate,
            },
            "tiers": {
                tier.value: metrics.to_dict()
                for tier, metrics in self._tier_metrics.items()
            },
            "config": {
                "l1_enabled": self._config.l1_enabled,
                "l2_enabled": self._config.l2_enabled and self._l2 is not None,
                "l3_enabled": self._l3_enabled,
                "l1_max_size": self._config.l1_max_size,
            },
        }

    def cleanup(self) -> None:
        """Cleanup expired entries across all tiers."""
        self._l1.cleanup_expired()

        # L2 handles expiration via Redis TTL
        # L3 cleanup is handled by Graphiti

    def close(self) -> None:
        """Close connections and cleanup resources."""
        if self._l2:
            self._l2.disconnect()

        logger.info(f"[Cache:{self._name}] Closed all tiers")

    def _schedule_l3_persist(self, key: str, value: T, tags: set[str] | None) -> None:
        """Schedule persistence to Graphiti (L3) - placeholder for implementation."""
        # This will be implemented when integrating with Graphiti
        pass

    def _schedule_l3_delete(self, key: str) -> None:
        """Schedule deletion from Graphiti (L3) - placeholder for implementation."""
        # This will be implemented when integrating with Graphiti
        pass

    def _invalidate_l3_by_tag(self, tag: str) -> int:
        """Invalidate entries in Graphiti by tag - placeholder for implementation."""
        # This will be implemented when integrating with Graphiti
        return 0

    def _invalidate_l3_by_prefix(self, prefix: str) -> int:
        """Invalidate entries in Graphiti by prefix - placeholder for implementation."""
        # This will be implemented when integrating with Graphiti
        return 0


# ============================================================================
# Global Cache Instances
# ============================================================================

# Global cache instances for different data types
_caches: dict[str, MultiTierCache] = {}
_caches_lock = threading.Lock()


def get_cache(name: str = "default") -> MultiTierCache:
    """
    Get or create a cache instance.

    Args:
        name: Cache name (for namespacing)

    Returns:
        Cache instance
    """
    with _caches_lock:
        if name not in _caches:
            _caches[name] = MultiTierCache(name=name)
        return _caches[name]


def close_all_caches() -> None:
    """Close all cache instances."""
    with _caches_lock:
        for cache in _caches.values():
            cache.close()
        _caches.clear()


# ============================================================================
# Cache Key Utilities
# ============================================================================


def make_cache_key(
    *parts: str,
    namespace: str = "default",
    version: str = "v1",
) -> str:
    """
    Create a consistent cache key from components.

    Args:
        *parts: Key components (e.g., "user", "123", "profile")
        namespace: Key namespace for isolation
        version: Key version for schema changes

    Returns:
        Formatted cache key
    """
    # Join parts with colon, add namespace and version
    key_parts = [namespace, version] + list(parts)
    return ":".join(str(p) for p in key_parts if p)


def hash_key(value: Any) -> str:
    """
    Create a stable hash for use as cache key.

    Args:
        value: Value to hash

    Returns:
        Hex string hash
    """
    if isinstance(value, str):
        value_bytes = value.encode()
    elif isinstance(value, dict):
        value_bytes = json.dumps(value, sort_keys=True).encode()
    elif isinstance(value, (list, tuple)):
        value_bytes = json.dumps(value, sort_keys=True).encode()
    else:
        value_bytes = str(value).encode()

    return hashlib.sha256(value_bytes).hexdigest()[:16]


# ============================================================================
# Offline Detection
# ============================================================================


class OfflineDetector:
    """
    Detect offline mode and queue mutations for sync.

    Features:
    - Network status detection
    - Mutation queue for offline writes
    - Automatic sync when back online
    - Graceful degradation
    """

    def __init__(self) -> None:
        """Initialize offline detector."""
        self._is_offline = False
        self._mutation_queue: list[dict[str, Any]] = []
        self._last_check = 0.0
        self._check_interval = 5.0  # Seconds

    def is_offline(self) -> bool:
        """
        Check if currently offline.

        Returns:
            True if offline detected
        """
        # Lazy check - only check every N seconds
        now = time.time()
        if now - self._last_check > self._check_interval:
            self._check_network()
            self._last_check = now

        return self._is_offline

    def queue_mutation(self, operation: str, key: str, value: Any) -> None:
        """
        Queue a mutation for when back online.

        Args:
            operation: Operation type (set, delete, invalidate)
            key: Cache key
            value: Operation-specific value
        """
        self._mutation_queue.append({
            "operation": operation,
            "key": key,
            "value": value,
            "timestamp": time.time(),
        })

        logger.info(f"[Offline] Queued {operation} on {key} ({len(self._mutation_queue)} queued)")

    def sync_mutations(self, cache: MultiTierCache) -> int:
        """
        Sync queued mutations when back online.

        Args:
            cache: Cache instance to sync to

        Returns:
            Number of mutations synced
        """
        if not self._mutation_queue:
            return 0

        synced = 0

        for mutation in self._mutation_queue[:]:  # Copy to iterate
            op = mutation["operation"]
            key = mutation["key"]
            value = mutation.get("value")

            try:
                if op == "set":
                    cache.set(key, value)
                elif op == "delete":
                    cache.delete(key)
                elif op == "invalidate_tag":
                    cache.invalidate_by_tag(key)  # key is tag name
                elif op == "invalidate_prefix":
                    cache.invalidate_by_prefix(key)  # key is prefix

                self._mutation_queue.remove(mutation)
                synced += 1

            except Exception as e:
                logger.error(f"[Offline] Failed to sync {op} on {key}: {e}")

        logger.info(f"[Offline] Synced {synced}/{len(self._mutation_queue) + synced} mutations")

        # Clear queue if all synced
        if not self._mutation_queue:
            logger.info("[Offline] All mutations synced")

        return synced

    def get_queue_size(self) -> int:
        """Get number of queued mutations."""
        return len(self._mutation_queue)

    def _check_network(self) -> None:
        """Check network connectivity."""
        try:
            # Try to connect to a reliable host
            import socket

            socket.setdefaulttimeout(2)
            socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("8.8.8.8", 53))
            self._is_offline = False

        except Exception:
            self._is_offline = True


# Global offline detector instance
_offline_detector = OfflineDetector()


def get_offline_detector() -> OfflineDetector:
    """Get the global offline detector instance."""
    return _offline_detector
