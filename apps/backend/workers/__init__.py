"""
Task Workers Package
==================

Worker implementations for background task processing.

Each worker module handles specific types of tasks:
- content_worker.py: Content generation and publishing
- email_worker.py: Email campaign management
- analytics_worker.py: Analytics aggregation
- cleanup_worker.py: Maintenance and cleanup tasks
"""

from workers.content_worker import (
    ContentGenerationTask,
    ContentPublishingTask,
    generate_blog_post,
    generate_social_media,
    publish_content,
)
from workers.email_worker import (
    EmailCampaignTask,
    EmailCampaignStats,
    send_email_campaign,
    get_campaign_stats,
)
from workers.analytics_worker import (
    AnalyticsAggregationTask,
    AnalyticsReportTask,
    aggregate_analytics,
    generate_analytics_report,
)
from workers.cleanup_worker import (
    CleanupTask,
    ArchiveTask,
    cleanup_old_logs,
    archive_completed_tasks,
    compress_old_data,
)

__all__ = [
    # Content Workers
    "ContentGenerationTask",
    "ContentPublishingTask",
    "generate_blog_post",
    "generate_social_media",
    "publish_content",
    # Email Workers
    "EmailCampaignTask",
    "EmailCampaignStats",
    "send_email_campaign",
    "get_campaign_stats",
    # Analytics Workers
    "AnalyticsAggregationTask",
    "AnalyticsReportTask",
    "aggregate_analytics",
    "generate_analytics_report",
    # Cleanup Workers
    "CleanupTask",
    "ArchiveTask",
    "cleanup_old_logs",
    "archive_completed_tasks",
    "compress_old_data",
]
