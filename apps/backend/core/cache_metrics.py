"""
Cache Metrics and Monitoring
==========================

Provides comprehensive monitoring and metrics for the caching system:

- Real-time hit/miss tracking
- Performance metrics
- Tier-specific statistics
- Export to monitoring systems
- Alerting on degradation
- Cache health checks
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable

from core.cache import CacheMetrics, CacheTier, MultiTierCache

logger = logging.getLogger(__name__)


# ============================================================================
# Metrics Events
# ============================================================================


class MetricType(str, Enum):
    """Types of cache metrics."""

    HIT = "hit"
    MISS = "miss"
    EVICTION = "eviction"
    SIZE = "size"
    LATENCY = "latency"
    ERROR = "error"


@dataclass
class MetricEvent:
    """A single metric event."""

    timestamp: float
    tier: CacheTier
    key: str | None
    metric_type: MetricType
    value: float
    tags: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "timestamp": self.timestamp,
            "tier": self.tier.value,
            "key": self.key,
            "type": self.metric_type.value,
            "value": self.value,
            "tags": self.tags,
        }


# ============================================================================
# Metrics Collector
# ============================================================================


class MetricsCollector:
    """
    Collects and aggregates cache metrics.

    Features:
    - Rolling window of recent events
    - Aggregation by tier and type
    - Percentile calculation
    - Alert thresholds
    """

    def __init__(
        self,
        window_size: int = 1000,
        aggregation_interval: int = 60,
    ) -> None:
        """
        Initialize metrics collector.

        Args:
            window_size: Maximum events to keep in memory
            aggregation_interval: Seconds between aggregations
        """
        self._window_size = window_size
        self._aggregation_interval = aggregation_interval

        # Event storage
        self._events: deque[MetricEvent] = deque(maxlen=window_size)
        self._lock = threading.Lock()

        # Aggregated metrics
        self._aggregated: dict[str, dict[str, Any]] = {}
        self._last_aggregation = 0.0

        # Alert thresholds
        self._alert_thresholds = {
            "hit_rate": 0.5,  # Alert if hit rate below 50%
            "latency_ms": 100,  # Alert if latency above 100ms
            "error_rate": 0.01,  # Alert if error rate above 1%
        }

    def record(
        self,
        tier: CacheTier,
        metric_type: MetricType,
        value: float,
        key: str | None = None,
        tags: dict[str, str] | None = None,
    ) -> None:
        """
        Record a metric event.

        Args:
            tier: Cache tier
            metric_type: Type of metric
            value: Metric value
            key: Cache key (optional)
            tags: Additional tags for grouping
        """
        event = MetricEvent(
            timestamp=time.time(),
            tier=tier,
            key=key,
            metric_type=metric_type,
            value=value,
            tags=tags or {},
        )

        with self._lock:
            self._events.append(event)

        # Check aggregation interval
        if time.time() - self._last_aggregation >= self._aggregation_interval:
            self._aggregate_metrics()

    def get_hit_rate(self, tier: CacheTier | None = None) -> float:
        """
        Calculate cache hit rate.

        Args:
            tier: Specific tier or None for overall

        Returns:
            Hit rate (0.0 to 1.0)
        """
        with self._lock:
            hits = 0
            misses = 0

            for event in self._events:
                if event.metric_type == MetricType.HIT:
                    if tier is None or event.tier == tier:
                        hits += 1
                elif event.metric_type == MetricType.MISS:
                    if tier is None or event.tier == tier:
                        misses += 1

            total = hits + misses
            return hits / total if total > 0 else 0.0

    def get_latency_stats(
        self, tier: CacheTier | None = None
    ) -> dict[str, float]:
        """
        Get latency statistics.

        Args:
            tier: Specific tier or None for overall

        Returns:
            Dictionary with min, max, avg, p50, p95, p99
        """
        with self._lock:
            latencies = [
                event.value
                for event in self._events
                if event.metric_type == MetricType.LATENCY
                and (tier is None or event.tier == tier)
            ]

        if not latencies:
            return {"min": 0, "max": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0}

        sorted_latencies = sorted(latencies)
        n = len(sorted_latencies)

        return {
            "min": sorted_latencies[0],
            "max": sorted_latencies[-1],
            "avg": sum(latencies) / n,
            "p50": sorted_latencies[int(n * 0.5)],
            "p95": sorted_latencies[int(n * 0.95)],
            "p99": sorted_latencies[int(n * 0.99)],
        }

    def get_error_rate(self, tier: CacheTier | None = None) -> float:
        """
        Calculate error rate.

        Args:
            tier: Specific tier or None for overall

        Returns:
            Error rate (0.0 to 1.0)
        """
        with self._lock:
            errors = 0
            total = 0

            for event in self._events:
                if event.metric_type == MetricType.ERROR:
                    if tier is None or event.tier == tier:
                        errors += 1
                        total += 1
                elif tier is None or event.tier == tier:
                    total += 1

            return errors / total if total > 0 else 0.0

    def get_top_keys(
        self, limit: int = 10, tier: CacheTier | None = None
    ) -> list[tuple[str, int]]:
        """
        Get most accessed cache keys.

        Args:
            limit: Maximum number of keys
            tier: Specific tier or None for overall

        Returns:
            List of (key, access_count) tuples
        """
        with self._lock:
            key_counts: dict[str, int] = {}

            for event in self._events:
                if event.key and (tier is None or event.tier == tier):
                    if event.metric_type in (MetricType.HIT, MetricType.MISS):
                        key_counts[event.key] = key_counts.get(event.key, 0) + 1

            sorted_keys = sorted(key_counts.items(), key=lambda x: x[1], reverse=True)
            return sorted_keys[:limit]

    def get_metrics_summary(self) -> dict[str, Any]:
        """
        Get comprehensive metrics summary.

        Returns:
            Dictionary with all metrics
        """
        return {
            "hit_rate": self.get_hit_rate(),
            "latency": self.get_latency_stats(),
            "error_rate": self.get_error_rate(),
            "top_keys": self.get_top_keys(),
            "tiers": {
                "l1": {
                    "hit_rate": self.get_hit_rate(CacheTier.L1_MEMORY),
                    "latency": self.get_latency_stats(CacheTier.L1_MEMORY),
                },
                "l2": {
                    "hit_rate": self.get_hit_rate(CacheTier.L2_REDIS),
                    "latency": self.get_latency_stats(CacheTier.L2_REDIS),
                },
                "l3": {
                    "hit_rate": self.get_hit_rate(CacheTier.L3_GRAPHITI),
                    "latency": self.get_latency_stats(CacheTier.L3_GRAPHITI),
                },
            },
            "events_count": len(self._events),
            "window_size": self._window_size,
        }

    def check_alerts(self) -> list[dict[str, Any]]:
        """
        Check if any alert thresholds are exceeded.

        Returns:
            List of alert dictionaries
        """
        alerts = []

        # Check hit rate
        hit_rate = self.get_hit_rate()
        if hit_rate < self._alert_thresholds["hit_rate"]:
            alerts.append({
                "type": "hit_rate_low",
                "severity": "warning",
                "message": f"Cache hit rate ({hit_rate:.1%}) below threshold ({self._alert_thresholds['hit_rate']:.1%})",
                "value": hit_rate,
                "threshold": self._alert_thresholds["hit_rate"],
            })

        # Check latency
        latency = self.get_latency_stats()
        if latency["avg"] > self._alert_thresholds["latency_ms"]:
            alerts.append({
                "type": "high_latency",
                "severity": "warning",
                "message": f"Average latency ({latency['avg']:.1f}ms) above threshold ({self._alert_thresholds['latency_ms']}ms)",
                "value": latency["avg"],
                "threshold": self._alert_thresholds["latency_ms"],
            })

        # Check error rate
        error_rate = self.get_error_rate()
        if error_rate > self._alert_thresholds["error_rate"]:
            alerts.append({
                "type": "high_error_rate",
                "severity": "critical",
                "message": f"Error rate ({error_rate:.1%}) above threshold ({self._alert_thresholds['error_rate']:.1%})",
                "value": error_rate,
                "threshold": self._alert_thresholds["error_rate"],
            })

        return alerts

    def export_metrics(self) -> list[dict[str, Any]]:
        """
        Export metrics for external systems.

        Returns:
            List of metric dictionaries
        """
        with self._lock:
            return [event.to_dict() for event in self._events]

    def reset(self) -> None:
        """Reset all collected metrics."""
        with self._lock:
            self._events.clear()
            self._aggregated.clear()
            self._last_aggregation = 0.0
            logger.info("[MetricsCollector] Metrics reset")

    def _aggregate_metrics(self) -> None:
        """Aggregate metrics for reporting (must be called with lock held)."""
        self._last_aggregation = time.time()

        # Aggregate by tier and type
        for tier in CacheTier:
            for metric_type in MetricType:
                key = f"{tier.value}:{metric_type.value}"

                # Filter events
                events = [
                    e
                    for e in self._events
                    if e.tier == tier and e.metric_type == metric_type
                ]

                if not events:
                    continue

                # Calculate aggregation
                values = [e.value for e in events]
                self._aggregated[key] = {
                    "count": len(values),
                    "sum": sum(values),
                    "avg": sum(values) / len(values) if values else 0,
                    "min": min(values) if values else 0,
                    "max": max(values) if values else 0,
                    "last_updated": time.time(),
                }


# ============================================================================
# Cache Health Monitor
# ============================================================================


@dataclass
class HealthCheck:
    """Result of a cache health check."""

    tier: CacheTier
    healthy: bool
    latency_ms: float
    error: str | None = None
    timestamp: float = 0.0


class CacheHealthMonitor:
    """
    Monitors health of all cache tiers.

    Features:
    - Periodic health checks
    - Latency monitoring
    - Error detection
    - Automatic recovery actions
    """

    def __init__(
        self,
        cache: MultiTierCache,
        check_interval: int = 30,
    ) -> None:
        """
        Initialize health monitor.

        Args:
            cache: Cache instance to monitor
            check_interval: Seconds between health checks
        """
        self._cache = cache
        self._check_interval = check_interval

        self._last_check = 0.0
        self._health_history: dict[CacheTier, deque[HealthCheck]] = {
            tier: deque(maxlen=100) for tier in CacheTier
        }

        self._is_monitoring = False
        self._lock = threading.Lock()

    def start(self) -> None:
        """Start health monitoring."""
        with self._lock:
            self._is_monitoring = True
        logger.info("[HealthMonitor] Started monitoring")

    def stop(self) -> None:
        """Stop health monitoring."""
        with self._lock:
            self._is_monitoring = False
        logger.info("[HealthMonitor] Stopped monitoring")

    def check_health(self) -> list[HealthCheck]:
        """
        Perform health check on all tiers.

        Returns:
            List of health check results
        """
        results = []
        now = time.time()

        # Check L1
        try:
            start = time.time()
            # L1 is always healthy (in-memory)
            latency = (time.time() - start) * 1000

            results.append(
                HealthCheck(
                    tier=CacheTier.L1_MEMORY,
                    healthy=True,
                    latency_ms=latency,
                    timestamp=now,
                )
            )

            self._health_history[CacheTier.L1_MEMORY].append(
                results[-1]
            )
        except Exception as e:
            results.append(
                HealthCheck(
                    tier=CacheTier.L1_MEMORY,
                    healthy=False,
                    latency_ms=0,
                    error=str(e),
                    timestamp=now,
                )
            )

        # Check L2
        if self._cache._l2:
            try:
                start = time.time()
                # Try a simple operation
                test_key = f"__health_check__{int(now)}"
                self._cache._l2.set(test_key, "test", ttl=10)
                self._cache._l2.get(test_key)
                self._cache._l2.delete(test_key)

                latency = (time.time() - start) * 1000

                results.append(
                    HealthCheck(
                        tier=CacheTier.L2_REDIS,
                        healthy=True,
                        latency_ms=latency,
                        timestamp=now,
                    )
                )

                self._health_history[CacheTier.L2_REDIS].append(
                    results[-1]
                )
            except Exception as e:
                results.append(
                    HealthCheck(
                        tier=CacheTier.L2_REDIS,
                        healthy=False,
                        latency_ms=0,
                        error=str(e),
                        timestamp=now,
                    )
                )

        # Check L3
        if self._cache._l3_enabled:
            # L3 health is assumed healthy if enabled
            results.append(
                HealthCheck(
                    tier=CacheTier.L3_GRAPHITI,
                    healthy=True,
                    latency_ms=0,
                    timestamp=now,
                )
            )

        self._last_check = now
        return results

    def get_health_summary(self) -> dict[str, Any]:
        """
        Get summary of cache health.

        Returns:
            Dictionary with health status
        """
        summary = {
            "overall_healthy": True,
            "tiers": {},
            "last_check": self._last_check,
        }

        for tier, history in self._health_history.items():
            if not history:
                summary["tiers"][tier.value] = {"status": "unknown"}
                continue

            # Get latest check
            latest = history[-1]

            # Calculate health percentage
            recent_checks = list(history)[-10:]  # Last 10 checks
            healthy_count = sum(1 for c in recent_checks if c.healthy)
            health_pct = healthy_count / len(recent_checks) if recent_checks else 1.0

            summary["tiers"][tier.value] = {
                "healthy": latest.healthy,
                "latency_ms": latest.latency_ms,
                "error": latest.error,
                "health_percentage": health_pct,
                "checks_in_window": len(recent_checks),
            }

            if not latest.healthy:
                summary["overall_healthy"] = False

        return summary

    def get_latency_trend(
        self, tier: CacheTier, window: int = 10
    ) -> dict[str, float]:
        """
        Get latency trend for a tier.

        Args:
            tier: Cache tier
            window: Number of recent checks to analyze

        Returns:
            Dictionary with trend metrics
        """
        history = self._health_history.get(tier)

        if not history or len(history) < 2:
            return {"trend": 0, "slope": 0}

        recent = list(history)[-window:]

        if len(recent) < 2:
            return {"trend": 0, "slope": 0}

        # Calculate trend (positive = getting slower)
        latencies = [c.latency_ms for c in recent]
        first_half = latencies[: len(latencies) // 2]
        second_half = latencies[len(latencies) // 2 :]

        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)

        slope = avg_second - avg_first

        return {
            "current": latencies[-1],
            "average": sum(latencies) / len(latencies),
            "slope": slope,
            "trend": "increasing" if slope > 10 else "decreasing" if slope < -10 else "stable",
        }


# ============================================================================
# Cache Instrumentation Decorator
# ============================================================================


def instrumented(
    tier: CacheTier,
    collector: MetricsCollector | None = None,
):
    """
    Decorator to automatically collect cache metrics.

    Args:
        tier: Cache tier being instrumented
        collector: Metrics collector instance

    Returns:
        Decorator function
    """

    def decorator(func: Callable) -> Callable:
        def wrapper(*args, **kwargs):
            start_time = time.time()
            cache_key = kwargs.get("key", args[0] if args else None)

            try:
                result = func(*args, **kwargs)

                # Record hit/miss
                if result is not None:
                    collector.record(
                        tier,
                        MetricType.HIT,
                        time.time() - start_time,
                        key=str(cache_key),
                    )
                else:
                    collector.record(
                        tier,
                        MetricType.MISS,
                        time.time() - start_time,
                        key=str(cache_key),
                    )

                return result

            except Exception as e:
                # Record error
                if collector:
                    collector.record(
                        tier,
                        MetricType.ERROR,
                        0,
                        key=str(cache_key),
                    )

                raise

        return wrapper

    return decorator


# ============================================================================
# Metrics Export
# ============================================================================


class MetricsExporter:
    """
    Export cache metrics to external systems.

    Supports:
    - Prometheus format
    - StatsD format
    - JSON format
    - Custom callbacks
    """

    def __init__(self, collector: MetricsCollector) -> None:
        """
        Initialize metrics exporter.

        Args:
            collector: Metrics collector to export from
        """
        self._collector = collector

    def export_prometheus(self) -> str:
        """
        Export metrics in Prometheus format.

        Returns:
            Prometheus text format
        """
        lines = []
        summary = self._collector.get_metrics_summary()

        # Hit rate
        lines.append(
            f'# HELP cache_hit_rate Cache hit rate (0-1)\n'
            f'# TYPE cache_hit_rate gauge\n'
            f'cache_hit_rate {summary["hit_rate"]:.4f}'
        )

        # Latency
        latency = summary["latency"]
        lines.append(
            f'\n# HELP cache_latency_ms Cache latency in milliseconds\n'
            f'# TYPE cache_latency_ms gauge\n'
            f'cache_latency_ms_avg {latency["avg"]:.4f}\n'
            f'cache_latency_ms_max {latency["max"]:.4f}\n'
            f'cache_latency_ms_p95 {latency["p95"]:.4f}\n'
            f'cache_latency_ms_p99 {latency["p99"]:.4f}'
        )

        # Error rate
        lines.append(
            f'\n# HELP cache_error_rate Cache error rate (0-1)\n'
            f'# TYPE cache_error_rate gauge\n'
            f'cache_error_rate {summary["error_rate"]:.4f}'
        )

        return "\n".join(lines)

    def export_statsd(self, prefix: str = "cache") -> list[str]:
        """
        Export metrics in StatsD format.

        Args:
            prefix: Metric name prefix

        Returns:
            List of StatsD metrics
        """
        summary = self._collector.get_metrics_summary()
        metrics = []

        # Hit rate
        metrics.append(f"{prefix}.hit_rate:{summary['hit_rate']|g}")

        # Latency
        latency = summary["latency"]
        metrics.append(f"{prefix}.latency.avg_ms:{latency['avg']|ms}")
        metrics.append(f"{prefix}.latency.max_ms:{latency['max']|ms}")
        metrics.append(f"{prefix}.latency.p95_ms:{latency['p95']|ms}")

        # Error rate
        metrics.append(f"{prefix}.error_rate:{summary['error_rate']|g}")

        return metrics

    def export_json(self) -> str:
        """
        Export metrics as JSON.

        Returns:
            JSON string of metrics
        """
        import json

        summary = self._collector.get_metrics_summary()
        return json.dumps(summary, indent=2)

    def export_to_callback(
        self, callback: Callable[[dict[str, Any]], None]
    ) -> None:
        """
        Export metrics via callback function.

        Args:
            callback: Function to call with metrics
        """
        callback(self._collector.get_metrics_summary())
