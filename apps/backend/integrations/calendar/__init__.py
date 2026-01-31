"""
Calendar Integration Package

Provides integrations with external calendar and scheduling services:
- Google Calendar
- Social Media Schedulers (Buffer, Hootsuite, etc.)
- Email Marketing Platforms
- Analytics Platforms

Usage:
    from integrations.calendar import get_google_calendar_client, get_buffer_client

    # Google Calendar
    google_client = get_google_calendar_client()
    if google_client and google_client.authenticate():
        events = google_client.list_events()

    # Buffer
    buffer_client = get_buffer_client(api_key='...')
    if buffer_client and buffer_client.authenticate():
        posts = buffer_client.get_scheduled_posts()
"""

from .google import (
    GoogleCalendarIntegration,
    GoogleCalendarEvent,
    get_google_calendar_client,
)

from .social import (
    SocialPlatform,
    ScheduledPost,
    SocialSchedulerIntegration,
    BufferIntegration,
    HootsuiteIntegration,
    get_buffer_client,
    get_hootsuite_client,
    get_all_scheduled_posts,
)

__all__ = [
    # Google Calendar
    'GoogleCalendarIntegration',
    'GoogleCalendarEvent',
    'get_google_calendar_client',

    # Social Media Schedulers
    'SocialPlatform',
    'ScheduledPost',
    'SocialSchedulerIntegration',
    'BufferIntegration',
    'HootsuiteIntegration',
    'get_buffer_client',
    'get_hootsuite_client',
    'get_all_scheduled_posts',
]
