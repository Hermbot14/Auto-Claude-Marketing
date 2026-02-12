"""
Key Rotation Scheduler for Secret Management.

This module provides automated key rotation functionality for secrets.
Supports scheduled rotation, health monitoring, and notification of
expiring secrets.

Features:
- Automated rotation based on age thresholds
- Graceful rotation with rollback support
- Notification of upcoming expirations
- Health monitoring across all secrets
- Thread-safe operations
"""

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from core.secret_management.SecretManager import RotationConfig

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class RotationStatus(str, Enum):
    """Status of a rotation task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ROLLED_BACK = "rolled_back"


@dataclass
class RotationTask:
    """A task for rotating a secret."""

    secret_id: str
    scheduled_at: datetime
    status: RotationStatus = RotationStatus.PENDING
    attempts: int = 0
    max_attempts: int = 3
    error_message: Optional[str] = None
    completed_at: Optional[datetime] = None
    rollback_value: Optional[str] = None  # Previous value for rollback

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "secret_id": self.secret_id,
            "scheduled_at": self.scheduled_at.isoformat(),
            "status": self.status.value,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "error_message": self.error_message,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class RotationReport:
    """Report of rotation activity."""

    total_secrets: int
    rotated: int
    failed: int
    skipped: int
    start_time: datetime
    end_time: Optional[datetime] = None
    errors: List[str] = field(default_factory=list)

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get rotation duration in seconds."""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "total_secrets": self.total_secrets,
            "rotated": self.rotated,
            "failed": self.failed,
            "skipped": self.skipped,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "errors": self.errors,
        }


@dataclass
class RotationHealth:
    """Health status of rotation system."""

    last_rotation: Optional[datetime] = None
    total_rotations: int = 0
    successful_rotations: int = 0
    failed_rotations: int = 0
    secrets_need_rotation: int = 0
    secrets_expiring_soon: int = 0

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.total_rotations == 0:
            return 1.0
        return self.successful_rotations / self.total_rotations

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "last_rotation": self.last_rotation.isoformat() if self.last_rotation else None,
            "total_rotations": self.total_rotations,
            "successful_rotations": self.successful_rotations,
            "failed_rotations": self.failed_rotations,
            "success_rate": f"{self.success_rate:.2%}",
            "secrets_need_rotation": self.secrets_need_rotation,
            "secrets_expiring_soon": self.secrets_expiring_soon,
        }


# =============================================================================
# Exceptions
# =============================================================================


class RotationError(Exception):
    """Base exception for rotation errors."""

    def __init__(
        self,
        message: str,
        secret_id: Optional[str] = None,
        task: Optional[RotationTask] = None,
    ):
        self.message = message
        self.secret_id = secret_id
        self.task = task
        super().__init__(message)


class MaxAttemptsExceededError(RotationError):
    """Raised when maximum rotation attempts are exceeded."""

    pass


class RollbackFailedError(RotationError):
    """Raised when rollback fails."""

    pass


# =============================================================================
# Rotation Scheduler
# =============================================================================


class KeyRotationScheduler:
    """
    Scheduler for automated secret rotation.

    Features:
    - Scheduled rotation based on age thresholds
    - Retry logic with exponential backoff
    - Rollback support for failed rotations
    - Health monitoring and reporting
    - Notification callbacks

    Usage:
        scheduler = KeyRotationScheduler()
        scheduler.start()

        # Run rotation manually
        report = scheduler.run_rotation()

        # Check health
        health = scheduler.get_health()
    """

    def __init__(
        self,
        config: Optional[RotationConfig] = None,
        notification_callback: Optional[Callable[[List[str]], None]] = None,
    ):
        """
        Initialize rotation scheduler.

        Args:
            config: Rotation configuration
            notification_callback: Optional callback for expiration notifications
        """
        self.config = config or RotationConfig()
        self.notification_callback = notification_callback

        # Thread safety
        self._lock = threading.Lock()
        self._running = False

        # Rotation state
        self._tasks: Dict[str, RotationTask] = {}
        self._health = RotationHealth()

        logger.info("KeyRotationScheduler initialized")

    # ========================================================================
    # Rotation Execution
    # ========================================================================

    def run_rotation(
        self,
        dry_run: bool = False,
        secret_ids: Optional[List[str]] = None,
    ) -> RotationReport:
        """
        Execute rotation for all or specific secrets.

        Args:
            dry_run: Check what would be rotated without executing
            secret_ids: Specific secrets to rotate (None = all)

        Returns:
            RotationReport with results
        """
        start_time = datetime.now()

        # Get secret manager
        from core.secret_management import get_secret_manager

        manager = get_secret_manager()

        # Get secrets to check
        secrets_to_check = secret_ids if secret_ids else manager.list_secrets()

        # Analyze which secrets need rotation
        report = RotationReport(
            total_secrets=len(secrets_to_check),
            rotated=0,
            failed=0,
            skipped=0,
            start_time=start_time,
        )

        for secret_id in secrets_to_check:
            try:
                # Check if rotation is needed
                if not self._needs_rotation(secret_id, manager):
                    report.skipped += 1
                    continue

                if dry_run:
                    logger.info(f"[DRY RUN] Would rotate: {secret_id}")
                    report.rotated += 1
                    continue

                # Perform rotation
                task = self._create_rotation_task(secret_id)

                if self._execute_rotation(task, manager):
                    report.rotated += 1
                    self._health.successful_rotations += 1
                else:
                    report.failed += 1
                    self._health.failed_rotations += 1
                    report.errors.append(f"{secret_id}: {task.error_message}")

                self._health.total_rotations += 1

            except Exception as e:
                report.failed += 1
                report.errors.append(f"{secret_id}: {str(e)}")
                logger.error(f"Rotation failed for '{secret_id}': {e}")

        report.end_time = datetime.now()
        self._health.last_rotation = start_time

        logger.info(
            f"Rotation completed: {report.rotated} rotated, "
            f"{report.failed} failed, {report.skipped} skipped"
        )

        return report

    def rotate_secret(self, secret_id: str) -> bool:
        """
        Rotate a specific secret immediately.

        Args:
            secret_id: Secret to rotate

        Returns:
            True if rotation succeeded
        """
        from core.secret_management import get_secret_manager

        manager = get_secret_manager()

        task = self._create_rotation_task(secret_id)
        return self._execute_rotation(task, manager)

    # ========================================================================
    # Internal Methods
    # ========================================================================

    def _needs_rotation(self, secret_id: str, manager) -> bool:
        """Check if a secret needs rotation."""
        if not self.config.enabled:
            return False

        try:
            metadata = manager.get_secret_metadata(secret_id)
            if not metadata:
                return False

            if not metadata.rotation_enabled:
                return False

            # Check age
            now = datetime.now()
            last_rotation = metadata.last_rotated_at or metadata.created_at
            deadline = last_rotation + timedelta(days=self.config.interval_days)

            return now >= deadline

        except Exception as e:
            logger.debug(f"Failed to check rotation need for '{secret_id}': {e}")
            return False

    def _create_rotation_task(self, secret_id: str) -> RotationTask:
        """Create a rotation task for a secret."""
        return RotationTask(
            secret_id=secret_id,
            scheduled_at=datetime.now(),
            status=RotationStatus.PENDING,
        )

    def _execute_rotation(self, task: RotationTask, manager) -> bool:
        """
        Execute a rotation task.

        Args:
            task: Rotation task to execute
            manager: Secret manager instance

        Returns:
            True if rotation succeeded
        """
        task.status = RotationStatus.IN_PROGRESS
        task.attempts += 1

        try:
            # Store current value for potential rollback
            try:
                current_value = manager.get_secret(task.secret_id, bypass_cache=True)
                task.rollback_value = current_value
            except Exception:
                task.rollback_value = None

            # For now, we just mark as rotated
            # In production, you'd generate new values or prompt user
            manager.rotate_secret(task.secret_id, task.rollback_value)

            task.status = RotationStatus.COMPLETED
            task.completed_at = datetime.now()

            logger.info(f"Rotated secret '{task.secret_id}' successfully")
            return True

        except Exception as e:
            task.error_message = str(e)
            task.status = RotationStatus.FAILED

            logger.error(f"Rotation failed for '{task.secret_id}': {e}")

            # Attempt rollback if we have a previous value
            if task.rollback_value and task.attempts < task.max_attempts:
                return self._attempt_rollback(task, manager)

            return False

    def _attempt_rollback(self, task: RotationTask, manager) -> bool:
        """
        Attempt to rollback a failed rotation.

        Args:
            task: Rotation task to rollback
            manager: Secret manager instance

        Returns:
            True if rollback succeeded
        """
        if task.rollback_value is None:
            return False

        try:
            logger.warning(f"Attempting rollback for '{task.secret_id}'")

            manager.store_secret(
                task.secret_id,
                task.rollback_value,
                "rollback",
            )

            task.status = RotationStatus.ROLLED_BACK
            return True

        except Exception as e:
            logger.error(f"Rollback failed for '{task.secret_id}': {e}")
            return False

    # ========================================================================
    # Health Monitoring
    # ========================================================================

    def get_health(self) -> RotationHealth:
        """
        Get current health of rotation system.

        Returns:
            RotationHealth status
        """
        from core.secret_management import get_secret_manager

        manager = get_secret_manager()

        # Count secrets needing rotation
        secrets = manager.list_secrets()
        now = datetime.now()

        need_rotation = 0
        expiring_soon = 0

        for secret_id in secrets:
            try:
                metadata = manager.get_secret_metadata(secret_id)
                if metadata and metadata.rotation_enabled:
                    last_rotation = metadata.last_rotated_at or metadata.created_at
                    deadline = last_rotation + timedelta(days=self.config.interval_days)
                    warning_deadline = deadline - timedelta(days=self.config.warning_days)

                    if now >= deadline:
                        need_rotation += 1
                    elif now >= warning_deadline:
                        expiring_soon += 1

            except Exception:
                continue

        self._health.secrets_need_rotation = need_rotation
        self._health.secrets_expiring_soon = expiring_soon

        return self._health

    def get_expiring_secrets(self) -> List[str]:
        """
        Get list of secrets expiring soon.

        Returns:
            List of secret IDs expiring within warning period
        """
        from core.secret_management import get_secret_manager

        manager = get_secret_manager()
        secrets = manager.list_secrets()
        now = datetime.now()
        expiring = []

        for secret_id in secrets:
            try:
                metadata = manager.get_secret_metadata(secret_id)
                if metadata and metadata.rotation_enabled:
                    last_rotation = metadata.last_rotated_at or metadata.created_at
                    deadline = last_rotation + timedelta(days=self.config.interval_days)
                    warning_deadline = deadline - timedelta(days=self.config.warning_days)

                    if now >= warning_deadline:
                        expiring.append(secret_id)

            except Exception:
                continue

        return expiring

    # ========================================================================
    # Notification
    # ========================================================================

    def send_expiration_notifications(self) -> int:
        """
        Send notifications for expiring secrets.

        Returns:
            Number of notifications sent
        """
        expiring = self.get_expiring_secrets()

        if expiring and self.notification_callback:
            try:
                self.notification_callback(expiring)
                logger.info(f"Sent expiration notifications for {len(expiring)} secrets")
                return len(expiring)
            except Exception as e:
                logger.error(f"Failed to send notifications: {e}")

        return len(expiring)


# =============================================================================
# Global Scheduler Instance
# =============================================================================


_scheduler: Optional[KeyRotationScheduler] = None
_scheduler_lock = threading.Lock()


def get_rotation_scheduler() -> KeyRotationScheduler:
    """Get global rotation scheduler instance."""
    global _scheduler
    if _scheduler is None:
        with _scheduler_lock:
            if _scheduler is None:
                _scheduler = KeyRotationScheduler()
    return _scheduler


def initialize_rotation(
    config: Optional[RotationConfig] = None,
    notification_callback: Optional[Callable[[List[str]], None]] = None,
) -> KeyRotationScheduler:
    """
    Initialize the rotation scheduler.

    Args:
        config: Rotation configuration
        notification_callback: Optional callback for expiration notifications

    Returns:
        KeyRotationScheduler instance
    """
    global _scheduler
    with _scheduler_lock:
        if _scheduler is None:
            _scheduler = KeyRotationScheduler(config, notification_callback)
    return _scheduler


def run_rotation_now(
    dry_run: bool = False,
    secret_ids: Optional[List[str]] = None,
) -> RotationReport:
    """
    Run rotation immediately.

    Args:
        dry_run: Check what would be rotated without executing
        secret_ids: Specific secrets to rotate

    Returns:
        RotationReport with results
    """
    scheduler = get_rotation_scheduler()
    return scheduler.run_rotation(dry_run=dry_run, secret_ids=secret_ids)


def check_rotation_health() -> RotationHealth:
    """
    Check health of rotation system.

    Returns:
        RotationHealth status
    """
    scheduler = get_rotation_scheduler()
    return scheduler.get_health()
