"""
Google Calendar Integration for Marketing Calendar

This module provides integration with Google Calendar API for:
- Reading events from Google Calendar
- Creating events in Google Calendar
- Updating existing events
- Syncing marketing calendar with Google Calendar
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
import base64

# Try importing Google libraries, handle gracefully if not available
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_CALENDAR_AVAILABLE = True
except ImportError:
    GOOGLE_CALENDAR_AVAILABLE = False

from core.logger import logger


@dataclass
class GoogleCalendarEvent:
    """Represents a Google Calendar event"""
    id: str
    title: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: bool = False
    location: Optional[str] = None
    attendees: List[str] = None
    color_id: Optional[str] = None
    status: str = 'confirmed'
    recurrence: Optional[str] = None
    source: str = 'google-calendar'

    def __post_init__(self):
        if self.attendees is None:
            self.attendees = []

    @classmethod
    def from_api_response(cls, event_data: Dict[str, Any]) -> 'GoogleCalendarEvent':
        """Create GoogleCalendarEvent from Google Calendar API response"""
        event_id = event_data.get('id', '')
        title = event_data.get('summary', 'No Title')
        description = event_data.get('description')

        # Parse start and end times
        start_data = event_data.get('start', {})
        end_data = event_data.get('end', {})

        # Check if all-day event
        all_day = 'date' in start_data

        if all_day:
            start_time = datetime.fromisoformat(start_data['date'])
            end_time = datetime.fromisoformat(end_data['date']) if end_data.get('date') else None
        else:
            start_time = datetime.fromisoformat(
                start_data.get('dateTime', '').replace('Z', '+00:00')
            ) if start_data.get('dateTime') else None
            end_time = datetime.fromisoformat(
                end_data.get('dateTime', '').replace('Z', '+00:00')
            ) if end_data.get('dateTime') else None

        location = event_data.get('location')
        attendees = [
            attendee.get('email', '')
            for attendee in event_data.get('attendees', [])
            if attendee.get('email')
        ]
        color_id = event_data.get('colorId')
        status = event_data.get('status', 'confirmed')
        recurrence = event_data.get('recurrence', [''])[0] if event_data.get('recurrence') else None

        return cls(
            id=event_id,
            title=title,
            description=description,
            start_time=start_time,
            end_time=end_time,
            all_day=all_day,
            location=location,
            attendees=attendees,
            color_id=color_id,
            status=status,
            recurrence=recurrence,
        )

    def to_calendar_item(self) -> Dict[str, Any]:
        """Convert to internal calendar item format"""
        return {
            'id': f"google-{self.id}",
            'title': self.title,
            'description': self.description,
            'type': self._determine_event_type(),
            'status': self._map_status(),
            'source': 'external',
            'startDate': self.start_time or datetime.now(),
            'endDate': self.end_time,
            'allDay': self.all_day,
            'location': self.location,
            'tags': self._generate_tags(),
            'externalEventId': self.id,
            'externalSource': 'google',
        }

    def _determine_event_type(self) -> str:
        """Determine calendar item type from event properties"""
        title_lower = self.title.lower()
        description_lower = (self.description or '').lower()

        # Check for marketing-specific keywords
        if any(word in title_lower or word in description_lower
               for word in ['campaign', 'launch', 'promo']):
            return 'campaign'
        elif any(word in title_lower or word in description_lower
                 for word in ['blog', 'content', 'article']):
            return 'content'
        elif any(word in title_lower or word in description_lower
                 for word in ['social', 'twitter', 'facebook', 'instagram', 'linkedin']):
            return 'social'
        elif any(word in title_lower or word in description_lower
                 for word in ['email', 'newsletter']):
            return 'email'
        elif any(word in title_lower or word in description_lower
                 for word in ['seo', 'audit', 'review']):
            return 'seo'
        else:
            return 'event'

    def _map_status(self) -> str:
        """Map Google Calendar status to internal status"""
        if self.status == 'confirmed':
            return 'scheduled'
        elif self.status == 'tentative':
            return 'draft'
        elif self.status == 'cancelled':
            return 'cancelled'
        else:
            return 'scheduled'

    def _generate_tags(self) -> List[str]:
        """Generate tags from event properties"""
        tags = ['google-calendar']

        # Add color-based tags
        color_map = {
            '1': 'blue', '2': 'green', '3': 'purple', '4': 'red',
            '5': 'yellow', '6': 'orange', '7': 'turquoise', '8': 'gray',
            '9': 'blue', '10': 'green', '11': 'red'
        }

        if self.color_id:
            tags.append(color_map.get(self.color_id, 'uncolored'))

        return tags


class GoogleCalendarIntegration:
    """Google Calendar API integration client"""

    SCOPES = ['https://www.googleapis.com/auth/calendar.events']
    API_SERVICE_NAME = 'calendar'
    API_VERSION = 'v3'

    def __init__(self, credentials_path: Optional[str] = None, token_path: Optional[str] = None):
        """
        Initialize Google Calendar integration

        Args:
            credentials_path: Path to OAuth 2.0 credentials JSON file
            token_path: Path to store/load user access token
        """
        if not GOOGLE_CALENDAR_AVAILABLE:
            raise ImportError(
                "Google Calendar integration requires google-api-python-client. "
                "Install with: pip install google-api-python-client google-auth-oauthlib"
            )

        self.credentials_path = credentials_path or os.path.expanduser('~/.config/google-credentials.json')
        self.token_path = token_path or os.path.expanduser('~/.config/google-calendar-token.json')
        self.service = None
        self._authenticated = False

    def authenticate(self) -> bool:
        """
        Authenticate with Google Calendar API using OAuth 2.0

        Returns:
            True if authentication successful, False otherwise
        """
        try:
            creds = None

            # Load existing token if available
            if os.path.exists(self.token_path):
                creds = Credentials.from_authorized_user_file(self.token_path, self.SCOPES)

            # If no valid credentials, let user log in
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    if not os.path.exists(self.credentials_path):
                        logger.error(f"Credentials file not found: {self.credentials_path}")
                        logger.info("Please download OAuth 2.0 credentials from Google Cloud Console")
                        return False

                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.credentials_path, self.SCOPES
                    )
                    creds = flow.run_local_server(port=0)

                # Save credentials for next run
                with open(self.token_path, 'w') as token:
                    token.write(creds.to_json())

            # Build Calendar service
            self.service = build(
                self.API_SERVICE_NAME,
                self.API_VERSION,
                credentials=creds
            )
            self._authenticated = True

            logger.info("Successfully authenticated with Google Calendar API")
            return True

        except Exception as e:
            logger.error(f"Failed to authenticate with Google Calendar: {e}")
            self._authenticated = False
            return False

    def is_authenticated(self) -> bool:
        """Check if client is authenticated"""
        return self._authenticated and self.service is not None

    def list_events(
        self,
        calendar_id: str = 'primary',
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 250,
    ) -> List[GoogleCalendarEvent]:
        """
        List events from Google Calendar

        Args:
            calendar_id: Calendar ID (default: 'primary')
            time_min: Start of time range to fetch events
            time_max: End of time range to fetch events
            max_results: Maximum number of events to return

        Returns:
            List of GoogleCalendarEvent objects
        """
        if not self.is_authenticated():
            logger.warning("Not authenticated. Call authenticate() first.")
            return []

        try:
            # Default to past 30 days and next 365 days if not specified
            if not time_min:
                time_min = datetime.now() - timedelta(days=30)
            if not time_max:
                time_max = datetime.now() + timedelta(days=365)

            events_result = self.service.events().list(
                calendarId=calendar_id,
                timeMin=time_min.isoformat() + 'Z',
                timeMax=time_max.isoformat() + 'Z',
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime',
            ).execute()

            events = events_result.get('items', [])

            logger.info(f"Fetched {len(events)} events from Google Calendar")
            return [GoogleCalendarEvent.from_api_response(event) for event in events]

        except HttpError as e:
            logger.error(f"Google Calendar API error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error listing events: {e}")
            return []

    def get_event(self, event_id: str, calendar_id: str = 'primary') -> Optional[GoogleCalendarEvent]:
        """
        Get a specific event from Google Calendar

        Args:
            event_id: Event ID
            calendar_id: Calendar ID (default: 'primary')

        Returns:
            GoogleCalendarEvent object or None if not found
        """
        if not self.is_authenticated():
            return None

        try:
            event = self.service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()

            return GoogleCalendarEvent.from_api_response(event)

        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"Event not found: {event_id}")
            else:
                logger.error(f"Error getting event: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting event: {e}")
            return None

    def create_event(
        self,
        event: GoogleCalendarEvent,
        calendar_id: str = 'primary',
        send_updates: bool = False,
    ) -> Optional[str]:
        """
        Create a new event in Google Calendar

        Args:
            event: GoogleCalendarEvent to create
            calendar_id: Calendar ID (default: 'primary')
            send_updates: Whether to send email updates to attendees

        Returns:
            Created event ID or None if failed
        """
        if not self.is_authenticated():
            return None

        try:
            # Build event body
            event_body = {
                'summary': event.title,
                'description': event.description,
                'location': event.location,
                'attendees': [{'email': email} for email in event.attendees],
                'colorId': event.color_id,
            }

            # Set times
            if event.all_day:
                event_body['start'] = {'date': event.start_time.date().isoformat()}
                if event.end_time:
                    event_body['end'] = {'date': event.end_time.date().isoformat()}
            else:
                event_body['start'] = {
                    'dateTime': event.start_time.isoformat(),
                    'timeZone': 'UTC',
                }
                if event.end_time:
                    event_body['end'] = {
                        'dateTime': event.end_time.isoformat(),
                        'timeZone': 'UTC',
                    }

            # Add recurrence if specified
            if event.recurrence:
                event_body['recurrence'] = [event.recurrence]

            # Create event
            created_event = self.service.events().insert(
                calendarId=calendar_id,
                body=event_body,
                sendUpdates='all' if send_updates else 'none',
            ).execute()

            logger.info(f"Created event in Google Calendar: {created_event.get('id')}")
            return created_event.get('id')

        except HttpError as e:
            logger.error(f"Google Calendar API error creating event: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating event: {e}")
            return None

    def update_event(
        self,
        event_id: str,
        event: GoogleCalendarEvent,
        calendar_id: str = 'primary',
        send_updates: bool = False,
    ) -> bool:
        """
        Update an existing event in Google Calendar

        Args:
            event_id: ID of event to update
            event: Updated GoogleCalendarEvent data
            calendar_id: Calendar ID (default: 'primary')
            send_updates: Whether to send email updates to attendees

        Returns:
            True if successful, False otherwise
        """
        if not self.is_authenticated():
            return False

        try:
            # Build event body (same as create)
            event_body = {
                'summary': event.title,
                'description': event.description,
                'location': event.location,
                'attendees': [{'email': email} for email in event.attendees],
                'colorId': event.color_id,
            }

            if event.all_day:
                event_body['start'] = {'date': event.start_time.date().isoformat()}
                if event.end_time:
                    event_body['end'] = {'date': event.end_time.date().isoformat()}
            else:
                event_body['start'] = {
                    'dateTime': event.start_time.isoformat(),
                    'timeZone': 'UTC',
                }
                if event.end_time:
                    event_body['end'] = {
                        'dateTime': event.end_time.isoformat(),
                        'timeZone': 'UTC',
                    }

            # Update event
            self.service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event_body,
                sendUpdates='all' if send_updates else 'none',
            ).execute()

            logger.info(f"Updated event in Google Calendar: {event_id}")
            return True

        except HttpError as e:
            logger.error(f"Google Calendar API error updating event: {e}")
            return False
        except Exception as e:
            logger.error(f"Error updating event: {e}")
            return False

    def delete_event(
        self,
        event_id: str,
        calendar_id: str = 'primary',
        send_updates: bool = False,
    ) -> bool:
        """
        Delete an event from Google Calendar

        Args:
            event_id: ID of event to delete
            calendar_id: Calendar ID (default: 'primary')
            send_updates: Whether to send email updates to attendees

        Returns:
            True if successful, False otherwise
        """
        if not self.is_authenticated():
            return False

        try:
            self.service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
                sendUpdates='all' if send_updates else 'none',
            ).execute()

            logger.info(f"Deleted event from Google Calendar: {event_id}")
            return True

        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"Event not found for deletion: {event_id}")
            else:
                logger.error(f"Google Calendar API error deleting event: {e}")
            return False
        except Exception as e:
            logger.error(f"Error deleting event: {e}")
            return False

    def sync_to_marketing_calendar(
        self,
        calendar_id: str = 'primary',
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Sync Google Calendar events to marketing calendar format

        Args:
            calendar_id: Google Calendar ID to sync from
            time_min: Start of time range
            time_max: End of time range

        Returns:
            List of calendar items in marketing calendar format
        """
        events = self.list_events(calendar_id, time_min, time_max)
        return [event.to_calendar_item() for event in events]


# Singleton instance
_google_calendar_instance: Optional[GoogleCalendarIntegration] = None


def get_google_calendar_client(
    credentials_path: Optional[str] = None,
    token_path: Optional[str] = None,
    force_new: bool = False,
) -> Optional[GoogleCalendarIntegration]:
    """
    Get or create Google Calendar integration client

    Args:
        credentials_path: Path to OAuth credentials
        token_path: Path to token file
        force_new: Force creating a new instance

    Returns:
        GoogleCalendarIntegration instance or None if not available
    """
    global _google_calendar_instance

    if force_new or _google_calendar_instance is None:
        try:
            _google_calendar_instance = GoogleCalendarIntegration(
                credentials_path=credentials_path,
                token_path=token_path
            )
        except ImportError:
            logger.warning("Google Calendar integration not available. Install required dependencies.")
            return None

    return _google_calendar_instance
