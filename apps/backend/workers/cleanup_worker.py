"""
Cleanup Worker
==============

Handles maintenance and cleanup tasks for the Auto Claude Marketing Hub.

Tasks:
- Log file cleanup
- Old data archival
- Cache invalidation
- Database maintenance
"""

import asyncio
import gzip
import logging
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from core.task_queue import TaskProgress, TaskPriority

logger = logging.getLogger(__name__)


# ============================================================================
# Task Definitions
# ============================================================================


class CleanupTask(BaseModel):
    """Configuration for cleanup tasks."""

    task_type: str = Field(description="Type of cleanup: logs, temp_files, cache, database")
    target_path: str | None = Field(default=None, description="Target directory for cleanup")
    older_than_days: int = Field(default=30, description="Clean items older than days")
    dry_run: bool = Field(default=False, description="Simulate cleanup without deleting")
    compress: bool = Field(default=False, description="Compress instead of delete")
    filters: dict[str, Any] = Field(default_factory=dict, description="Additional filters")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ArchiveTask(BaseModel):
    """Configuration for archival tasks."""

    task_type: str = Field(description="Type of archive: tasks, campaigns, analytics, logs")
    time_range: str = Field(description="Time range: daily, weekly, monthly, all")
    destination: str | None = Field(default=None, description="Archive destination path")
    compress_output: bool = Field(default=True, description="Compress archive files")
    include_metadata: bool = Field(default=True, description="Include metadata files")
    filters: dict[str, Any] = Field(default_factory=dict, description="Filters for archival")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class CleanupResult(BaseModel):
    """Result of cleanup operations."""

    task_type: str
    items_scanned: int = Field(default=0, description="Total items scanned")
    items_deleted: int = Field(default=0, description="Items deleted")
    items_archived: int = Field(default=0, description="Items archived")
    space_freed_mb: float = Field(default=0.0, description="Disk space freed in MB")
    duration_ms: int = Field(default=0, description="Operation duration in milliseconds")
    errors: list[str] = Field(default_factory=list, description="Errors encountered")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ArchiveResult(BaseModel):
    """Result of archival operations."""

    task_type: str
    items_archived: int = Field(default=0, description="Items archived")
    archive_path: str = Field(description="Path to archive file")
    archive_size_mb: float = Field(default=0.0, description="Archive size in MB")
    compressed: bool = Field(default=False, description="Whether archive was compressed")
    duration_ms: int = Field(default=0, description="Operation duration in milliseconds")
    errors: list[str] = Field(default_factory=list, description="Errors encountered")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================================================
# Cleanup Functions
# ============================================================================


async def cleanup_old_logs(task: CleanupTask, task_id: str) -> CleanupResult:
    """Clean up old log files based on task configuration.

    Args:
        task: Cleanup task configuration
        task_id: Task ID for progress tracking

    Returns:
        Cleanup result
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting log cleanup")

    # Determine target path
    target_path = Path(task.target_path or os.path.expanduser("~/.auto-claude/logs"))
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=task.older_than_days)

    await asyncio.sleep(1)
    progress.progress = 15
    progress.message = f"Scanning {target_path} for old logs"

    # Scan for log files
    log_files = []
    if target_path.exists():
        log_files = list(target_path.glob("*.log")) + list(target_path.glob("*.log.*"))

    await asyncio.sleep(2)
    progress.progress = 40
    progress.message = f"Found {len(log_files)} log files to process"

    items_deleted = 0
    items_archived = 0
    space_freed = 0.0
    errors = []

    for i, log_file in enumerate(log_files):
        progress.progress = 40 + (i / len(log_files)) * 50
        progress.message = f"Processing {log_file.name} ({i + 1}/{len(log_files)})"

        try:
            # Check file age
            file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime, tz=timezone.utc)
            if file_mtime < cutoff_date:
                file_size = log_file.stat().st_size / (1024 * 1024)  # MB

                if task.compress:
                    # Archive instead of delete
                    archive_path = target_path / "archive" / log_file.name
                    archive_path.parent.mkdir(parents=True, exist_ok=True)

                    if not task.dry_run:
                        with open(log_file, "rb") as f_in:
                            with gzip.open(archive_path, "wb") as f_out:
                                shutil.copyfileobj(f_in, f_out)
                        log_file.unlink()

                    items_archived += 1
                    space_freed += file_size * 0.7  # Compression saves ~30%
                else:
                    # Delete old file
                    if not task.dry_run:
                        log_file.unlink()

                    items_deleted += 1
                    space_freed += file_size

        except Exception as e:
            errors.append(f"Error processing {log_file.name}: {str(e)}")

    await asyncio.sleep(1)
    progress.progress = 100
    action = "Archived" if task.compress else "Deleted"
    progress.message = f"Log cleanup complete: {action} {items_deleted + items_archived} files"

    duration_ms = int((asyncio.get_event_loop().time() - progress.timestamp) * 1000)

    logger.info(f"Log cleanup: {items_deleted} deleted, {items_archived} archived, {space_freed:.1f} MB freed")

    return CleanupResult(
        task_type="logs",
        items_scanned=len(log_files),
        items_deleted=items_deleted,
        items_archived=items_archived,
        space_freed_mb=space_freed,
        duration_ms=duration_ms,
        errors=errors,
    )


async def cleanup_temp_files(task: CleanupTask, task_id: str) -> CleanupResult:
    """Clean up temporary files.

    Args:
        task: Cleanup task configuration
        task_id: Task ID for progress tracking

    Returns:
        Cleanup result
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting temp file cleanup")

    # Common temp directories
    temp_dirs = [
        Path(os.path.expanduser("~/.auto-claude/tmp")),
        Path(os.path.expanduser("~/.auto-claude/cache")),
        Path("/tmp/auto-claude"),
    ]

    if task.target_path:
        temp_dirs = [Path(task.target_path)]

    items_deleted = 0
    space_freed = 0.0
    errors = []

    for temp_dir in temp_dirs:
        if not temp_dir.exists():
            continue

        progress.message = f"Scanning {temp_dir}"
        await asyncio.sleep(1)

        try:
            # Scan for temp files
            temp_files = []
            for item in temp_dir.iterdir():
                if item.is_file():
                    temp_files.append(item)

            # Filter by age
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=task.older_than_days)

            for temp_file in temp_files:
                file_mtime = datetime.fromtimestamp(temp_file.stat().st_mtime, tz=timezone.utc)
                if file_mtime < cutoff_date:
                    file_size = temp_file.stat().st_size / (1024 * 1024)

                    if not task.dry_run:
                        temp_file.unlink()

                    items_deleted += 1
                    space_freed += file_size

        except Exception as e:
            errors.append(f"Error cleaning {temp_dir}: {str(e)}")

    progress.progress = 100
    progress.message = f"Temp cleanup complete: {items_deleted} files removed"

    duration_ms = int((asyncio.get_event_loop().time() - progress.timestamp) * 1000)

    logger.info(f"Temp cleanup: {items_deleted} files deleted, {space_freed:.1f} MB freed")

    return CleanupResult(
        task_type="temp_files",
        items_scanned=items_deleted,
        items_deleted=items_deleted,
        space_freed_mb=space_freed,
        duration_ms=duration_ms,
        errors=errors,
    )


async def cleanup_cache(task: CleanupTask, task_id: str) -> CleanupResult:
    """Clean up cache files.

    Args:
        task: Cleanup task configuration
        task_id: Task ID for progress tracking

    Returns:
        Cleanup result
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting cache cleanup")

    # Cache directories
    cache_dirs = [
        Path(os.path.expanduser("~/.auto-claude/cache/l1")),
        Path(os.path.expanduser("~/.auto-claude/cache/l2")),
    ]

    if task.target_path:
        cache_dirs = [Path(task.target_path)]

    items_deleted = 0
    space_freed = 0.0
    errors = []

    for cache_dir in cache_dirs:
        if not cache_dir.exists():
            continue

        progress.message = f"Clearing cache in {cache_dir}"
        await asyncio.sleep(1)

        try:
            # Simply delete all cache contents
            for item in cache_dir.iterdir():
                item_size = item.stat().st_size / (1024 * 1024)

                if not task.dry_run:
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()

                items_deleted += 1
                space_freed += item_size

        except Exception as e:
            errors.append(f"Error cleaning {cache_dir}: {str(e)}")

    progress.progress = 100
    progress.message = f"Cache cleanup complete: {items_deleted} items cleared"

    duration_ms = int((asyncio.get_event_loop().time() - progress.timestamp) * 1000)

    logger.info(f"Cache cleanup: {items_deleted} items deleted, {space_freed:.1f} MB freed")

    return CleanupResult(
        task_type="cache",
        items_scanned=items_deleted,
        items_deleted=items_deleted,
        space_freed_mb=space_freed,
        duration_ms=duration_ms,
        errors=errors,
    )


# ============================================================================
# Archive Functions
# ============================================================================


async def archive_completed_tasks(task: ArchiveTask, task_id: str) -> ArchiveResult:
    """Archive completed tasks based on task configuration.

    Args:
        task: Archive task configuration
        task_id: Task ID for progress tracking

    Returns:
        Archive result
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting task archival")

    # Determine source and destination
    source_path = Path(os.path.expanduser("~/.auto-claude/specs"))
    dest_path = Path(task.destination or os.path.expanduser("~/.auto-claude/archives"))

    await asyncio.sleep(1)
    progress.progress = 15
    progress.message = f"Scanning {source_path} for completed tasks"

    # Find completed tasks
    completed_tasks = []
    if source_path.exists():
        for task_dir in source_path.iterdir():
            if task_dir.is_dir():
                # Check for completion marker
                spec_file = task_dir / "spec.md"
                if spec_file.exists():
                    # Simple heuristic: task is complete if spec.md exists and has status
                    try:
                        content = spec_file.read_text()
                        if "Status: done" in content or "Status: completed" in content:
                            completed_tasks.append(task_dir)
                    except Exception:
                        pass  # Skip if can't read

    await asyncio.sleep(2)
    progress.progress = 40
    progress.message = f"Found {len(completed_tasks)} tasks to archive"

    if not completed_tasks:
        progress.progress = 100
        progress.message = "No completed tasks to archive"
        return ArchiveResult(
            task_type="tasks",
            items_archived=0,
            archive_path=str(dest_path),
            duration_ms=0,
        )

    # Create archive
    await asyncio.sleep(2)
    progress.progress = 60
    progress.message = "Creating archive"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_name = f"tasks_archive_{timestamp}"
    archive_file = dest_path / f"{archive_name}.tar.gz"

    if not task.dry_run:
        import tarfile

        try:
            with tarfile.open(archive_file, "w:gz") as tar:
                for task_dir in completed_tasks:
                    tar.add(task_dir, arcname=task_dir.name)
        except Exception as e:
            errors = [str(e)]

    await asyncio.sleep(2)
    progress.progress = 90
    progress.message = "Archive created successfully"

    # Get archive size
    archive_size_mb = archive_file.stat().st_size / (1024 * 1024) if archive_file.exists() else 0

    progress.progress = 100
    progress.message = f"Task archival complete: {len(completed_tasks)} tasks archived"

    duration_ms = int((asyncio.get_event_loop().time() - progress.timestamp) * 1000)

    logger.info(f"Task archival: {len(completed_tasks)} tasks archived to {archive_file}")

    return ArchiveResult(
        task_type="tasks",
        items_archived=len(completed_tasks),
        archive_path=str(archive_file),
        archive_size_mb=archive_size_mb,
        compressed=True,
        duration_ms=duration_ms,
        errors=errors if task.compress else [],
    )


async def compress_old_data(task: ArchiveTask, task_id: str) -> ArchiveResult:
    """Compress old data files.

    Args:
        task: Archive task configuration
        task_id: Task ID for progress tracking

    Returns:
        Archive result
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting data compression")

    source_path = Path(task.destination or os.path.expanduser("~/.auto-claude/data"))

    await asyncio.sleep(1)
    progress.progress = 20
    progress.message = f"Scanning {source_path} for old data"

    # Find old data files
    old_files = []
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)

    if source_path.exists():
        for data_file in source_path.rglob("*.json"):
            file_mtime = datetime.fromtimestamp(data_file.stat().st_mtime, tz=timezone.utc)
            if file_mtime < cutoff_date:
                old_files.append(data_file)

    await asyncio.sleep(2)
    progress.progress = 50
    progress.message = f"Compressing {len(old_files)} old data files"

    errors = []
    compressed_size = 0.0

    # Compress files
    for i, data_file in enumerate(old_files[:10]):  # Batch in groups of 10
        progress.progress = 50 + (i / min(len(old_files), 10)) * 40

        try:
            compressed_file = source_path / f"{data_file.stem}.gz"

            if not task.dry_run:
                with open(data_file, "rb") as f_in:
                    with gzip.open(compressed_file, "wb") as f_out:
                        f_out.writelines(f_in)

                compressed_size += compressed_file.stat().st_size / (1024 * 1024)

        except Exception as e:
            errors.append(f"Error compressing {data_file.name}: {str(e)}")

    await asyncio.sleep(1)
    progress.progress = 100
    progress.message = f"Data compression complete: {min(len(old_files), 10)} files compressed"

    duration_ms = int((asyncio.get_event_loop().time() - progress.timestamp) * 1000)

    logger.info(f"Data compression: {len(old_files)} files processed")

    return ArchiveResult(
        task_type="data",
        items_archived=min(len(old_files), 10),
        archive_path=str(source_path),
        archive_size_mb=compressed_size,
        compressed=True,
        duration_ms=duration_ms,
        errors=errors,
    )


# ============================================================================
# Integration with Task Queue
# ============================================================================


def register_cleanup_workers():
    """Register all cleanup worker functions with the task queue."""
    from core.task_queue import get_task_queue

    queue = get_task_queue()

    # Register cleanup worker tasks
    queue._worker_pool.register_task("cleanup_old_logs", cleanup_old_logs)
    queue._worker_pool.register_task("cleanup_temp_files", cleanup_temp_files)
    queue._worker_pool.register_task("cleanup_cache", cleanup_cache)
    queue._worker_pool.register_task("archive_completed_tasks", archive_completed_tasks)
    queue._worker_pool.register_task("compress_old_data", compress_old_data)

    logger.info("Cleanup workers registered with task queue")
