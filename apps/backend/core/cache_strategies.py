"""
Cache Strategies and Intelligent Invalidation
========================================

Provides advanced caching strategies including:

- Smart invalidation based on content changes
- Cache warming for frequently accessed data
- Write-through and write-back policies
- Predictive pre-fetching
- Content-based key generation
- Tag-based hierarchical invalidation
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import (
    Any,
    Callable,
    Coroutine,
    Generic,
    TypeVar,
    cast,
)

from core.cache import (
    CacheConfig,
    CacheEntry,
    CacheTier,
    MultiTierCache,
    get_cache,
    make_cache_key,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ============================================================================
# Strategy Enums
# ============================================================================


class WritePolicy(str, Enum):
    """Cache write policies."""

    WRITE_THROUGH = "write_through"  # Write to all tiers immediately
    WRITE_BACK = "write_back"  # Write to L1, propagate on eviction/interval
    WRITE_AROUND = "write_around"  # Write to L2/L3, skip L1


class InvalidationStrategy(str, Enum):
    """Cache invalidation strategies."""

    SMART = "smart"  # Semantic analysis + pattern matching
    AGGRESSIVE = "aggressive"  # Invalidate broadly on any change
    CONSERVATIVE = "conservative"  # Invalidate minimally
    MANUAL = "manual"  # Only explicit invalidation


class WarmingStrategy(str, Enum):
    """Cache warming strategies."""

    EAGER = "eager"  # Load all warm keys on startup
    LAZY = "lazy"  # Load on first access
    ADAPTIVE = "adaptive"  # Learn access patterns
    PREDICTIVE = "predictive"  # Pre-fetch based on patterns


# ============================================================================
# Content-Based Key Generation
# ============================================================================


@dataclass
class ContentHash:
    """Content hash for smart invalidation."""

    hash: str
    size: int
    modified: float
    dependencies: set[str] = field(default_factory=set)

    @classmethod
    def from_file(cls, path: Path) -> ContentHash | None:
        """Create content hash from file."""
        try:
            stat = path.stat()
            content = path.read_bytes()

            return ContentHash(
                hash=hashlib.sha256(content).hexdigest()[:16],
                size=stat.st_size,
                modified=stat.st_mtime,
            )
        except Exception:
            return None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ContentHash:
        """Create from dictionary (for caching)."""
        return ContentHash(
            hash=data["hash"],
            size=data["size"],
            modified=data["modified"],
            dependencies=set(data.get("dependencies", [])),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary (for caching)."""
        return {
            "hash": self.hash,
            "size": self.size,
            "modified": self.modified,
            "dependencies": list(self.dependencies),
        }


class ContentTracker:
    """
    Track content changes for smart invalidation.

    Maintains:
    - File/directory content hashes
    - Dependency graphs
    - Change detection
    - Incremental invalidation
    """

    def __init__(self, cache: MultiTierCache | None = None) -> None:
        """
        Initialize content tracker.

        Args:
            cache: Cache instance for storing tracking data
        """
        self._cache = cache or get_cache("content_tracker")
        self._tracked: dict[str, ContentHash] = {}

    def track_file(self, path: Path) -> ContentHash | None:
        """
        Track a file for changes.

        Args:
            path: File path to track

        Returns:
            Content hash if tracked successfully
        """
        content_hash = ContentHash.from_file(path)
        if not content_hash:
            return None

        key = make_cache_key("file", str(path))
        existing = self._cache.get(key)

        if existing:
            existing_hash = ContentHash.from_dict(existing)
            if existing_hash.hash != content_hash.hash:
                # File changed - invalidate related caches
                self._invalidate_dependent(path, existing_hash, content_hash)
        else:
            # First time tracking
            self._cache.set(key, content_hash.to_dict(), tags={"file:track"})

        self._tracked[str(path)] = content_hash
        return content_hash

    def track_directory(self, path: Path, pattern: str = "*") -> dict[str, ContentHash]:
        """
        Track all files in a directory.

        Args:
            path: Directory path
            pattern: Glob pattern for files

        Returns:
            Dictionary of path -> content hash
        """
        results = {}

        for file_path in path.glob(pattern):
            if file_path.is_file():
                content_hash = self.track_file(file_path)
                if content_hash:
                    results[str(file_path)] = content_hash

        return results

    def get_dependencies(self, path: str) -> set[str]:
        """
        Get tracked dependencies for a path.

        Args:
            path: File path

        Returns:
            Set of dependent cache keys
        """
        key = make_cache_key("file", path)
        data = self._cache.get(key)

        if data:
            content_hash = ContentHash.from_dict(data)
            return content_hash.dependencies

        return set()

    def add_dependency(self, path: str, cache_key: str) -> None:
        """
        Add a dependency relationship.

        Args:
            path: File path
            cache_key: Cache key that depends on this file
        """
        key = make_cache_key("file", path)
        data = self._cache.get(key)

        if data:
            content_hash = ContentHash.from_dict(data)
            content_hash.dependencies.add(cache_key)
            self._cache.set(key, content_hash.to_dict(), tags={"file:track"})

    def invalidate(self, path: str) -> int:
        """
        Invalidate all cache entries dependent on a path.

        Args:
            path: File path that changed

        Returns:
            Number of entries invalidated
        """
        dependencies = self.get_dependencies(path)

        if not dependencies:
            return 0

        # Invalidate all dependent keys
        count = 0
        for cache_key in dependencies:
            if self._cache.delete(cache_key):
                count += 1

        logger.info(f"[ContentTracker] Invalidated {count} entries for {path}")
        return count

    def _invalidate_dependent(
        self,
        path: Path,
        old_hash: ContentHash,
        new_hash: ContentHash,
    ) -> int:
        """Invalidate dependent caches when content changes."""
        # Check if change is significant (size change or hash difference)
        is_significant = (
            old_hash.hash != new_hash.hash
            or abs(old_hash.size - new_hash.size) > 100  # > 100 byte change
        )

        if is_significant:
            return self.invalidate(str(path))

        return 0


# ============================================================================
# Smart Invalidation Strategy
# ============================================================================


class SmartInvalidator:
    """
    Intelligent cache invalidation based on content and patterns.

    Strategies:
    - Semantic invalidation (understanding data relationships)
    - Pattern-based invalidation (wildcard matching)
    - Time-based invalidation (TTL)
    - Dependency tracking (file changes)
    - Tag-based hierarchical invalidation
    """

    def __init__(
        self,
        cache: MultiTierCache | None = None,
        strategy: InvalidationStrategy = InvalidationStrategy.SMART,
    ) -> None:
        """
        Initialize smart invalidator.

        Args:
            cache: Cache instance
            strategy: Invalidation strategy to use
        """
        self._cache = cache or get_cache("default")
        self._strategy = strategy
        self._content_tracker = ContentTracker(self._cache)

        # Invalidation rules
        self._rules: list[InvalidationRule] = []

        # Statistics
        self._stats = {
            "invalidations": 0,
            "by_strategy": {},
        }

    def add_rule(self, rule: InvalidationRule) -> None:
        """Add an invalidation rule."""
        self._rules.append(rule)
        logger.info(f"[SmartInvalidator] Added rule: {rule.name}")

    def invalidate_on_file_change(self, path: Path) -> int:
        """
        Invalidate cache when a file changes.

        Args:
            path: File that changed

        Returns:
            Number of entries invalidated
        """
        # Update content tracking
        self._content_tracker.track_file(path)

        # Apply matching rules
        total = 0
        for rule in self._rules:
            if rule.matches_file(str(path)):
                count = rule.apply(self._cache)
                total += count
                logger.debug(f"[SmartInvalidator] Rule '{rule.name}' invalidated {count} entries")

        self._stats["invalidations"] += total
        return total

    def invalidate_on_pattern(self, pattern: str) -> int:
        """
        Invalidate cache keys matching a pattern.

        Args:
            pattern: Glob-style pattern (e.g., "user:*", "*:settings")

        Returns:
            Number of entries invalidated
        """
        # Convert glob to regex
        regex = self._pattern_to_regex(pattern)

        # Get all keys from L1
        keys = self._cache._l1.get_keys()

        count = 0
        for key in keys:
            if regex.match(key):
                if self._cache.delete(key):
                    count += 1

        logger.info(f"[SmartInvalidator] Pattern '{pattern}' invalidated {count} entries")
        self._stats["invalidations"] += count
        return count

    def invalidate_by_tags(
        self,
        tags: set[str],
        operator: str = "OR",
    ) -> int:
        """
        Invalidate by tag combinations.

        Args:
            tags: Tags to match
            operator: 'OR' (any tag) or 'AND' (all tags)

        Returns:
            Number of entries invalidated
        """
        count = 0

        for tag in tags:
            count += self._cache.invalidate_by_tag(tag)

        logger.info(
            f"[SmartInvalidator] Tags {tags} ({operator}) invalidated {count} entries"
        )
        return count

    def invalidate_semantic(self, change_type: str, entity: str) -> int:
        """
        Invalidate based on semantic understanding of change.

        Args:
            change_type: Type of change (create, update, delete)
            entity: Type of entity (user, post, comment, etc.)

        Returns:
            Number of entries invalidated
        """
        # Semantic invalidation rules based on change type and entity
        invalidations = []

        if change_type == "delete":
            # Invalidate all related caches
            invalidations.extend([
                f"{entity}:*",
                f"*:{entity}",
                f"{entity}_list:*",
                f"{entity}_count:*",
            ])
        elif change_type == "create":
            # Invalidate list and count caches
            invalidations.extend([
                f"{entity}_list:*",
                f"{entity}_count:*",
            ])
        elif change_type == "update":
            # Invalidate specific entity and related lists
            invalidations.extend([
                f"{entity}:{entity}",
                f"{entity}_list:*",
            ])

        # Apply invalidations
        count = 0
        for pattern in invalidations:
            count += self.invalidate_by_pattern(pattern)

        logger.info(
            f"[SmartInvalidator] Semantic {change_type}:{entity} "
            f"invalidated {count} entries"
        )
        return count

    def get_stats(self) -> dict[str, Any]:
        """Get invalidation statistics."""
        return self._stats.copy()

    def _pattern_to_regex(self, pattern: str) -> re.Pattern:
        """Convert glob pattern to regex."""
        # Escape special regex characters
        regex_pattern = re.escape(pattern)

        # Convert wildcards
        regex_pattern = regex_pattern.replace(r"\*", ".*")

        # Compile
        return re.compile(f"^{regex_pattern}$")


@dataclass
class InvalidationRule:
    """Rule for automatic cache invalidation."""

    name: str
    description: str
    file_patterns: list[str] = field(default_factory=list)
    cache_patterns: list[str] = field(default_factory=list)
    tags: set[str] = field(default_factory=set)
    priority: int = 0

    def matches_file(self, path: str) -> bool:
        """Check if rule matches a file path."""
        for pattern in self.file_patterns:
            if re.match(pattern, path):
                return True
        return False

    def apply(self, cache: MultiTierCache) -> int:
        """Apply invalidation rule to cache."""
        count = 0

        # Invalidate by patterns
        for pattern in self.cache_patterns:
            count += cache.invalidate_by_prefix(pattern)

        # Invalidate by tags
        for tag in self.tags:
            count += cache.invalidate_by_tag(tag)

        return count


# ============================================================================
# Cache Warming
# ============================================================================


@dataclass
class WarmEntry:
    """Entry for cache warming."""

    key: str
    loader: Callable[[], Coroutine[Any, Any, T]] | Callable[[], T]
    ttl: int | None = None
    tags: set[str] = field(default_factory=set)
    priority: int = 0  # Higher = warmed first


class CacheWarmer:
    """
    Intelligent cache warming for optimal performance.

    Strategies:
    - Eager: Load all on startup
    - Lazy: Load on first access
    - Adaptive: Learn access patterns
    - Predictive: Pre-fetch based on patterns
    """

    def __init__(
        self,
        cache: MultiTierCache | None = None,
        strategy: WarmingStrategy = WarmingStrategy.ADAPTIVE,
    ) -> None:
        """
        Initialize cache warmer.

        Args:
            cache: Cache instance
            strategy: Warming strategy
        """
        self._cache = cache or get_cache("default")
        self._strategy = strategy
        self._warm_entries: list[WarmEntry] = []

        # Access pattern tracking for adaptive warming
        self._access_patterns: dict[str, list[float]] = {}
        self._prediction_window = 3600  # 1 hour

    def add_entry(
        self,
        key: str,
        loader: Callable[[], Any] | Callable[[], Coroutine[Any, Any, Any]],
        ttl: int | None = None,
        tags: set[str] | None = None,
        priority: int = 0,
    ) -> None:
        """
        Add an entry to be warmed.

        Args:
            key: Cache key
            loader: Function to load data
            ttl: Time to live for cached data
            tags: Tags for the entry
            priority: Warm priority (higher = first)
        """
        self._warm_entries.append(
            WarmEntry(
                key=key,
                loader=loader,
                ttl=ttl,
                tags=tags or set(),
                priority=priority,
            )
        )

        logger.debug(f"[CacheWarmer] Added warm entry: {key} (priority: {priority})")

    async def warm(self, limit: int | None = None) -> dict[str, Any]:
        """
        Warm the cache with configured entries.

        Args:
            limit: Maximum number of entries to warm

        Returns:
            Warming statistics
        """
        if not self._warm_entries:
            return {"warmed": 0, "errors": 0}

        # Sort by priority
        entries = sorted(self._warm_entries, key=lambda e: e.priority, reverse=True)

        if limit:
            entries = entries[:limit]

        stats = {"warmed": 0, "errors": 0, "skipped": 0}

        for entry in entries:
            # Check if already cached
            if self._cache.has(entry.key):
                stats["skipped"] += 1
                continue

            try:
                # Load data
                if asyncio.iscoroutinefunction(entry.loader):
                    value = await entry.loader()
                else:
                    value = entry.loader()

                # Store in cache
                self._cache.set(
                    entry.key,
                    value,
                    ttl=entry.ttl,
                    tags=entry.tags,
                )

                stats["warmed"] += 1
                logger.debug(f"[CacheWarmer] Warmed: {entry.key}")

            except Exception as e:
                stats["errors"] += 1
                logger.warning(f"[CacheWarmer] Failed to warm {entry.key}: {e}")

        logger.info(
            f"[CacheWarmer] Warmed {stats['warmed']} entries, "
            f"{stats['errors']} errors, {stats['skipped']} already cached"
        )

        return stats

    def record_access(self, key: str) -> None:
        """
        Record access for adaptive learning.

        Args:
            key: Cache key that was accessed
        """
        now = time.time()

        if key not in self._access_patterns:
            self._access_patterns[key] = []

        self._access_patterns[key].append(now)

        # Clean old entries
        cutoff = now - self._prediction_window
        self._access_patterns[key] = [
            t for t in self._access_patterns[key] if t > cutoff
        ]

    def get_predictions(self) -> list[str]:
        """
        Predict which keys will be accessed soon.

        Returns:
            List of keys predicted to be accessed
        """
        if self._strategy != WarmingStrategy.PREDICTIVE:
            return []

        predictions = []
        now = time.time()

        for key, timestamps in self._access_patterns.items():
            if len(timestamps) < 2:
                continue

            # Calculate average interval
            intervals = [
                timestamps[i] - timestamps[i - 1]
                for i in range(1, len(timestamps))
            ]
            avg_interval = sum(intervals) / len(intervals)

            # Predict next access
            last_access = timestamps[-1]
            next_access = last_access + avg_interval

            # If next access is soon, predict it
            if next_access - now < 300:  # Within 5 minutes
                predictions.append(key)

        return predictions

    async def pre_fetch(self) -> int:
        """
        Pre-fetch predicted keys.

        Returns:
            Number of keys pre-fetched
        """
        predictions = self.get_predictions()

        if not predictions:
            return 0

        count = 0
        for key in predictions:
            # Find entry with this key
            entry = next((e for e in self._warm_entries if e.key == key), None)

            if entry and not self._cache.has(key):
                try:
                    if asyncio.iscoroutinefunction(entry.loader):
                        value = await entry.loader()
                    else:
                        value = entry.loader()

                    self._cache.set(entry.key, value, ttl=entry.ttl)
                    count += 1

                except Exception as e:
                    logger.warning(f"[CacheWarmer] Failed to pre-fetch {key}: {e}")

        logger.info(f"[CacheWarmer] Pre-fetched {count} predicted entries")
        return count


# ============================================================================
# Predictive Cache Management
# ============================================================================


class PredictiveCacheManager:
    """
    Predictive cache management based on access patterns.

    Features:
    - Learn access patterns
    - Predict future accesses
    - Pre-fetch likely data
    - Evict unlikely data
    """

    def __init__(
        self,
        cache: MultiTierCache,
        window_size: int = 100,
    ) -> None:
        """
        Initialize predictive manager.

        Args:
            cache: Cache instance to manage
            window_size: Number of accesses to track
        """
        self._cache = cache
        self._window_size = window_size

        # Access history
        self._access_history: list[tuple[str, float]] = []

        # Pattern detection
        self._sequences: dict[tuple[str, ...], int] = {}

        # Next key predictions
        self._predictions: dict[str, float] = {}

    def record_access(self, key: str) -> None:
        """
        Record a cache access for pattern learning.

        Args:
            key: Cache key that was accessed
        """
        now = time.time()
        self._access_history.append((key, now))

        # Keep window size limited
        if len(self._access_history) > self._window_size:
            self._access_history = self._access_history[-self._window_size :]

        # Update sequence counts
        if len(self._access_history) >= 3:
            # Get last 3 keys as a sequence
            sequence = tuple(k for k, _ in self._access_history[-3:])

            if sequence not in self._sequences:
                self._sequences[sequence] = 0

            self._sequences[sequence] += 1

        # Update predictions
        self._update_predictions()

    def get_predicted_keys(self, limit: int = 10) -> list[str]:
        """
        Get keys predicted to be accessed next.

        Args:
            limit: Maximum number of predictions

        Returns:
            List of predicted keys, sorted by likelihood
        """
        if len(self._access_history) < 2:
            return []

        # Get last sequence
        last_sequence = tuple(k for k, _ in self._access_history[-2:])

        # Find matching sequences
        predictions: dict[str, int] = {}

        for sequence, count in self._sequences.items():
            if sequence[:-1] == last_sequence:
                next_key = sequence[-1]
                predictions[next_key] = predictions.get(next_key, 0) + count

        # Sort by count
        sorted_predictions = sorted(
            predictions.items(), key=lambda x: x[1], reverse=True
        )

        return [k for k, _ in sorted_predictions[:limit]]

    def should_pre_fetch(self, key: str) -> bool:
        """
        Check if a key should be pre-fetched.

        Args:
            key: Cache key to check

        Returns:
            True if key should be pre-fetched
        """
        # Pre-fetch if:
        # 1. Not in cache
        # 2. Predicted to be accessed soon
        # 3. Has high confidence
        return (
            not self._cache.has(key)
            and key in self._predictions
            and self._predictions[key] > 0.5  # Confidence threshold
        )

    def get_eviction_candidates(self, count: int = 10) -> list[str]:
        """
        Get keys that are good candidates for eviction.

        Args:
            count: Maximum number of candidates

        Returns:
            List of keys to evict (least likely to be accessed)
        """
        # Get metrics for all keys
        key_scores: dict[str, float] = {}

        # Score based on:
        # - Low access count
        # - Long time since last access
        # - Not predicted to be accessed

        for key, _ in self._cache._l1.get_keys():
            # Get entry info
            entry = self._cache._l1._cache.get(key)

            if not entry:
                continue

            # Calculate eviction score (higher = better to evict)
            time_factor = (time.time() - entry.accessed_at) / 3600  # Hours
            access_factor = 1 / (entry.access_count + 1)  # Rarely accessed
            predict_factor = 0 if key in self._predictions else 1  # Not predicted

            score = time_factor * access_factor * predict_factor
            key_scores[key] = score

        # Sort by score
        sorted_keys = sorted(key_scores.items(), key=lambda x: x[1], reverse=True)

        return [k for k, _ in sorted_keys[:count]]

    def _update_predictions(self) -> None:
        """Update next-access predictions based on history."""
        if len(self._access_history) < 2:
            return

        # Simple Markov chain prediction
        last_key = self._access_history[-1][0]

        # Count what comes after this key
        next_counts: dict[str, int] = {}

        for i in range(len(self._access_history) - 1):
            if self._access_history[i][0] == last_key:
                next_key = self._access_history[i + 1][0]
                next_counts[next_key] = next_counts.get(next_key, 0) + 1

        # Calculate probabilities
        total = sum(next_counts.values())

        if total > 0:
            self._predictions = {
                k: v / total for k, v in next_counts.items()
            }


# ============================================================================
# Cache Utilities
# ============================================================================


def calculate_ttl(
    access_frequency: float,
    data_freshness: str = "medium",
) -> int:
    """
    Calculate appropriate TTL based on access patterns.

    Args:
        access_frequency: Accesses per hour
        data_freshness: Required data freshness (low, medium, high)

    Returns:
        TTL in seconds
    """
    # Base TTL by freshness requirement
    base_ttl = {
        "low": 3600,      # 1 hour - stale data OK
        "medium": 300,    # 5 minutes - moderate freshness
        "high": 60,       # 1 minute - fresh data required
    }.get(data_freshness, 300)

    # Adjust by access frequency
    # High frequency = longer TTL (more likely to be accessed again)
    # Low frequency = shorter TTL (save space)
    if access_frequency > 10:  # > 10 accesses/hour
        return int(base_ttl * 2)
    elif access_frequency > 1:  # 1-10 accesses/hour
        return base_ttl
    else:  # < 1 access/hour
        return int(base_ttl * 0.5)


def calculate_cache_size(
    item_count: int,
    avg_item_size: int,
    hit_rate: float,
) -> dict[str, Any]:
    """
    Calculate optimal cache size based on working set.

    Args:
        item_count: Number of unique items
        avg_item_size: Average item size in bytes
        hit_rate: Current cache hit rate (0.0-1.0)

    Returns:
        Dictionary with size recommendations
    """
    # Working set size
    working_set_bytes = item_count * avg_item_size

    # Target 80% hit rate
    if hit_rate < 0.8:
        # Increase cache size
        recommended = int(working_set_bytes * 1.5)
    else:
        # Current size is adequate
        recommended = int(working_set_bytes * 1.2)

    return {
        "working_set_bytes": working_set_bytes,
        "working_set_mb": working_set_bytes / (1024 * 1024),
        "recommended_bytes": recommended,
        "recommended_mb": recommended / (1024 * 1024),
        "current_hit_rate": hit_rate,
        "items": item_count,
    }


import time
