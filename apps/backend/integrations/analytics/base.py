"""
Analytics Base Classes and Types
================================

Abstract base class and common types for analytics platform integrations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any


class EventType(str, Enum):
    """Common event types across analytics platforms."""

    PAGE_VIEW = "page_view"
    SESSION_START = "session_start"
    USER_SIGN_UP = "user_sign_up"
    USER_LOGIN = "user_login"
    PURCHASE = "purchase"
    ADD_TO_CART = "add_to_cart"
    REMOVE_FROM_CART = "remove_from_cart"
    CHECKOUT_START = "checkout_start"
    CHECKOUT_COMPLETE = "checkout_complete"
    SEARCH = "search"
    FORM_SUBMIT = "form_submit"
    CLICK = "click"
    DOWNLOAD = "download"
    VIDEO_PLAY = "video_play"
    VIDEO_COMPLETE = "video_complete"
    CUSTOM = "custom"


@dataclass
class AnalyticsEvent:
    """Represents an analytics event."""

    event_name: str
    event_type: EventType
    user_id: str | None = None
    session_id: str | None = None
    timestamp: datetime | None = None
    properties: dict[str, Any] | None = None
    revenue: Decimal | None = None
    currency: str = "USD"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format for API calls."""
        return {
            "event_name": self.event_name,
            "event_type": self.event_type.value,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "properties": self.properties or {},
            "revenue": float(self.revenue) if self.revenue else None,
            "currency": self.currency,
        }


@dataclass
class AnalyticsUser:
    """Represents a user in the analytics system."""

    user_id: str
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    total_sessions: int = 0
    total_revenue: Decimal = Decimal("0")
    properties: dict[str, Any] | None = None
    cohorts: list[str] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "user_id": self.user_id,
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "total_sessions": self.total_sessions,
            "total_revenue": float(self.total_revenue),
            "properties": self.properties or {},
            "cohorts": self.cohorts or [],
        }


@dataclass
class RevenueData:
    """Revenue metrics over a time period."""

    total_revenue: Decimal
    currency: str
    start_date: date
    end_date: date
    transaction_count: int = 0
    average_order_value: Decimal = Decimal("0")
    revenue_by_source: dict[str, Decimal] | None = None
    revenue_by_campaign: dict[str, Decimal] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "total_revenue": float(self.total_revenue),
            "currency": self.currency,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "transaction_count": self.transaction_count,
            "average_order_value": float(self.average_order_value),
            "revenue_by_source": {
                k: float(v) for k, v in (self.revenue_by_source or {}).items()
            },
            "revenue_by_campaign": {
                k: float(v) for k, v in (self.revenue_by_campaign or {}).items()
            },
        }


@dataclass
class FunnelStep:
    """Represents a step in a conversion funnel."""

    step_name: str
    step_number: int
    users: int
    completion_rate: float  # Percentage
    dropoff_rate: float  # Percentage
    average_time_seconds: float | None = None
    conversion_rate: float | None = None  # From step 1 to this step

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "step_name": self.step_name,
            "step_number": self.step_number,
            "users": self.users,
            "completion_rate": round(self.completion_rate, 2),
            "dropoff_rate": round(self.dropoff_rate, 2),
            "average_time_seconds": self.average_time_seconds,
            "conversion_rate": round(self.conversion_rate, 2) if self.conversion_rate else None,
        }


@dataclass
class FunnelAnalysis:
    """Results from a funnel analysis."""

    funnel_name: str
    start_date: date
    end_date: date
    total_users: int
    steps: list[FunnelStep]
    overall_conversion_rate: float  # From first to last step

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "funnel_name": self.funnel_name,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "total_users": self.total_users,
            "steps": [step.to_dict() for step in self.steps],
            "overall_conversion_rate": round(self.overall_conversion_rate, 2),
        }


@dataclass
class CohortData:
    """Results from a cohort analysis."""

    cohort_name: str
    cohort_size: int
    start_date: date
    retention_by_period: dict[int, float]  # Period -> retention percentage
    metrics: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "cohort_name": self.cohort_name,
            "cohort_size": self.cohort_size,
            "start_date": self.start_date.isoformat(),
            "retention_by_period": {
                k: round(v, 2) for k, v in self.retention_by_period.items()
            },
            "metrics": self.metrics or {},
        }


class AnalyticsPlatform(ABC):
    """
    Abstract base class for analytics platform integrations.

    All analytics platform implementations must inherit from this class
    and implement the required methods.
    """

    def __init__(self, config):
        """
        Initialize the analytics platform.

        Args:
            config: Platform-specific configuration object
        """
        self.config = config
        self._authenticated = False

    @abstractmethod
    def authenticate(self) -> bool:
        """
        Authenticate with the analytics platform.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        pass

    @abstractmethod
    def track_event(self, event: AnalyticsEvent) -> bool:
        """
        Track a single analytics event.

        Args:
            event: AnalyticsEvent to track

        Returns:
            True if event tracked successfully

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def track_events_batch(self, events: list[AnalyticsEvent]) -> bool:
        """
        Track multiple analytics events in a batch.

        Args:
            events: List of AnalyticsEvent objects

        Returns:
            True if all events tracked successfully

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def get_revenue(
        self,
        start_date: date | str,
        end_date: date | str,
        currency: str = "USD",
    ) -> RevenueData:
        """
        Get revenue metrics for a date range.

        Args:
            start_date: Start date (date object or ISO string)
            end_date: End date (date object or ISO string)
            currency: Currency code (default: USD)

        Returns:
            RevenueData object with revenue metrics

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def get_user_count(
        self,
        start_date: date | str,
        end_date: date | str,
    ) -> int:
        """
        Get unique user count for a date range.

        Args:
            start_date: Start date (date object or ISO string)
            end_date: End date (date object or ISO string)

        Returns:
            Number of unique users

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def get_funnel_analysis(
        self,
        funnel_steps: list[str],
        start_date: date | str,
        end_date: date | str,
        window_days: int = 30,
    ) -> FunnelAnalysis:
        """
        Analyze conversion funnel.

        Args:
            funnel_steps: List of event names representing funnel steps
            start_date: Start date for users entering funnel
            end_date: End date for users entering funnel
            window_days: Time window for completing funnel (default: 30 days)

        Returns:
            FunnelAnalysis object with funnel metrics

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def get_cohort_analysis(
        self,
        cohort_start_date: date | str,
        cohort_end_date: date | str,
        metric: str = "retention",
        periods: int = 12,
    ) -> list[CohortData]:
        """
        Analyze cohorts over time.

        Args:
            cohort_start_date: Start date for cohort definition
            cohort_end_date: End date for cohort definition
            metric: Metric to analyze (retention, revenue, etc.)
            periods: Number of periods to analyze

        Returns:
            List of CohortData objects

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def get_user_profile(self, user_id: str) -> AnalyticsUser | None:
        """
        Get profile data for a specific user.

        Args:
            user_id: Unique user identifier

        Returns:
            AnalyticsUser object or None if user not found

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    @abstractmethod
    def get_events(
        self,
        start_date: date | str,
        end_date: date | str,
        event_name: str | None = None,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[AnalyticsEvent]:
        """
        Retrieve events from the analytics platform.

        Args:
            start_date: Start date (date object or ISO string)
            end_date: End date (date object or ISO string)
            event_name: Optional event name filter
            user_id: Optional user ID filter
            limit: Maximum number of events to return

        Returns:
            List of AnalyticsEvent objects

        Raises:
            AuthenticationError: If not authenticated
            APIError: If API call fails
        """
        pass

    def is_authenticated(self) -> bool:
        """Check if the platform is authenticated."""
        return self._authenticated

    def _parse_date(self, date_input: date | str) -> date:
        """
        Parse date input to date object.

        Args:
            date_input: date object or ISO string

        Returns:
            date object
        """
        if isinstance(date_input, date):
            return date_input
        if isinstance(date_input, str):
            return date.fromisoformat(date_input)
        raise TypeError(f"Invalid date type: {type(date_input)}")


class AuthenticationError(Exception):
    """Raised when authentication fails."""

    pass


class APIError(Exception):
    """Raised when API call fails."""

    pass


class RateLimitError(APIError):
    """Raised when rate limit is exceeded."""

    pass
