"""
Social Media Scheduler Integration for Marketing Calendar

This module provides integration with popular social media scheduling platforms:
- Buffer
- Hootsuite
- Sprout Social
- Later

Supports scheduling posts, retrieving scheduled content, and syncing with marketing calendar.
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import requests

from core.logger import logger


class SocialPlatform(Enum):
    """Supported social media platforms"""
    TWITTER = "twitter"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"
    TIKTOK = "tiktok"
    PINTEREST = "pinterest"
    YOUTUBE = "youtube"


@dataclass
class ScheduledPost:
    """Represents a scheduled social media post"""
    id: str
    platform: SocialPlatform
    content: str
    media_urls: List[str]
    scheduled_time: datetime
    status: str  # scheduled, published, failed
    profile_id: str
    profile_name: str
    hashtags: List[str]
    link_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    source: str = 'social-scheduler'

    def __post_init__(self):
        if self.media_urls is None:
            self.media_urls = = []
        if self.hashtags is None:
            self.hashtags = []

    @classmethod
    def from_buffer_response(cls, post_data: Dict[str, Any]) -> 'ScheduledPost':
        """Create ScheduledPost from Buffer API response"""
        return cls(
            id=post_data.get('id', ''),
            platform=SocialPlatform(post_data.get('service', 'twitter').lower()),
            content=post_data.get('text', ''),
            media_urls=[
                media.get('url', '')
                for media in post_data.get('media', {}).get('photo', [])
            ] if post_data.get('media') else [],
            scheduled_time=datetime.fromisoformat(
                post_data.get('scheduled_at', datetime.now().isoformat())
            ),
            status=post_data.get('status', 'scheduled'),
            profile_id=str(post_data.get('profile_id', '')),
            profile_name=post_data.get('profile_service', 'Unknown'),
            hashtags=[],
            link_url=post_data.get('link'),
        )

    @classmethod
    def from_hootsuite_response(cls, post_data: Dict[str, Any]) -> 'ScheduledPost':
        """Create ScheduledPost from Hootsuite API response"""
        return cls(
            id=post_data.get('id', ''),
            platform=SocialPlatform(post_data.get('socialProfileType', 'twitter').lower()),
            content=post_data.get('text', ''),
            media_urls=[],
            scheduled_time=datetime.fromisoformat(
                post_data.get('scheduledSendTime', datetime.now().isoformat())
            ),
            status=post_data.get('status', 'scheduled'),
            profile_id=str(post_data.get('socialProfileId', '')),
            profile_name=post_data.get('socialProfileUsername', 'Unknown'),
            hashtags=[tag.get('name', '') for tag in post_data.get('tags', [])],
        )

    def to_calendar_item(self) -> Dict[str, Any]:
        """Convert to internal calendar item format"""
        return {
            'id': f"social-{self.source}-{self.id}",
            'title': self._generate_title(),
            'description': self._truncate_content(),
            'type': 'social',
            'status': self._map_status(),
            'source': 'external',
            'startDate': self.scheduled_time,
            'allDay': False,
            'tags': self._generate_tags(),
            'externalEventId': self.id,
            'externalSource': self.source,
            'location': f"@{self.profile_name}",
            'notes': f"Platform: {self.platform.value}\nLink: {self.link_url or 'N/A'}",
        }

    def _generate_title(self) -> str:
        """Generate title from content"""
        if not self.content:
            return f"Post to {self.platform.value}"
        # Use first 50 chars as title
        title = self.content[:50]
        if len(self.content) > 50:
            title += "..."
        return title

    def _truncate_content(self) -> str:
        """Truncate content for description"""
        max_length = 200
        if len(self.content) <= max_length:
            return self.content
        return self.content[:max_length] + "..."

    def _map_status(self) -> str:
        """Map scheduler status to calendar status"""
        if self.status == 'published':
            return 'published'
        elif self.status == 'failed':
            return 'cancelled'
        else:
            return 'scheduled'

    def _generate_tags(self) -> List[str]:
        """Generate tags from post properties"""
        tags = [self.source, self.platform.value]

        # Add platform-specific tags
        if self.platform == SocialPlatform.INSTAGRAM:
            tags.extend(['instagram', 'visual', 'image'])
        elif self.platform == SocialPlatform.TWITTER:
            tags.extend(['twitter', 'x', 'microblog'])
        elif self.platform == SocialPlatform.LINKEDIN:
            tags.extend(['linkedin', 'professional', 'networking'])
        elif self.platform == SocialPlatform.FACEBOOK:
            tags.extend(['facebook', 'social'])

        # Add hashtag tags
        if self.hashtags:
            tags.extend([f"#{tag}" for tag in self.hashtags[:3]])

        return tags


class SocialSchedulerIntegration:
    """Base class for social media scheduler integrations"""

    def __init__(self, api_key: str, api_secret: Optional[str] = None):
        """
        Initialize social scheduler integration

        Args:
            api_key: API key for the scheduler service
            api_secret: API secret (if required)
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self._authenticated = False

    def authenticate(self) -> bool:
        """Authenticate with the scheduler API"""
        raise NotImplementedError("Subclasses must implement authenticate()")

    def is_authenticated(self) -> bool:
        """Check if client is authenticated"""
        return self._authenticated

    def get_scheduled_posts(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        profile_ids: Optional[List[str]] = None,
    ) -> List[ScheduledPost]:
        """
        Get scheduled posts from the scheduler

        Args:
            start_date: Start of date range
            end_date: End of date range
            profile_ids: Filter by profile IDs

        Returns:
            List of ScheduledPost objects
        """
        raise NotImplementedError("Subclasses must implement get_scheduled_posts()")

    def create_post(
        self,
        post: ScheduledPost,
    ) -> Optional[str]:
        """
        Schedule a new post

        Args:
            post: ScheduledPost to create

        Returns:
            Created post ID or None if failed
        """
        raise NotImplementedError("Subclasses must implement create_post()")

    def update_post(
        self,
        post_id: str,
        post: ScheduledPost,
    ) -> bool:
        """
        Update an existing scheduled post

        Args:
            post_id: ID of post to update
            post: Updated ScheduledPost data

        Returns:
            True if successful, False otherwise
        """
        raise NotImplementedError("Subclasses must implement update_post()")

    def delete_post(
        self,
        post_id: str,
    ) -> bool:
        """
        Delete a scheduled post

        Args:
            post_id: ID of post to delete

        Returns:
            True if successful, False otherwise
        """
        raise NotImplementedError("Subclasses must implement delete_post()")

    def sync_to_marketing_calendar(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Sync scheduled posts to marketing calendar format

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of calendar items in marketing calendar format
        """
        posts = self.get_scheduled_posts(start_date, end_date)
        return [post.to_calendar_item() for post in posts]


class BufferIntegration(SocialSchedulerIntegration):
    """Buffer social media scheduler integration"""

    API_BASE_URL = "https://api.bufferapp.com/1"

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.session = requests.Session()

    def authenticate(self) -> bool:
        """Authenticate with Buffer API"""
        try:
            response = self.session.get(
                f"{self.API_BASE_URL}/user.json",
                params={'access_token': self.api_key}
            )
            response.raise_for_status()

            self._authenticated = True
            logger.info("Successfully authenticated with Buffer API")
            return True

        except requests.RequestException as e:
            logger.error(f"Failed to authenticate with Buffer: {e}")
            self._authenticated = False
            return False

    def get_scheduled_posts(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        profile_ids: Optional[List[str]] = None,
    ) -> List[ScheduledPost]:
        """Get scheduled posts from Buffer"""
        if not self.is_authenticated():
            return []

        try:
            # Get profiles first
            profiles_response = self.session.get(
                f"{self.API_BASE_URL}/profiles.json",
                params={'access_token': self.api_key}
            )
            profiles_response.raise_for_status()

            profiles = profiles_response.json()
            all_posts = []

            for profile in profiles:
                profile_id = profile.get('_id', '')

                # Filter by profile IDs if specified
                if profile_ids and profile_id not in profile_ids:
                    continue

                # Get pending updates for profile
                updates_response = self.session.get(
                    f"{self.API_BASE_URL}/profiles/{profile_id}/updates/pending.json",
                    params={'access_token': self.api_key}
                )
                updates_response.raise_for_status()

                updates = updates_response.json()
                for update in updates:
                    post = ScheduledPost.from_buffer_response(update)
                    all_posts.append(post)

            logger.info(f"Fetched {len(all_posts)} scheduled posts from Buffer")
            return all_posts

        except requests.RequestException as e:
            logger.error(f"Error fetching posts from Buffer: {e}")
            return []

    def create_post(self, post: ScheduledPost) -> Optional[str]:
        """Create a new scheduled post in Buffer"""
        if not self.is_authenticated():
            return None

        try:
            # Buffer uses profile_id to determine platform
            # We need to map platform to profile ID
            # For simplicity, we'll use the first available profile

            # Get profiles to find matching one
            profiles_response = self.session.get(
                f"{self.API_BASE_URL}/profiles.json",
                params={'access_token': self.api_key}
            )
            profiles_response.raise_for_status()
            profiles = profiles_response.json()

            # Find profile for the post's platform
            profile_id = None
            for profile in profiles:
                if profile.get('formatted_service') == post.platform.value:
                    profile_id = profile.get('_id')
                    break

            if not profile_id:
                logger.error(f"No profile found for platform: {post.platform.value}")
                return None

            # Create update
            update_data = {
                'text': post.content,
                'profile_ids': [profile_id],
                'scheduled_at': post.scheduled_time.isoformat(),
                'attachment': (False, post.link_url),
            }

            if post.media_urls:
                update_data['media'] = {'photo': post.media_urls}

            response = self.session.post(
                f"{self.API_BASE_URL}/updates/create.json",
                params={'access_token': self.api_key},
                data=update_data
            )
            response.raise_for_status()

            result = response.json()
            logger.info(f"Created post in Buffer: {result.get('updates', [{}])[0].get('id')}")
            return result.get('updates', [{}])[0].get('id')

        except requests.RequestException as e:
            logger.error(f"Error creating post in Buffer: {e}")
            return None

    def update_post(self, post_id: str, post: ScheduledPost) -> bool:
        """Update an existing scheduled post in Buffer"""
        # Buffer API doesn't directly support updating
        # Need to delete and recreate
        if self.delete_post(post_id):
            return self.create_post(post) is not None
        return False

    def delete_post(self, post_id: str) -> bool:
        """Delete a scheduled post from Buffer"""
        if not self.is_authenticated():
            return False

        try:
            response = self.session.post(
                f"{self.API_BASE_URL}/updates/{post_id}/destroy.json",
                params={'access_token': self.api_key}
            )
            response.raise_for_status()

            logger.info(f"Deleted post from Buffer: {post_id}")
            return True

        except requests.RequestException as e:
            logger.error(f"Error deleting post from Buffer: {e}")
            return False


class HootsuiteIntegration(SocialSchedulerIntegration):
    """Hootsuite social media scheduler integration"""

    API_BASE_URL = "https://platform.hootsuite.com/v1"

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
        })

    def authenticate(self) -> bool:
        """Authenticate with Hootsuite API"""
        try:
            response = self.session.get(f"{self.API_BASE_URL}/me")
            response.raise_for_status()

            self._authenticated = True
            logger.info("Successfully authenticated with Hootsuite API")
            return True

        except requests.RequestException as e:
            logger.error(f"Failed to authenticate with Hootsuite: {e}")
            self._authenticated = False
            return False

    def get_scheduled_posts(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        profile_ids: Optional[List[str]] = None,
    ) -> List[ScheduledPost]:
        """Get scheduled posts from Hootsuite"""
        if not self.is_authenticated():
            return []

        try:
            params = {}
            if start_date:
                params['startTime'] = start_date.isoformat()
            if end_date:
                params['endTime'] = end_date.isoformat()
            if profile_ids:
                params['socialProfileIds'] = ','.join(profile_ids)

            response = self.session.get(
                f"{self.API_BASE_URL}/schedules",
                params=params
            )
            response.raise_for_status()

            data = response.json()
            posts = [ScheduledPost.from_hootsuite_response(post) for post in data.get('data', [])]

            logger.info(f"Fetched {len(posts)} scheduled posts from Hootsuite")
            return posts

        except requests.RequestException as e:
            logger.error(f"Error fetching posts from Hootsuite: {e}")
            return []

    def create_post(self, post: ScheduledPost) -> Optional[str]:
        """Create a new scheduled post in Hootsuite"""
        if not self.is_authenticated():
            return None

        try:
            post_data = {
                'text': post.content,
                'socialProfileIds': [post.profile_id],
                'scheduledSendTime': post.scheduled_time.isoformat(),
                'media': [url for url in post.media_urls] if post.media_urls else [],
                'webhookUrl': post.link_url,
            }

            response = self.session.post(
                f"{self.API_BASE_URL}/messages",
                json=post_data
            )
            response.raise_for_status()

            data = response.json()
            post_id = data.get('data', {}).get('id')

            logger.info(f"Created post in Hootsuite: {post_id}")
            return post_id

        except requests.RequestException as e:
            logger.error(f"Error creating post in Hootsuite: {e}")
            return None

    def update_post(self, post_id: str, post: ScheduledPost) -> bool:
        """Update an existing scheduled post in Hootsuite"""
        if not self.is_authenticated():
            return False

        try:
            post_data = {
                'text': post.content,
                'scheduledSendTime': post.scheduled_time.isoformat(),
            }

            response = self.session.put(
                f"{self.API_BASE_URL}/messages/{post_id}",
                json=post_data
            )
            response.raise_for_status()

            logger.info(f"Updated post in Hootsuite: {post_id}")
            return True

        except requests.RequestException as e:
            logger.error(f"Error updating post in Hootsuite: {e}")
            return False

    def delete_post(self, post_id: str) -> bool:
        """Delete a scheduled post from Hootsuite"""
        if not self.is_authenticated():
            return False

        try:
            response = self.session.delete(f"{self.API_BASE_URL}/messages/{post_id}")
            response.raise_for_status()

            logger.info(f"Deleted post from Hootsuite: {post_id}")
            return True

        except requests.RequestException as e:
            logger.error(f"Error deleting post from Hootsuite: {e}")
            return False


# Singleton instances
_buffer_instance: Optional[BufferIntegration] = None
_hootsuite_instance: Optional[HootsuiteIntegration] = None


def get_buffer_client(api_key: str, force_new: bool = False) -> Optional[BufferIntegration]:
    """Get or create Buffer integration client"""
    global _buffer_instance
    if force_new or _buffer_instance is None:
        _buffer_instance = BufferIntegration(api_key)
    return _buffer_instance


def get_hootsuite_client(api_key: str, force_new: bool = False) -> Optional[HootsuiteIntegration]:
    """Get or create Hootsuite integration client"""
    global _hootsuite_instance
    if force_new or _hootsuite_instance is None:
        _hootsuite_instance = HootsuiteIntegration(api_key)
    return _hootsuite_instance


def get_all_scheduled_posts(
    config: Dict[str, Dict[str, str]],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Get scheduled posts from all configured social schedulers

    Args:
        config: Dictionary of scheduler configurations
            {
                'buffer': {'api_key': '...'},
                'hootsuite': {'api_key': '...'}
            }
        start_date: Start of date range
        end_date: End of date range

    Returns:
        List of calendar items from all schedulers
    """
    all_posts = []

    # Buffer
    if 'buffer' in config:
        buffer_config = config['buffer']
        buffer_client = get_buffer_client(buffer_config.get('api_key', ''))
        if buffer_client and buffer_client.authenticate():
            posts = buffer_client.sync_to_marketing_calendar(start_date, end_date)
            all_posts.extend(posts)

    # Hootsuite
    if 'hootsuite' in config:
        hootsuite_config = config['hootsuite']
        hootsuite_client = get_hootsuite_client(hootsuite_config.get('api_key', ''))
        if hootsuite_client and hootsuite_client.authenticate():
            posts = hootsuite_client.sync_to_marketing_calendar(start_date, end_date)
            all_posts.extend(posts)

    logger.info(f"Fetched {len(all_posts)} total scheduled posts from all schedulers")
    return all_posts
