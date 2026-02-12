"""
Background Task Queue System
==========================

A robust, enterprise-grade background job processing system for Auto Claude Marketing Hub.

Features:
- Priority queue with multiple priority levels
- Worker pool management with auto-scaling
- Persistent task storage (Redis/file-based fallback)
- Progress tracking with WebSocket updates
- Webhook notifications on task completion
- Scheduled/cron task support
- Comprehensive monitoring and metrics

Architecture:
------------
Queue -> Task Storage -> Worker Pool -> Progress Tracking -> Notification

Priority Levels:
- URGENT: 0 - Critical tasks (security, production fixes)
- HIGH: 1 - Important tasks (features, user requests)
- MEDIUM: 2 - Standard tasks (maintenance, batch jobs)
- LOW: 3 - Background tasks (reports, cleanup)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import pickle
import threading
import time
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import IntEnum
from functools import wraps
from pathlib import Path
from typing import (
    Any,
    Callable,
    Coroutine,
    Dict,
    Generic,
    List,
    Optional,
    Set,
    Type,
    TypeVar,
    cast,
)
from urllib.parse import urlparse

import httpx

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

# ============================================================================
# Type Definitions
# ============================================================================

T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])


class TaskPriority(IntEnum):
    """Priority levels for queued tasks (lower = higher priority)."""
    URGENT = 0
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class TaskStatus(str, str):
    """Status of a queued task."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class WorkerStatus(str):
    """Status of a worker thread."""
    IDLE = "idle"
    BUSY = "busy"
    STOPPING = "stopping"
    STOPPED = "stopped"


# ============================================================================
# Task Definitions
# ============================================================================


@dataclass
class TaskResult:
    """Result of a completed task execution."""
    success: bool
    data: Any | None = None
    error: str | None = None
    traceback: str | None = None
    duration_ms: int = 0
    retries: int = 0


@dataclass
class TaskProgress:
    """Progress update for a running task."""
    task_id: str
    progress: float  # 0-100
    message: str
    current_step: str | None = None
    total_steps: int | None = None
    timestamp: float = field(default_factory=time.time)


class QueuedTask(BaseModel):
    """A task in the queue with metadata."""
    task_id: str = Field(description="Unique task identifier")
    name: str = Field(description="Human-readable task name")
    func_name: str = Field(description="Name of the function to execute")
    args: list[Any] = Field(default_factory=list, description="Positional arguments")
    kwargs: dict[str, Any] = Field(default_factory=dict, description="Keyword arguments")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    status: TaskStatus = Field(default=TaskStatus.PENDING, description="Task status")
    max_retries: int = Field(default=3, description="Maximum retry attempts")
    retry_count: int = Field(default=0, description="Current retry count")
    retry_delay: int = Field(default=60, description="Delay between retries (seconds)")
    timeout: int | None = Field(default=None, description="Task timeout (seconds)")
    created_at: float = Field(default_factory=time.time, description="Creation timestamp")
    started_at: float | None = Field(default=None, description="Start timestamp")
    completed_at: float | None = Field(default=None, description="Completion timestamp")
    result: TaskResult | None = Field(default=None, description="Task result")
    progress: TaskProgress | None = Field(default=None, description="Current progress")
    webhook_url: str | None = Field(default=None, description="Webhook URL for completion notification")
    scheduled_at: float | None = Field(default=None, description="Scheduled execution time")
    dependencies: list[str] = Field(default_factory=list, description="Task IDs this task depends on")
    tags: set[str] = Field(default_factory=set, description="Task tags for filtering")

    @field_validator("priority", mode="before")
    @classmethod
    def validate_priority(cls, v):
        if isinstance(v, str):
            return TaskPriority[v.upper()]
        return v

    @property
    def duration(self) -> float | None:
        """Task execution duration in seconds."""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None

    @property
    def is_ready(self) -> bool:
        """Check if task is ready to run (dependencies met, scheduled time reached)."""
        if self.scheduled_at and time.time() < self.scheduled_at:
            return False
        return True

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "name": self.name,
            "func_name": self.func_name,
            "priority": self.priority.value,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration": self.duration,
            "retry_count": self.retry_count,
            "progress": self.progress.__dict__ if self.progress else None,
            "tags": list(self.tags) if self.tags else [],
        }


class WebhookPayload(BaseModel):
    """Payload for webhook notifications."""
    task_id: str
    status: TaskStatus
    result: TaskResult | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# Storage Backend Interface
# ============================================================================


class TaskStorageBackend(ABC):
    """Abstract base for task storage backends."""

    @abstractmethod
    async def add_task(self, task: QueuedTask) -> bool:
        """Add a task to storage."""
        pass

    @abstractmethod
    async def get_task(self, task_id: str) -> QueuedTask | None:
        """Get a task by ID."""
        pass

    @abstractmethod
    async def update_task(self, task: QueuedTask) -> bool:
        """Update a task in storage."""
        pass

    @abstractmethod
    async def delete_task(self, task_id: str) -> bool:
        """Delete a task from storage."""
        pass

    @abstractmethod
    async def get_next_task(self) -> QueuedTask | None:
        """Get the next task to process (respecting priority)."""
        pass

    @abstractmethod
    async def get_all_tasks(self) -> list[QueuedTask]:
        """Get all tasks."""
        pass

    @abstractmethod
    async def get_tasks_by_status(self, status: TaskStatus) -> list[QueuedTask]:
        """Get tasks by status."""
        pass

    @abstractmethod
    async def get_scheduled_tasks(self) -> list[QueuedTask]:
        """Get tasks that are scheduled for future execution."""
        pass

    @abstractmethod
    async def clear_completed(self, older_than: float | None = None) -> int:
        """Clear completed tasks older than timestamp."""
        pass


class InMemoryStorage(TaskStorageBackend):
    """In-memory task storage with persistence to disk."""

    def __init__(self, persist_path: Path | None = None):
        self._tasks: dict[str, QueuedTask] = {}
        self._queue_by_priority: dict[TaskPriority, deque[str]] = {
            TaskPriority.URGENT: deque(),
            TaskPriority.HIGH: deque(),
            TaskPriority.MEDIUM: deque(),
            TaskPriority.LOW: deque(),
        }
        self._lock = threading.Lock()
        self._persist_path = persist_path

    async def add_task(self, task: QueuedTask) -> bool:
        with self._lock:
            self._tasks[task.task_id] = task
            self._queue_by_priority[task.priority].append(task.task_id)
            await self._persist()
        return True

    async def get_task(self, task_id: str) -> QueuedTask | None:
        with self._lock:
            return self._tasks.get(task_id)

    async def update_task(self, task: QueuedTask) -> bool:
        with self._lock:
            if task.task_id not in self._tasks:
                return False
            self._tasks[task.task_id] = task
            await self._persist()
        return True

    async def delete_task(self, task_id: str) -> bool:
        with self._lock:
            if task_id not in self._tasks:
                return False
            task = self._tasks[task_id]
            if task_id in self._queue_by_priority[task.priority]:
                self._queue_by_priority[task.priority].remove(task_id)
            del self._tasks[task_id]
            await self._persist()
        return True

    async def get_next_task(self) -> QueuedTask | None:
        with self._lock:
            # Check priorities in order (lower number = higher priority)
            for priority in TaskPriority:
                queue = self._queue_by_priority[priority]
                while queue:
                    task_id = queue.popleft()
                    task = self._tasks.get(task_id)
                    if task and task.is_ready and task.status == TaskStatus.PENDING:
                        return task
                    # Put back if not ready
                    queue.append(task_id)
            return None

    async def get_all_tasks(self) -> list[QueuedTask]:
        with self._lock:
            return list(self._tasks.values())

    async def get_tasks_by_status(self, status: TaskStatus) -> list[QueuedTask]:
        with self._lock:
            return [t for t in self._tasks.values() if t.status == status]

    async def get_scheduled_tasks(self) -> list[QueuedTask]:
        with self._lock:
            return [
                t
                for t in self._tasks.values()
                if t.scheduled_at and t.status == TaskStatus.PENDING
            ]

    async def clear_completed(self, older_than: float | None = None) -> int:
        with self._lock:
            cutoff = older_than or (time.time() - 86400)  # 24 hours default
            to_remove = [
                tid
                for tid, task in self._tasks.items()
                if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED)
                and (task.completed_at or 0) < cutoff
            ]
            for tid in to_remove:
                task = self._tasks[tid]
                if tid in self._queue_by_priority[task.priority]:
                    self._queue_by_priority[task.priority].remove(tid)
                del self._tasks[tid]
            await self._persist()
        return len(to_remove)

    async def _persist(self) -> None:
        """Persist tasks to disk."""
        if not self._persist_path:
            return
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "tasks": {tid: t.model_dump() for tid, t in self._tasks.items()},
                "queues": {
                    p.value: list(q) for p, q in self._queue_by_priority.items()
                },
            }
            with open(self._persist_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist tasks: {e}")

    async def load(self) -> bool:
        """Load tasks from disk."""
        if not self._persist_path or not self._persist_path.exists():
            return False
        try:
            with open(self._persist_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            with self._lock:
                self._tasks = {
                    tid: QueuedTask(**t_data)
                    for tid, t_data in data.get("tasks", {}).items()
                }
                for p_val, queue_data in data.get("queues", {}).items():
                    priority = TaskPriority(p_val)
                    self._queue_by_priority[priority] = deque(queue_data)
            return True
        except Exception as e:
            logger.error(f"Failed to load tasks: {e}")
            return False


class RedisStorage(TaskStorageBackend):
    """Redis-based task storage for distributed processing."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: str | None = None,
        prefix: str = "task_queue",
    ):
        self._host = host
        self._port = port
        self._db = db
        self._password = password
        self._prefix = prefix
        self._client: Any | None = None
        self._connected = False

    async def _connect(self) -> bool:
        """Connect to Redis."""
        if self._connected:
            return True

        try:
            import redis.asyncio as aioredis

            self._client = await aioredis.from_url(
                f"redis://{':***@' if self._password else ''}{self._host}:{self._port}/{self._db}",
                password=self._password,
                decode_responses=True,
            )
            self._connected = True
            logger.info(f"Connected to Redis at {self._host}:{self._port}")
            return True
        except ImportError:
            logger.warning("Redis package not installed, falling back to memory storage")
            return False
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            return False

    def _key(self, task_id: str) -> str:
        """Generate Redis key for a task."""
        return f"{self._prefix}:task:{task_id}"

    def _priority_key(self, priority: TaskPriority) -> str:
        """Generate Redis key for a priority queue."""
        return f"{self._prefix}:queue:{priority.name}"

    async def add_task(self, task: QueuedTask) -> bool:
        if not await self._connect():
            return False
        try:
            pipe = self._client.pipeline()
            pipe.hset(self._key(task.task_id), "data", task.model_dump_json())
            pipe.lpush(self._priority_key(task.priority), task.task_id)
            pipe.hset(self._key(task.task_id), "status", task.status.value)
            pipe.hset(self._key(task.task_id), "priority", task.priority.value)
            pipe.hset(self._key(task.task_id), "created_at", task.created_at)
            await pipe.execute()
            return True
        except Exception as e:
            logger.error(f"Failed to add task to Redis: {e}")
            return False

    async def get_task(self, task_id: str) -> QueuedTask | None:
        if not await self._connect():
            return None
        try:
            data = await self._client.hget(self._key(task_id), "data")
            if data:
                return QueuedTask.model_validate_json(data)
        except Exception as e:
            logger.error(f"Failed to get task from Redis: {e}")
        return None

    async def update_task(self, task: QueuedTask) -> bool:
        if not await self._connect():
            return False
        try:
            await self._client.hset(
                self._key(task.task_id),
                "data",
                task.model_dump_json()
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update task in Redis: {e}")
        return False

    async def delete_task(self, task_id: str) -> bool:
        if not await self._connect():
            return False
        try:
            # Get task to find priority
            task = await self.get_task(task_id)
            if task:
                pipe = self._client.pipeline()
                pipe.delete(self._key(task_id))
                pipe.lrem(self._priority_key(task.priority), 0, task_id)
                await pipe.execute()
                return True
        except Exception as e:
            logger.error(f"Failed to delete task from Redis: {e}")
        return False

    async def get_next_task(self) -> QueuedTask | None:
        if not await self._connect():
            return None
        try:
            # Check priorities in order
            for priority in TaskPriority:
                key = self._priority_key(priority)
                # Non-blocking pop from right
                task_id = await self._client.rpop(key)
                if task_id:
                    task = await self.get_task(task_id)
                    if task and task.is_ready:
                        return task
                    # Put back if not ready
                    await self._client.lpush(key, task_id)
            return None
        except Exception as e:
            logger.error(f"Failed to get next task from Redis: {e}")
        return None

    async def get_all_tasks(self) -> list[QueuedTask]:
        if not await self._connect():
            return []
        try:
            keys = await self._client.keys(f"{self._prefix}:task:*")
            tasks = []
            for key in keys:
                data = await self._client.hget(key, "data")
                if data:
                    tasks.append(QueuedTask.model_validate_json(data))
            return tasks
        except Exception as e:
            logger.error(f"Failed to get all tasks from Redis: {e}")
        return []

    async def get_tasks_by_status(self, status: TaskStatus) -> list[QueuedTask]:
        tasks = await self.get_all_tasks()
        return [t for t in tasks if t.status == status]

    async def get_scheduled_tasks(self) -> list[QueuedTask]:
        tasks = await self.get_all_tasks()
        now = time.time()
        return [
            t for t in tasks
            if t.scheduled_at and t.scheduled_at > now and t.status == TaskStatus.PENDING
        ]

    async def clear_completed(self, older_than: float | None = None) -> int:
        cutoff = older_than or (time.time() - 86400)
        tasks = await self.get_all_tasks()
        to_remove = [
            t
            for t in tasks
            if t.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED)
            and (t.completed_at or 0) < cutoff
        ]
        for task in to_remove:
            await self.delete_task(task.task_id)
        return len(to_remove)


# ============================================================================
# Webhook Notification System
# ============================================================================


class WebhookNotifier:
    """Sends webhook notifications for task completion."""

    def __init__(self, timeout: int = 30):
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def notify(
        self, task: QueuedTask, webhook_url: str | None = None
    ) -> bool:
        """Send webhook notification for task completion."""
        url = webhook_url or task.webhook_url
        if not url:
            return False

        try:
            payload = WebhookPayload(
                task_id=task.task_id,
                status=task.status,
                result=task.result,
                metadata={
                    "name": task.name,
                    "duration": task.duration,
                    "retry_count": task.retry_count,
                },
            )

            client = await self._get_client()
            response = await client.post(
                url,
                json=payload.model_dump(),
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            logger.info(f"Webhook sent for task {task.task_id} to {url}")
            return True
        except Exception as e:
            logger.error(f"Failed to send webhook for task {task.task_id}: {e}")
            return False

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# ============================================================================
# Worker Pool
# ============================================================================


@dataclass
class WorkerInfo:
    """Information about a worker thread."""
    worker_id: str
    status: WorkerStatus = WorkerStatus.IDLE
    current_task_id: str | None = None
    tasks_completed: int = 0
    tasks_failed: int = 0
    total_duration_ms: int = 0
    started_at: float = field(default_factory=time.time)

    @property
    def utilisation(self) -> float:
        """Worker utilisation rate (0-1)."""
        total_tasks = self.tasks_completed + self.tasks_failed
        if total_tasks == 0:
            return 0.0
        uptime = time.time() - self.started_at
        return (self.total_duration_ms / 1000) / uptime if uptime > 0 else 0.0


class WorkerPool:
    """Manages a pool of worker threads for task execution."""

    def __init__(
        self,
        min_workers: int = 2,
        max_workers: int = 10,
        idle_timeout: int = 300,
    ):
        self._min_workers = min_workers
        self._max_workers = max_workers
        self._idle_timeout = idle_timeout
        self._workers: dict[str, WorkerInfo] = {}
        self._task_registry: dict[str, Callable] = {}
        self._running = False
        self._scale_lock = threading.Lock()
        self._worker_counter = 0
        self._progress_callbacks: dict[str, list[Callable[[TaskProgress], None]]] = defaultdict(list)

    def register_task(
        self, name: str, func: Callable[..., Coroutine[Any, Any, Any]]
    ) -> None:
        """Register a task function that can be executed."""
        self._task_registry[name] = func

    def register_progress_callback(
        self, task_id: str, callback: Callable[[TaskProgress], None]
    ) -> Callable[[], None]:
        """Register a progress callback for a task."""
        self._progress_callbacks[task_id].append(callback)
        # Return cleanup function
        def cleanup():
            if callback in self._progress_callbacks[task_id]:
                self._progress_callbacks[task_id].remove(callback)
        return cleanup

    async def _notify_progress(self, progress: TaskProgress) -> None:
        """Notify all registered progress callbacks."""
        for callback in self._progress_callbacks.get(progress.task_id, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(progress)
                else:
                    callback(progress)
            except Exception as e:
                logger.error(f"Error in progress callback: {e}")

    def _create_worker_id(self) -> str:
        """Generate unique worker ID."""
        self._worker_counter += 1
        return f"worker-{self._worker_counter}-{threading.get_ident()}"

    async def _worker_loop(self, worker_id: str, storage: TaskStorageBackend) -> None:
        """Worker loop that pulls and executes tasks."""
        worker_info = WorkerInfo(worker_id=worker_id, status=WorkerStatus.IDLE)
        self._workers[worker_id] = worker_info

        logger.info(f"Worker {worker_id} started")

        while self._running:
            try:
                # Update worker status
                worker_info.status = WorkerStatus.IDLE

                # Get next task
                task = await storage.get_next_task()
                if not task:
                    await asyncio.sleep(1)
                    continue

                # Check dependencies
                if not self._check_dependencies(task, storage):
                    await asyncio.sleep(5)
                    continue

                # Mark as running
                task.status = TaskStatus.RUNNING
                task.started_at = time.time()
                await storage.update_task(task)

                worker_info.status = WorkerStatus.BUSY
                worker_info.current_task_id = task.task_id

                logger.info(f"Worker {worker_id} executing task {task.task_id}: {task.name}")

                # Execute task
                start_time = time.time()
                try:
                    result = await self._execute_task(task, worker_id)
                    duration_ms = int((time.time() - start_time) * 1000)

                    if result.success:
                        task.status = TaskStatus.COMPLETED
                        worker_info.tasks_completed += 1
                    else:
                        # Check if we should retry
                        if task.retry_count < task.max_retries:
                            task.status = TaskStatus.RETRYING
                            task.retry_count += 1
                            await asyncio.sleep(task.retry_delay)
                            await storage.update_task(task)
                            continue
                        task.status = TaskStatus.FAILED
                        worker_info.tasks_failed += 1

                    task.result = result
                    task.completed_at = time.time()

                except asyncio.TimeoutError:
                    task.status = TaskStatus.FAILED
                    task.result = TaskResult(
                        success=False,
                        error="Task execution timeout",
                    )
                    task.completed_at = time.time()
                    worker_info.tasks_failed += 1
                    logger.error(f"Task {task.task_id} timed out")
                except Exception as e:
                    task.status = TaskStatus.FAILED
                    task.result = TaskResult(
                        success=False,
                        error=str(e),
                        traceback=traceback.format_exc(),
                    )
                    task.completed_at = time.time()
                    worker_info.tasks_failed += 1
                    logger.error(f"Task {task.task_id} failed: {e}")

                finally:
                    worker_info.total_duration_ms += int((time.time() - start_time) * 1000)
                    worker_info.status = WorkerStatus.IDLE
                    worker_info.current_task_id = None

                # Update storage
                await storage.update_task(task)

                # Send webhook if configured
                if task.webhook_url and task.status == TaskStatus.COMPLETED:
                    await self._webhook_notifier.notify(task)

            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
                await asyncio.sleep(1)

        worker_info.status = WorkerStatus.STOPPED
        logger.info(f"Worker {worker_id} stopped")

    def _check_dependencies(self, task: QueuedTask, storage: TaskStorageBackend) -> bool:
        """Check if task dependencies are satisfied."""
        if not task.dependencies:
            return True

        for dep_id in task.dependencies:
            dep_task = await storage.get_task(dep_id)
            if not dep_task:
                logger.warning(f"Task {task.task_id} depends on non-existent task {dep_id}")
                return False
            if dep_task.status != TaskStatus.COMPLETED:
                return False
        return True

    async def _execute_task(self, task: QueuedTask, worker_id: str) -> TaskResult:
        """Execute a single task with timeout and progress tracking."""
        func = self._task_registry.get(task.func_name)
        if not func:
            return TaskResult(
                success=False,
                error=f"Task function '{task.func_name}' not registered",
            )

        # Execute with timeout
        timeout = task.timeout or 3600  # Default 1 hour
        try:
            if asyncio.iscoroutinefunction(func):
                result = await asyncio.wait_for(func(*task.args, **task.kwargs), timeout=timeout)
            else:
                # Run sync function in executor
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: func(*task.args, **task.kwargs)),
                    timeout=timeout,
                )

            return TaskResult(
                success=True,
                data=result,
                duration_ms=int((time.time() - task.started_at) * 1000),
            )
        except asyncio.TimeoutError:
            raise
        except Exception as e:
            return TaskResult(
                success=False,
                error=str(e),
                traceback=traceback.format_exc(),
            )

    async def start(self, storage: TaskStorageBackend) -> None:
        """Start the worker pool."""
        if self._running:
            return

        self._running = True
        self._webhook_notifier = WebhookNotifier()

        # Create minimum workers
        for _ in range(self._min_workers):
            worker_id = self._create_worker_id()
            asyncio.create_task(self._worker_loop(worker_id, storage))

        logger.info(f"Worker pool started with {self._min_workers} workers")

    async def stop(self) -> None:
        """Stop all workers."""
        self._running = False
        # Wait for workers to stop
        await asyncio.sleep(2)
        logger.info("Worker pool stopped")

    def get_worker_stats(self) -> dict[str, WorkerInfo]:
        """Get statistics for all workers."""
        return self._workers.copy()

    def get_stats(self) -> dict[str, Any]:
        """Get pool-level statistics."""
        workers = list(self._workers.values())
        return {
            "total_workers": len(workers),
            "active_workers": sum(1 for w in workers if w.status == WorkerStatus.BUSY),
            "idle_workers": sum(1 for w in workers if w.status == WorkerStatus.IDLE),
            "total_tasks_completed": sum(w.tasks_completed for w in workers),
            "total_tasks_failed": sum(w.tasks_failed for w in workers),
            "average_utilisation": sum(w.utilisation for w in workers) / len(workers) if workers else 0,
        }


# ============================================================================
# Task Queue - Main Interface
# ============================================================================


class TaskQueue:
    """Main task queue interface with priority scheduling and worker management."""

    def __init__(
        self,
        storage: TaskStorageBackend | None = None,
        min_workers: int = 2,
        max_workers: int = 10,
        persist_path: Path | None = None,
    ):
        self._storage = storage or InMemoryStorage(persist_path)
        self._worker_pool = WorkerPool(min_workers=min_workers, max_workers=max_workers)
        self._scheduler_task: asyncio.Task | None = None
        self._running = False
        self._cron_jobs: dict[str, Callable] = {}

    def task(self, name: str, priority: TaskPriority = TaskPriority.MEDIUM):
        """Decorator to register a task function."""

        def decorator(func: F) -> F:
            @wraps(func)
            async def wrapper(*args, **kwargs):
                return await func(*args, **kwargs)

            self._worker_pool.register_task(name, wrapper)
            return cast(F, wrapper)

        return decorator

    async def enqueue(
        self,
        name: str,
        args: list[Any] | None = None,
        kwargs: dict[str, Any] | None = None,
        priority: TaskPriority = TaskPriority.MEDIUM,
        task_id: str | None = None,
        max_retries: int = 3,
        timeout: int | None = None,
        webhook_url: str | None = None,
        scheduled_at: float | None = None,
        dependencies: list[str] | None = None,
        tags: set[str] | None = None,
    ) -> str:
        """Enqueue a task for execution."""
        import uuid

        task = QueuedTask(
            task_id=task_id or f"task-{uuid.uuid4()}",
            name=name,
            func_name=name,
            args=args or [],
            kwargs=kwargs or {},
            priority=priority,
            max_retries=max_retries,
            timeout=timeout,
            webhook_url=webhook_url,
            scheduled_at=scheduled_at,
            dependencies=dependencies or [],
            tags=tags or set(),
        )

        await self._storage.add_task(task)
        logger.info(f"Enqueued task {task.task_id}: {task.name} (priority: {priority.name})")

        # Auto-scale workers if needed
        await self._maybe_scale_workers()

        return task.task_id

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending or running task."""
        task = await self._storage.get_task(task_id)
        if not task:
            return False

        task.status = TaskStatus.CANCELLED
        await self._storage.update_task(task)

        # If task is running, we can't really stop it from here
        # But marking it cancelled will prevent retries
        logger.info(f"Task {task_id} cancelled")
        return True

    async def get_task_status(self, task_id: str) -> dict[str, Any] | None:
        """Get the current status of a task."""
        task = await self._storage.get_task(task_id)
        if not task:
            return None
        return task.to_dict()

    async def get_all_tasks(self) -> list[dict[str, Any]]:
        """Get all tasks."""
        tasks = await self._storage.get_all_tasks()
        return [t.to_dict() for t in tasks]

    async def get_queue_stats(self) -> dict[str, Any]:
        """Get queue statistics."""
        all_tasks = await self._storage.get_all_tasks()
        return {
            "total_tasks": len(all_tasks),
            "pending": sum(1 for t in all_tasks if t.status == TaskStatus.PENDING),
            "running": sum(1 for t in all_tasks if t.status == TaskStatus.RUNNING),
            "completed": sum(1 for t in all_tasks if t.status == TaskStatus.COMPLETED),
            "failed": sum(1 for t in all_tasks if t.status == TaskStatus.FAILED),
            "by_priority": {
                p.name: sum(1 for t in all_tasks if t.priority == p and t.status == TaskStatus.PENDING)
                for p in TaskPriority
            },
            "worker_stats": self._worker_pool.get_stats(),
        }

    async def clear_completed(self, older_than_hours: int = 24) -> int:
        """Clear completed tasks older than specified hours."""
        cutoff = time.time() - (older_than_hours * 3600)
        return await self._storage.clear_completed(cutoff)

    def register_progress_callback(
        self, task_id: str, callback: Callable[[TaskProgress], None]
    ) -> Callable[[], None]:
        """Register a callback for progress updates on a task."""
        return self._worker_pool.register_progress_callback(task_id, callback)

    async def update_progress(
        self,
        task_id: str,
        progress: float,
        message: str,
        current_step: str | None = None,
        total_steps: int | None = None,
    ) -> bool:
        """Update progress for a running task."""
        task = await self._storage.get_task(task_id)
        if not task or task.status != TaskStatus.RUNNING:
            return False

        task.progress = TaskProgress(
            task_id=task_id,
            progress=progress,
            message=message,
            current_step=current_step,
            total_steps=total_steps,
        )
        await self._storage.update_task(task)
        await self._worker_pool._notify_progress(task.progress)

        return True

    async def _maybe_scale_workers(self) -> None:
        """Auto-scale workers based on queue size."""
        stats = await self.get_queue_stats()
        pending = stats["pending"]
        current_workers = stats["worker_stats"]["total_workers"]

        # Scale up if needed
        if pending > current_workers * 2 and current_workers < self._worker_pool._max_workers:
            new_workers = min(current_workers + 2, self._worker_pool._max_workers)
            for _ in range(new_workers - current_workers):
                worker_id = self._worker_pool._create_worker_id()
                asyncio.create_task(self._worker_pool._worker_loop(worker_id, self._storage))
            logger.info(f"Scaled up to {new_workers} workers")

    def cron(self, schedule: str):
        """Decorator to register a scheduled task."""
        from croniter import croniter

        def decorator(func: Callable):
            self._cron_jobs[schedule] = func
            return func
        return decorator

    async def start(self) -> None:
        """Start the task queue and worker pool."""
        if self._running:
            return

        self._running = True

        # Load persisted tasks if using in-memory storage
        if isinstance(self._storage, InMemoryStorage):
            await self._storage.load()

        # Start worker pool
        await self._worker_pool.start(self._storage)

        # Start scheduler for cron jobs
        if self._cron_jobs:
            self._scheduler_task = asyncio.create_task(self._scheduler_loop())

        logger.info("Task queue started")

    async def stop(self) -> None:
        """Stop the task queue and worker pool."""
        self._running = False
        await self._worker_pool.stop()

        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass

        logger.info("Task queue stopped")

    async def _scheduler_loop(self) -> None:
        """Scheduler loop for cron jobs."""
        from croniter import croniter

        while self._running:
            try:
                now = datetime.now(timezone.utc)

                for schedule, func in self._cron_jobs.items():
                    cron = croniter(schedule, now)
                    next_run = next(cron)

                    if next_run <= now:
                        # Run the scheduled task
                        asyncio.create_task(func())

                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}")
                await asyncio.sleep(60)


# ============================================================================
# Global Queue Instance
# ============================================================================

_global_queue: TaskQueue | None = None


def get_task_queue() -> TaskQueue:
    """Get or create the global task queue instance."""
    global _global_queue

    if _global_queue is None:
        # Check for Redis configuration
        redis_enabled = os.environ.get("TASK_QUEUE_REDIS_ENABLED", "false").lower() == "true"

        if redis_enabled:
            storage = RedisStorage(
                host=os.environ.get("TASK_QUEUE_REDIS_HOST", "localhost"),
                port=int(os.environ.get("TASK_QUEUE_REDIS_PORT", "6379")),
                db=int(os.environ.get("TASK_QUEUE_REDIS_DB", "0")),
                password=os.environ.get("TASK_QUEUE_REDIS_PASSWORD"),
            )
        else:
            # Use file-based persistence
            persist_path = Path(os.environ.get("TASK_QUEUE_PERSIST_PATH", "~/.auto-claude/task-queue.json")).expanduser()
            storage = InMemoryStorage(persist_path=persist_path)

        _global_queue = TaskQueue(
            storage=storage,
            min_workers=int(os.environ.get("TASK_QUEUE_MIN_WORKERS", "2")),
            max_workers=int(os.environ.get("TASK_QUEUE_MAX_WORKERS", "10")),
        )

    return _global_queue


# ============================================================================
# Convenience Decorators
# ============================================================================


def background_task(
    name: str | None = None,
    priority: TaskPriority = TaskPriority.MEDIUM,
):
    """Decorator to register a background task function.

    Usage:
        @background_task(name="send_email", priority=TaskPriority.HIGH)
        async def send_email(recipient: str, subject: str, body: str):
            # Email sending logic
            pass

        # Enqueue the task
        await queue.enqueue("send_email", args=["user@example.com", "Hello", "Body"])
    """
    def decorator(func: F) -> F:
        task_name = name or func.__name__

        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)

        # Register with global queue when it's created
        queue = get_task_queue()
        queue._worker_pool.register_task(task_name, wrapper)

        return cast(F, wrapper)

    return decorator


def scheduled_task(schedule: str):
    """Decorator to register a scheduled (cron) task.

    Usage:
        @scheduled_task("0 0 * * *")  # Daily at midnight
        async def daily_report():
            # Generate report logic
            pass
    """
    def decorator(func: Callable):
        queue = get_task_queue()
        return queue.cron(schedule)(func)
    return decorator
