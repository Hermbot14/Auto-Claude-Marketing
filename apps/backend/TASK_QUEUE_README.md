# Background Task Queue System

## Overview

The Task Queue is a robust, enterprise-grade background job processing system for Auto Claude Marketing Hub. It provides priority-based task scheduling, worker pool management, persistent storage, and real-time progress tracking.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Task Queue API                        │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Task Decorator│  │ Task Storage│  │ Worker Pool  │  │
│  │              │  │ (Redis/File) │  │              │  │
│  │ @background_task│ │              │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                     │                    │           │
│         └─────────────────────┴────────────────────┘           │
│                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Components

1. **Task Queue API** (`core/task_queue.py`)
   - Decorators for task registration
   - Enqueue/schedule operations
   - Progress tracking
   - Statistics aggregation

2. **Task Storage** (`InMemoryStorage` / `RedisStorage`)
   - Persistent task storage
   - Priority-based queue
   - Task state management

3. **Worker Pool** (`WorkerPool`)
   - Auto-scaling workers
   - Task execution
   - Error handling and retries

4. **Webhook Notifier** (`WebhookNotifier`)
   - Task completion notifications
   - HTTP webhook delivery

5. **Workers** (`workers/*.py`)
   - `content_worker.py`: Content generation and publishing
   - `email_worker.py`: Email campaigns
   - `analytics_worker.py`: Analytics aggregation
   - `cleanup_worker.py`: Maintenance tasks

## Installation

### Requirements

The task queue system has optional dependencies for enhanced functionality:

```bash
# For Redis backend (recommended for distributed processing)
pip install redis>=5.0.0

# For Celery integration (optional)
pip install celery[redis]>=5.3.0

# For scheduled tasks (cron)
pip install croniter>=2.0.0
```

### Configuration

Environment variables for task queue configuration:

```bash
# Enable Redis backend (default: file-based persistence)
TASK_QUEUE_REDIS_ENABLED=true
TASK_QUEUE_REDIS_HOST=localhost
TASK_QUEUE_REDIS_PORT=6379
TASK_QUEUE_REDIS_DB=0
TASK_QUEUE_REDIS_PASSWORD=your_password

# Worker configuration
TASK_QUEUE_MIN_WORKERS=2
TASK_QUEUE_MAX_WORKERS=10

# Persistence path for file-based backend
TASK_QUEUE_PERSIST_PATH=~/.auto-claude/task-queue.json
```

## Usage

### 1. Define a Task Function

Use the `@background_task` decorator to register a task function:

```python
from core.task_queue import background_task, TaskPriority

@background_task(name="send_email", priority=TaskPriority.HIGH)
async def send_email(recipient: str, subject: str, body: str):
    # Your email sending logic here
    await email_service.send(recipient, subject, body)
    return {"sent": True, "message_id": "msg-123"}
```

### 2. Enqueue a Task

Use the task queue API to enqueue tasks:

```python
from core.task_queue import get_task_queue, TaskPriority

# Get the global queue instance
queue = get_task_queue()

# Start the queue (starts worker pool)
await queue.start()

# Enqueue a task
task_id = await queue.enqueue(
    name="send_email",
    args=["user@example.com", "Welcome", "Body text"],
    kwargs={"subject": "Welcome Email"},
    priority=TaskPriority.HIGH,
    max_retries=3,
    timeout=300,
    webhook_url="https://example.com/webhook",
)

# Enqueue a scheduled task
import datetime
scheduled_time = datetime.datetime(2024, 1, 1, 12, 0, tzinfo=datetime.timezone.utc)
task_id = await queue.enqueue(
    name="send_email",
    args=["user@example.com", "Happy New Year", "Body"],
    scheduled_at=scheduled_time.timestamp(),
)
```

### 3. Track Progress

Update task progress during execution:

```python
from core.task_queue import TaskProgress

async def my_task(task_id: str):
    # Create progress object
    progress = TaskProgress(
        task_id=task_id,
        progress=0,
        message="Starting task..."
    )

    # Update progress
    progress.progress = 25
    progress.message = "Processing step 1"
    await queue.update_progress(task_id, progress.progress, progress.message)

    # Continue with work...
    progress.progress = 50
    progress.message = "Processing step 2"
    await queue.update_progress(task_id, progress.progress, progress.message)

    progress.progress = 100
    progress.message = "Complete"
    await queue.update_progress(task_id, progress.progress, progress.message)
```

### 4. Register Progress Callbacks

Register for real-time progress updates:

```python
def on_progress_update(progress: TaskProgress):
    print(f"Progress: {progress.progress}% - {progress.message}")
    # Send WebSocket update to frontend
    # await websocket.send(progress.model_dump())

# Register the callback
cleanup = queue.register_progress_callback("task-123", on_progress_update)

# Later cleanup
cleanup()
```

### 5. Monitor Queue Status

Get queue statistics and task status:

```python
# Get queue statistics
stats = await queue.get_queue_stats()
print(f"Total tasks: {stats['total_tasks']}")
print(f"Pending: {stats['pending']}")
print(f"Running: {stats['running']}")
print(f"Workers: {stats['worker_stats']['total_workers']}")

# Get specific task status
task_status = await queue.get_task_status("task-123")
print(f"Task status: {task_status['status']}")

# Get all tasks
all_tasks = await queue.get_all_tasks()
```

### 6. Schedule Cron Tasks

Use the `@scheduled_task` decorator for recurring tasks:

```python
from core.task_queue import scheduled_task

@scheduled_task("0 0 * * *")  # Daily at midnight
async def daily_report():
    # Generate daily report
    await analytics.generate_report()

@scheduled_task("0 */6 * * *")  # Every 6 hours
async def cleanup_cache():
    # Clear cache
    await cache.clear()
```

## Built-in Workers

### Content Worker

Handles content generation and publishing:

```python
from workers.content_worker import generate_blog_post, publish_content
from workers import ContentGenerationTask, ContentPublishingTask

# Generate blog post
task = ContentGenerationTask(
    content_type="blog",
    topic="AI in Marketing",
    tone="professional",
    length="medium",
    keywords=["AI", "marketing", "automation"],
)
result = await generate_blog_post(task, "task-123")

# Publish to platforms
publish_task = ContentPublishingTask(
    content_id=result.content_id,
    platforms=["wordpress", "medium", "linkedin"],
)
await publish_content(publish_task, "task-456")
```

### Email Worker

Handles email campaigns:

```python
from workers.email_worker import send_email_campaign, get_campaign_stats
from workers import EmailCampaignTask

# Send campaign
task = EmailCampaignTask(
    campaign_id="camp-123",
    subject="Summer Sale",
    template="promotion",
    recipient_segment="active_users",
    variables={"discount": "20%"},
)
result = await send_email_campaign(task, "task-789")

# Get statistics
stats = await get_campaign_stats("camp-123", "task-stats-456")
print(f"Open rate: {stats.open_rate}%")
```

### Analytics Worker

Handles analytics aggregation:

```python
from workers.analytics_worker import aggregate_analytics, generate_analytics_report
from workers import AnalyticsAggregationTask, AnalyticsReportTask

# Aggregate metrics
task = AnalyticsAggregationTask(
    metric_type="traffic",
    time_range="weekly",
    dimensions=["page", "source"],
)
metrics = await aggregate_analytics(task, "task-analytics-1")

# Generate report
report_task = AnalyticsReportTask(
    report_type="executive",
    format="pdf",
    include_sections=["traffic", "engagement", "conversions"],
)
report = await generate_analytics_report(report_task, "task-report-2")
```

### Cleanup Worker

Handles maintenance tasks:

```python
from workers.cleanup_worker import cleanup_old_logs, archive_completed_tasks
from workers import CleanupTask, ArchiveTask

# Clean old logs
cleanup_task = CleanupTask(
    task_type="logs",
    older_than_days=30,
    compress=True,
)
result = await cleanup_old_logs(cleanup_task, "task-cleanup-1")

# Archive completed tasks
archive_task = ArchiveTask(
    task_type="tasks",
    time_range="monthly",
    compress_output=True,
)
result = await archive_completed_tasks(archive_task, "task-archive-2")
```

## Priority Levels

Tasks are processed in priority order (lower number = higher priority):

| Priority | Value | Use Case                      |
|----------|-------|-------------------------------|
| URGENT  | 0     | Production fixes, security issues |
| HIGH     | 1     | User requests, important features |
| MEDIUM   | 2     | Standard tasks, batch jobs    |
| LOW      | 3     | Background reports, maintenance  |

## Task Lifecycle

1. **PENDING** → Task created, waiting to be queued
2. **QUEUED** → Task in queue, waiting for worker
3. **RUNNING** → Worker executing the task
4. **COMPLETED** → Task finished successfully
5. **FAILED** → Task failed after all retries
6. **RETRYING** → Task being retried after failure
7. **CANCELLED** → Task cancelled by user

## Frontend Integration

### IPC Handlers

Add to your main process IPC handlers:

```typescript
// Queue operations
ipcMain.handle('getQueueTasks', async () => {
  const tasks = await taskQueue.getAllTasks();
  const workers = await taskQueue.getWorkerStats();
  return { success: true, data: { tasks, workers } };
});

ipcMain.handle('enqueueTask', async (_, name, args, priority) => {
  const taskId = await taskQueue.enqueue(name, args, priority);
  return { success: true, data: { taskId } };
});

ipcMain.handle('cancelQueueTask', async (_, taskId) => {
  await taskQueue.cancel(taskId);
  return { success: true };
});

// Statistics
ipcMain.handle('getQueueStats', async () => {
  const stats = await taskQueue.getStats();
  return { success: true, data: stats };
});
```

### WebSocket Updates

Push progress updates to frontend:

```python
async def _notify_progress(self, progress: TaskProgress) -> None:
    # Send to connected WebSocket clients
    for client in websocket_clients:
        await client.send_json({
            "type": "task_progress",
            "data": progress.model_dump()
        })
```

## Monitoring

### Metrics Collected

- Total tasks processed
- Tasks by status (pending, running, completed, failed)
- Average task duration
- Worker utilisation
- Queue depth by priority
- Retry rate

### Health Checks

Monitor queue health:

```python
stats = await queue.get_queue_stats()

# Health indicators
is_healthy = (
    stats['worker_stats']['active_workers'] < stats['worker_stats']['total_workers'] and
    stats['pending'] < 1000 and
    stats['failed'] / (stats['total_tasks'] or 1) < 0.1
)
```

## Testing

### Load Testing

Test with high load:

```python
import asyncio
from core.task_queue import get_task_queue

async def load_test():
    queue = get_task_queue()
    await queue.start()

    # Enqueue 1000+ tasks
    task_ids = []
    for i in range(1500):
        task_id = await queue.enqueue(
            name="test_task",
            args=[i],
            priority=TaskPriority.MEDIUM,
        )
        task_ids.append(task_id)

    # Monitor progress
    while True:
        stats = await queue.get_queue_stats()
        completed = stats['completed']
        if completed >= len(task_ids):
            print(f"All {completed} tasks completed")
            break
        await asyncio.sleep(5)
```

## Troubleshooting

### Tasks Not Processing

1. Check queue is started: `await queue.start()`
2. Check worker pool: Ensure workers are not all stopped
3. Check task dependencies: Dependent tasks must complete first
4. Check scheduled time: Scheduled tasks wait for their time

### Workers Not Starting

1. Check min/max worker configuration
2. Check for errors in worker logs
3. Verify Redis connection (if using Redis backend)

### High Memory Usage

1. Reduce max workers
2. Enable task persistence (Redis)
3. Clear completed tasks regularly
4. Use task result streaming for large results

## Best Practices

1. **Always use decorators** - Register tasks with `@background_task`
2. **Set appropriate timeouts** - Prevent hanging tasks
3. **Use progress updates** - Keep users informed
4. **Handle errors gracefully** - Implement proper retry logic
5. **Clean up resources** - Clear completed tasks regularly
6. **Monitor queue depth** - Scale workers based on load
7. **Use priorities wisely** - Reserve URGENT for critical issues
8. **Test with load** - Verify system handles 1000+ concurrent tasks
