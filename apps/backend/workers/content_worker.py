"""
Content Worker
==============

Handles content generation and publishing tasks for the Auto Claude Marketing Hub.

Tasks:
- Blog post generation
- Social media content creation
- Newsletter drafting
- Content publishing to multiple platforms
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from core.task_queue import TaskProgress, TaskPriority

logger = logging.getLogger(__name__)


# ============================================================================
# Task Definitions
# ============================================================================


class ContentGenerationTask(BaseModel):
    """Configuration for content generation tasks."""

    content_type: str = Field(description="Type of content: blog, social, newsletter")
    topic: str = Field(description="Content topic or prompt")
    tone: str = Field(default="professional", description="Content tone")
    length: str = Field(default="medium", description="Content length: short, medium, long")
    target_platform: str | None = Field(default=None, description="Target platform if known")
    keywords: list[str] = Field(default_factory=list, description="SEO keywords")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ContentPublishingTask(BaseModel):
    """Configuration for content publishing tasks."""

    content_id: str = Field(description="ID of content to publish")
    platforms: list[str] = Field(description="Platforms to publish to")
    schedule_at: datetime | None = Field(default=None, description="Scheduled publish time")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Publishing metadata")


class GeneratedContent(BaseModel):
    """Result of content generation."""

    content_id: str
    title: str
    body: str
    summary: str
    word_count: int
    keywords: list[str]
    suggested_images: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PublishingResult(BaseModel):
    """Result of content publishing."""

    content_id: str
    platforms: dict[str, bool] = Field(description="Platform -> success status")
    published_urls: dict[str, str] = Field(default_factory=dict)
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# Content Generation Functions
# ============================================================================


async def generate_blog_post(task: ContentGenerationTask, task_id: str) -> GeneratedContent:
    """Generate a blog post based on the task configuration.

    Args:
        task: Content generation configuration
        task_id: Task ID for progress tracking

    Returns:
        Generated blog post content
    """
    # Update progress
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting blog post generation")

    # Simulate content generation (replace with actual AI integration)
    await asyncio.sleep(2)
    progress.progress = 20
    progress.message = "Analyzing topic and keywords"
    # Progress would be sent via callback in real implementation

    await asyncio.sleep(3)
    progress.progress = 50
    progress.message = f"Generating content for: {task.topic}"

    # Generate content (simulated - integrate with actual content AI)
    title = f"Blog Post: {task.topic}"
    body = f"""
# {task.topic}

This is a {task.length} blog post about {task.topic}.

## Introduction

In today's {task.tone} discussion of {task.topic}, we explore several key aspects...

## Key Points

- Point 1: Important consideration about {task.topic}
- Point 2: Analysis and implications
- Point 3: Recommendations and best practices

## Conclusion

{task.topic} represents a significant area of focus for modern marketing strategies.
"""

    await asyncio.sleep(2)
    progress.progress = 80
    progress.message = "Finalizing blog post"

    await asyncio.sleep(1)
    progress.progress = 100
    progress.message = "Blog post generation complete"

    logger.info(f"Generated blog post for topic: {task.topic}")

    return GeneratedContent(
        content_id=f"blog-{task_id}",
        title=title,
        body=body,
        summary=f"Blog post about {task.topic}",
        word_count=len(body.split()),
        keywords=task.keywords,
        metadata={"content_type": "blog", "tone": task.tone},
    )


async def generate_social_media(task: ContentGenerationTask, task_id: str) -> GeneratedContent:
    """Generate social media content based on the task configuration.

    Args:
        task: Content generation configuration
        task_id: Task ID for progress tracking

    Returns:
        Generated social media content
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting social media content generation")

    await asyncio.sleep(1)
    progress.progress = 25
    progress.message = f"Creating social media content for: {task.topic}"

    await asyncio.sleep(2)
    progress.progress = 60
    progress.message = "Generating platform-specific variations"

    # Generate social media content
    if task.target_platform == "twitter":
        body = f"{task.topic}\n\n{' '.join(['#' + kw for kw in task.keywords[:3]])}"
        title = f"Tweet about {task.topic}"
    elif task.target_platform == "linkedin":
        body = f"""
{task.topic}

{' '.join(['#' + kw for kw in task.keywords[:3]])}

#Marketing #DigitalMarketing #ContentStrategy
        """.strip()
        title = f"LinkedIn post about {task.topic}"
    else:
        # Generic social media post
        body = f"{task.topic}\n\n{' '.join(['#' + kw for kw in task.keywords[:3]])}"
        title = f"Social post about {task.topic}"

    await asyncio.sleep(1)
    progress.progress = 100
    progress.message = "Social media content generation complete"

    logger.info(f"Generated social media content for topic: {task.topic}")

    return GeneratedContent(
        content_id=f"social-{task_id}",
        title=title,
        body=body,
        summary=f"Social media post about {task.topic}",
        word_count=len(body.split()),
        keywords=task.keywords,
        metadata={"content_type": "social", "platform": task.target_platform},
    )


async def generate_newsletter(task: ContentGenerationTask, task_id: str) -> GeneratedContent:
    """Generate a newsletter based on the task configuration.

    Args:
        task: Content generation configuration
        task_id: Task ID for progress tracking

    Returns:
        Generated newsletter content
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting newsletter generation")

    await asyncio.sleep(2)
    progress.progress = 30
    progress.message = "Structuring newsletter content"

    await asyncio.sleep(3)
    progress.progress = 60
    progress.message = f"Writing newsletter sections for: {task.topic}"

    # Generate newsletter
    body = f"""
# Newsletter - {datetime.now().strftime('%B %d, %Y')}

## In This Issue

- Feature Article: {task.topic}
- Industry Insights
- Quick Tips
- Upcoming Events

## {task.topic}

{task.topic} continues to be a trending topic in our industry. In this article, we explore...

## Tips & Resources

Here are some quick tips related to {task.keywords[0] if task.keywords else 'marketing'}:

1. Start with clear objectives
2. Measure and iterate
3. Engage with your audience

## Stay Connected

Follow us for more insights and updates.
    """.strip()

    await asyncio.sleep(2)
    progress.progress = 100
    progress.message = "Newsletter generation complete"

    logger.info(f"Generated newsletter for topic: {task.topic}")

    return GeneratedContent(
        content_id=f"newsletter-{task_id}",
        title=f"Newsletter: {task.topic}",
        body=body,
        summary=f"Newsletter featuring {task.topic}",
        word_count=len(body.split()),
        keywords=task.keywords,
        metadata={"content_type": "newsletter", "tone": task.tone},
    )


# ============================================================================
# Content Publishing Functions
# ============================================================================


async def publish_content(task: ContentPublishingTask, task_id: str) -> PublishingResult:
    """Publish content to specified platforms.

    Args:
        task: Content publishing configuration
        task_id: Task ID for progress tracking

    Returns:
        Publishing result with platform-specific URLs
    """
    progress = TaskProgress(task_id=task_id, progress=0, message="Starting content publishing")

    results: dict[str, bool] = {}
    urls: dict[str, str] = {}

    for platform in task.platforms:
        progress.progress = len(urls) / len(task.platforms) * 100
        progress.message = f"Publishing to {platform}..."

        await asyncio.sleep(2)

        # Simulate platform-specific publishing
        if platform == "wordpress":
            results[platform] = True
            urls[platform] = f"https://example.com/blog/{task.content_id}"
            logger.info(f"Published to WordPress: {urls[platform]}")
        elif platform == "medium":
            results[platform] = True
            urls[platform] = f"https://medium.com/p/{task.content_id}"
            logger.info(f"Published to Medium: {urls[platform]}")
        elif platform == "linkedin":
            results[platform] = True
            urls[platform] = f"https://linkedin.com/posts/{task.content_id}"
            logger.info(f"Published to LinkedIn: {urls[platform]}")
        elif platform == "twitter":
            results[platform] = True
            urls[platform] = f"https://twitter.com/status/{task.content_id}"
            logger.info(f"Published to Twitter: {urls[platform]}")
        else:
            results[platform] = False
            logger.warning(f"Unknown platform: {platform}")

    progress.progress = 100
    progress.message = "Content publishing complete"

    return PublishingResult(
        content_id=task.content_id,
        platforms=results,
        published_urls=urls,
        published_at=datetime.now(timezone.utc),
    )


async def schedule_content(task: ContentPublishingTask, task_id: str) -> str:
    """Schedule content for future publishing.

    Args:
        task: Content publishing configuration
        task_id: Task ID for progress tracking

    Returns:
        Scheduled task ID
    """
    from core.task_queue import get_task_queue

    queue = get_task_queue()

    if task.schedule_at:
        # Calculate delay for scheduling
        from datetime import timezone
        now = datetime.now(timezone.utc)
        delay = (task.schedule_at - now).total_seconds()

        # Enqueue with scheduled time
        scheduled_task_id = await queue.enqueue(
            name="publish_content",
            kwargs={"task": task.model_dump()},
            priority=TaskPriority.MEDIUM,
            scheduled_at=task.schedule_at.timestamp(),
        )

        logger.info(f"Scheduled content {task.content_id} for {task.schedule_at}")
        return scheduled_task_id

    # If no schedule, publish immediately
    result = await publish_content(task, task_id)
    return task.content_id


# ============================================================================
# Batch Operations
# ============================================================================


async def batch_generate_content(
    tasks: list[ContentGenerationTask], task_id: str
) -> list[GeneratedContent]:
    """Generate multiple content items in batch.

    Args:
        tasks: List of content generation tasks
        task_id: Parent task ID for progress tracking

    Returns:
        List of generated content items
    """
    progress = TaskProgress(
        task_id=task_id,
        progress=0,
        message=f"Starting batch generation of {len(tasks)} items",
        total_steps=len(tasks),
    )

    results = []
    for i, task in enumerate(tasks):
        progress.current_step = f"Generating item {i + 1}/{len(tasks)}"
        progress.progress = (i / len(tasks)) * 100

        if task.content_type == "blog":
            result = await generate_blog_post(task, f"{task_id}-{i}")
        elif task.content_type == "social":
            result = await generate_social_media(task, f"{task_id}-{i}")
        elif task.content_type == "newsletter":
            result = await generate_newsletter(task, f"{task_id}-{i}")
        else:
            logger.warning(f"Unknown content type: {task.content_type}")
            continue

        results.append(result)

    progress.progress = 100
    progress.message = f"Batch generation complete: {len(results)} items generated"

    logger.info(f"Batch generated {len(results)} content items")
    return results


# ============================================================================
# Integration with Task Queue
# ============================================================================


def register_content_workers():
    """Register all content worker functions with the task queue."""
    from core.task_queue import get_task_queue, background_task

    queue = get_task_queue()

    # Register individual tasks
    queue._worker_pool.register_task("generate_blog_post", generate_blog_post)
    queue._worker_pool.register_task("generate_social_media", generate_social_media)
    queue._worker_pool.register_task("generate_newsletter", generate_newsletter)
    queue._worker_pool.register_task("publish_content", publish_content)
    queue._worker_pool.register_task("schedule_content", schedule_content)
    queue._worker_pool.register_task("batch_generate_content", batch_generate_content)

    logger.info("Content workers registered with task queue")
