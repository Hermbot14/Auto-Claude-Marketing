"""
Unified Monitoring Module for Auto Claude Backend

This module provides comprehensive error tracking and performance monitoring
with automatic categorization and user context tracking.

Features:
- Error categorization (API, Database, Git, File I/O, Agent, etc.)
- Performance monitoring for slow operations
- User context tracking (project, operation, agent type)
- Release tracking for version-specific issues
- Sentry integration with privacy-preserving path masking

Error Categories:
- api: External API errors (Claude, GitHub, GitLab, etc.)
- database: Database query and connection errors
- git: Git operation failures (clone, push, worktree)
- file_io: File system errors (read, write, permissions)
- agent: Agent execution errors (planner, coder, qa)
- network: Network connectivity issues
- validation: Input validation failures
- unknown: Uncategorized errors

Performance Metrics:
- Database query duration
- API response time
- File operation duration
- Agent execution time
"""

from __future__ import annotations

import functools
import logging
import time
import traceback
from contextlib import contextmanager
from enum import Enum
from pathlib import Path
from typing import Any, Callable, TypeVar, ParamSpec

# Import sentry module for error tracking
try:
    from core import sentry
except ImportError:
    sentry = None  # pragma: no cover

logger = logging.getLogger(__name__)

T = TypeVar("T")
P = ParamSpec("P")


class ErrorCategory(str, Enum):
    """Error categories for automatic classification."""
    API = "api"
    DATABASE = "database"
    GIT = "git"
    FILE_IO = "file_io"
    AGENT = "agent"
    NETWORK = "network"
    VALIDATION = "validation"
    PERFORMANCE = "performance"
    UNKNOWN = "unknown"


class ErrorSeverity(str, Enum):
    """Error severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MonitoringContext:
    """
    Context information for error tracking.

    Attributes:
        project_dir: Current project directory path
        operation: Operation being performed (e.g., 'create-spec', 'run-build')
        agent_type: Type of agent (planner, coder, qa_reviewer, etc.)
        spec_id: Current spec ID if applicable
        extra: Additional context data
    """

    def __init__(
        self,
        project_dir: Path | str | None = None,
        operation: str | None = None,
        agent_type: str | None = None,
        spec_id: str | None = None,
        **extra: Any,
    ):
        self.project_dir = str(project_dir) if project_dir else None
        self.operation = operation
        self.agent_type = agent_type
        self.spec_id = spec_id
        self.extra = extra

    def to_dict(self) -> dict[str, Any]:
        """Convert context to dictionary for Sentry."""
        return {
            "project_dir": self.project_dir,
            "operation": self.operation,
            "agent_type": self.agent_type,
            "spec_id": self.spec_id,
            **self.extra,
        }


# Global monitoring context (thread-safe for single-threaded operations)
_current_context: MonitoringContext | None = None


def set_monitoring_context(context: MonitoringContext) -> None:
    """Set the global monitoring context."""
    global _current_context
    _current_context = context


def get_monitoring_context() -> MonitoringContext:
    """Get the current monitoring context."""
    global _current_context
    if _current_context is None:
        return MonitoringContext()
    return _current_context


def update_monitoring_context(**updates: Any) -> None:
    """Update specific fields of the current monitoring context."""
    global _current_context
    if _current_context is None:
        _current_context = MonitoringContext(**updates)
    else:
        # Update existing context
        for key, value in updates.items():
            if hasattr(_current_context, key):
                setattr(_current_context, key, value)
            else:
                _current_context.extra[key] = value


@contextmanager
def monitoring_context(**kwargs: Any):
    """
    Context manager for setting monitoring context.

    Usage:
        with monitoring_context(operation="create-spec", agent_type="planner"):
            risky_operation()

    Automatically clears context on exit.
    """
    global _current_context
    old_context = _current_context
    _current_context = MonitoringContext(**kwargs)
    try:
        yield _current_context
    finally:
        _current_context = old_context


def track_error(
    error: Exception,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    message: str | None = None,
    context: MonitoringContext | None = None,
) -> None:
    """
    Track an error with categorization and context.

    Args:
        error: The exception to track
        category: Error category for filtering
        severity: Error severity level
        message: Custom error message (defaults to error message)
        context: Override global context for this specific error
    """
    # Use provided context or fall back to global
    effective_context = context or get_monitoring_context()

    # Default message to error message
    error_message = message or str(error)

    # Log with appropriate level
    log_method = {
        ErrorSeverity.CRITICAL: logger.critical,
        ErrorSeverity.HIGH: logger.error,
        ErrorSeverity.MEDIUM: logger.warning,
        ErrorSeverity.LOW: logger.info,
    }.get(severity, logger.error)

    log_method(
        f"[{category.value.upper()}] {error_message}",
        extra={
            "category": category.value,
            "severity": severity.value,
            "context": effective_context.to_dict() if effective_context else {},
        },
    )

    # Send to Sentry if enabled
    if sentry and sentry.is_enabled():
        # Set tags for filtering
        sentry.set_tag("error_category", category.value)
        sentry.set_tag("severity", severity.value)
        sentry.set_tag("operation", effective_context.operation or "unknown")

        # Set operation context
        sentry.set_context("operation", effective_context.to_dict())

        # Capture exception
        sentry.capture_exception(
            error,
            category=category.value,
            severity=severity.value,
            **effective_context.extra,
        )


def track_api_error(
    error: Exception,
    api_name: str,
    endpoint: str | None = None,
    **extra: Any,
) -> None:
    """
    Track an API-related error.

    Args:
        error: The exception
        api_name: Name of the API (claude, github, gitlab, etc.)
        endpoint: API endpoint if applicable
        **extra: Additional context
    """
    context = get_monitoring_context()
    context.operation = f"api_call_{api_name}"
    context.extra.update({"api_name": api_name, "endpoint": endpoint, **extra})

    track_error(
        error,
        category=ErrorCategory.API,
        severity=ErrorSeverity.HIGH,
        message=f"API Error ({api_name}): {str(error)}",
        context=context,
    )


def track_database_error(
    error: Exception,
    query: str | None = None,
    **extra: Any,
) -> None:
    """
    Track a database-related error.

    Args:
        error: The exception
        query: Query that failed (sanitized)
        **extra: Additional context
    """
    context = get_monitoring_context()
    context.operation = "database_operation"
    context.extra.update({"query": query[:100] if query else None, **extra})

    track_error(
        error,
        category=ErrorCategory.DATABASE,
        severity=ErrorSeverity.HIGH,
        message=f"Database Error: {str(error)}",
        context=context,
    )


def track_git_error(
    error: Exception,
    operation: str,
    repo_path: str | None = None,
    **extra: Any,
) -> None:
    """
    Track a Git-related error.

    Args:
        error: The exception
        operation: Git operation (clone, push, worktree, etc.)
        repo_path: Repository path
        **extra: Additional context
    """
    context = get_monitoring_context()
    context.operation = f"git_{operation}"
    context.extra.update({"git_operation": operation, "repo_path": repo_path, **extra})

    track_error(
        error,
        category=ErrorCategory.GIT,
        severity=ErrorSeverity.MEDIUM,
        message=f"Git Error ({operation}): {str(error)}",
        context=context,
    )


def track_agent_error(
    error: Exception,
    agent_type: str,
    phase: str | None = None,
    **extra: Any,
) -> None:
    """
    Track an agent execution error.

    Args:
        error: The exception
        agent_type: Type of agent (planner, coder, qa_reviewer, etc.)
        phase: Agent phase that failed
        **extra: Additional context
    """
    context = get_monitoring_context()
    context.operation = f"agent_execution_{agent_type}"
    context.agent_type = agent_type
    context.extra.update({"agent_phase": phase, **extra})

    track_error(
        error,
        category=ErrorCategory.AGENT,
        severity=ErrorSeverity.CRITICAL,
        message=f"Agent Error ({agent_type}): {str(error)}",
        context=context,
    )


def track_performance_issue(
    operation: str,
    duration_ms: float,
    threshold_ms: float = 5000,
    **extra: Any,
) -> None:
    """
    Track a performance issue.

    Args:
        operation: Name of the slow operation
        duration_ms: Operation duration in milliseconds
        threshold_ms: Threshold for considering it slow (default: 5s)
        **extra: Additional context
    """
    # Determine severity based on duration
    if duration_ms > 30000:  # > 30 seconds
        severity = ErrorSeverity.CRITICAL
    elif duration_ms > 10000:  # > 10 seconds
        severity = ErrorSeverity.HIGH
    elif duration_ms > threshold_ms:
        severity = ErrorSeverity.MEDIUM
    else:
        severity = ErrorSeverity.LOW

    context = get_monitoring_context()
    context.operation = operation
    context.extra.update({"duration_ms": duration_ms, **extra})

    track_error(
        RuntimeError(f"Performance issue: {operation} took {duration_ms:.0f}ms"),
        category=ErrorCategory.PERFORMANCE,
        severity=severity,
        message=f"Performance: {operation} took {duration_ms:.0f}ms (threshold: {threshold_ms}ms)",
        context=context,
    )


def track_validation_error(
    error: Exception,
    field: str | None = None,
    value: Any = None,
    **extra: Any,
) -> None:
    """
    Track a validation error.

    Args:
        error: The exception
        field: Field that failed validation
        value: Invalid value (sanitized)
        **extra: Additional context
    """
    context = get_monitoring_context()
    context.operation = "validation"
    context.extra.update({
        "field": field,
        "value_type": type(value).__name__ if value else None,
        **extra,
    })

    track_error(
        error,
        category=ErrorCategory.VALIDATION,
        severity=ErrorSeverity.MEDIUM,
        message=f"Validation Error: {str(error)}",
        context=context,
    )


def with_error_tracking(
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    operation: str | None = None,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator to add automatic error tracking to functions.

    Usage:
        @with_error_tracking(category=ErrorCategory.API, operation="fetch-tasks")
        def fetch_tasks():
            # Any exception is automatically tracked
            return api_call()

    Args:
        category: Error category for classification
        severity: Error severity level
        operation: Operation name for context
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Update context with operation name
                effective_operation = operation or func.__name__
                update_monitoring_context(operation=effective_operation)

                track_error(
                    e,
                    category=category,
                    severity=severity,
                    message=f"Error in {effective_operation}",
                )
                raise  # Re-raise for caller to handle

        return wrapper

    return decorator


def track_performance(
    operation: str,
    threshold_ms: float = 5000,
    log_threshold_ms: float = 1000,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator to track performance of functions.

    Automatically logs warnings if function exceeds thresholds.

    Usage:
        @track_performance(operation="database-query", threshold_ms=5000)
        def fetch_tasks():
            # Execution time is tracked
            return db.query(...)

    Args:
        operation: Name of the operation
        threshold_ms: Threshold for error tracking (default: 5s)
        log_threshold_ms: Threshold for warning logs (default: 1s)
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start) * 1000

                # Log if exceeds warning threshold
                if duration_ms > log_threshold_ms:
                    logger.warning(
                        f"[Performance] {operation} took {duration_ms:.0f}ms",
                        extra={"operation": operation, "duration_ms": duration_ms},
                    )

                # Track as error if exceeds critical threshold
                if duration_ms > threshold_ms:
                    track_performance_issue(operation, duration_ms, threshold_ms)

                return result
            except Exception as e:
                # Track any exceptions
                track_error(e, category=ErrorCategory.PERFORMANCE, operation=operation)
                raise

        return wrapper

    return decorator


@contextmanager
def track_operation(operation: str, threshold_ms: float = 5000):
    """
    Context manager for tracking operation performance.

    Usage:
        with track_operation("spec-creation", threshold_ms=10000):
            create_spec()

    Automatically tracks duration and reports issues.

    Args:
        operation: Name of the operation
        threshold_ms: Threshold for error tracking
    """
    start = time.perf_counter()
    update_monitoring_context(operation=operation)

    try:
        yield
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        if duration_ms > threshold_ms:
            track_performance_issue(operation, duration_ms, threshold_ms)
        else:
            logger.debug(
                f"[Monitoring] {operation} completed in {duration_ms:.0f}ms"
            )


def initialize_monitoring(component: str = "backend") -> bool:
    """
    Initialize the monitoring system.

    Initializes Sentry if available and configured.
    Logs initialization status.

    Args:
        component: Component name for tagging

    Returns:
        True if monitoring is enabled, False otherwise
    """
    if sentry:
        enabled = sentry.init_sentry(component=component)
        if enabled:
            logger.info(f"[Monitoring] Initialized with Sentry (component: {component})")
        else:
            logger.info("[Monitoring] Sentry disabled (no DSN or development mode)")
        return enabled

    logger.info("[Monitoring] Running without Sentry (sentry_sdk not installed)")
    return False


def get_monitoring_status() -> dict[str, Any]:
    """
    Get current monitoring system status.

    Returns:
        Dictionary with:
        - sentry_enabled: Whether Sentry is active
        - sentry_initialized: Whether Sentry was initialized
        - current_context: Current monitoring context
    """
    return {
        "sentry_enabled": sentry.is_enabled() if sentry else False,
        "sentry_initialized": sentry.is_initialized() if sentry else False,
        "current_context": get_monitoring_context().to_dict(),
    }


class OperationTracker:
    """
    Helper class for tracking multi-step operations.

    Usage:
        tracker = OperationTracker("batch-import")
        for item in items:
            with tracker.step("process-item", item_id=item.id):
                process_item(item)
        tracker.summary()
    """

    def __init__(self, operation: str):
        self.operation = operation
        self.steps: list[dict[str, Any]] = []
        self.start_time = time.perf_counter()

    @contextmanager
    def step(self, name: str, **context: Any):
        """Track a single step within the operation."""
        step_start = time.perf_counter()
        step_info = {"name": name, "context": context, "start": step_start}

        try:
            yield
            duration_ms = (time.perf_counter() - step_start) * 1000
            step_info["duration_ms"] = duration_ms
            step_info["status"] = "success"
        except Exception as e:
            duration_ms = (time.perf_counter() - step_start) * 1000
            step_info["duration_ms"] = duration_ms
            step_info["status"] = "failed"
            step_info["error"] = str(e)
            raise
        finally:
            self.steps.append(step_info)

    def summary(self) -> dict[str, Any]:
        """Get operation summary including all steps."""
        total_duration_ms = (time.perf_counter() - self.start_time) * 1000

        failed_steps = [s for s in self.steps if s.get("status") == "failed"]
        slow_steps = [
            s for s in self.steps
            if s.get("duration_ms", 0) > 5000
        ]

        summary = {
            "operation": self.operation,
            "total_duration_ms": total_duration_ms,
            "total_steps": len(self.steps),
            "failed_steps": len(failed_steps),
            "slow_steps": len(slow_steps),
            "steps": self.steps,
        }

        # Log summary
        logger.info(f"[Monitoring] Operation summary: {summary}")

        # Track if issues found
        if failed_steps:
            track_error(
                RuntimeError(f"{len(failed_steps)} steps failed"),
                category=ErrorCategory.AGENT,
                severity=ErrorSeverity.HIGH,
                context=MonitoringContext(
                    operation=self.operation,
                    extra={"summary": summary},
                ),
            )

        if slow_steps:
            track_performance_issue(
                f"{self.operation}_slow_steps",
                total_duration_ms,
                5000,
                **{"slow_steps": len(slow_steps)},
            )

        return summary
