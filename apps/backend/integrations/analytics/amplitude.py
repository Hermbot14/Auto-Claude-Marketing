"""
Amplitude Analytics Integration
===============================

Integration with Amplitude API for event tracking and user analytics.

Requirements:
    - amplitude Python package (optional)
    - Amplitude API Key and Secret Key
"""

import hashlib
import hmac
import logging
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

try:
    import requests
except ImportError:
    requests = None

from .base import (
    AnalyticsEvent,
    AnalyticsPlatform,
    AnalyticsUser,
    AuthenticationError,
    APIError,
    CohortData,
    FunnelAnalysis,
    FunnelStep,
    RevenueData,
)
from .config import AnalyticsConfig

logger = logging.getLogger(__name__)


class AmplitudeAnalytics(AnalyticsPlatform):
    """
    Amplitude analytics platform integration.

    Uses the Amplitude API to:
    - Track events (via HTTP API V2)
    - Query event data (via Chart API)
    - Analyze funnels
    - Calculate user cohorts
    - Get user profiles
    """

    BASE_URL = "https://amplitude.com/api"
    EU_BASE_URL = "https://eu.amplitude.com/api"

    def __init__(self, config: AnalyticsConfig):
        """
        Initialize Amplitude integration.

        Args:
            config: AnalyticsConfig with Amplitude settings
        """
        super().__init__(config)
        self.api_key = config.amplitude_api_key
        self.secret_key = config.amplitude_secret_key
        self.api_region = config.amplitude_api_region
        self.session: Any = None

        # Regional endpoint support
        if self.api_region == "EU":
            self.BASE_URL = self.EU_BASE_URL

        if not self.api_key or not self.secret_key:
            logger.warning("Amplitude credentials not configured")

    def authenticate(self) -> bool:
        """
        Authenticate with Amplitude API.

        Amplitude uses API key + secret key authentication.
        This method verifies credentials by making a test API call.

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        if requests is None:
            raise AuthenticationError(
                "requests package not installed. Install with: pip install requests"
            )

        try:
            self.session = requests.Session()

            # Test authentication with a user search request
            params = {
                "start": (datetime.now() - timedelta(days=1)).strftime("%Y%m%d"),
                "end": datetime.now().strftime("%Y%m%d"),
            }

            response = self._make_request("v2/useractivity", params)

            if response.status_code == 200:
                self._authenticated = True
                logger.info(f"Authenticated with Amplitude (region: {self.api_region})")
                return True

            if response.status_code == 401:
                self._authenticated = False
                raise AuthenticationError(
                    f"Amplitude authentication failed: Invalid credentials"
                )

            self._authenticated = False
            raise AuthenticationError(
                f"Amplitude authentication failed: {response.text}"
            )

        except requests.RequestException as e:
            self._authenticated = False
            raise AuthenticationError(f"Amplitude authentication error: {e}") from e

    def track_event(self, event: AnalyticsEvent) -> bool:
        """
        Track a single event in Amplitude.

        Args:
            event: AnalyticsEvent to track

        Returns:
            True if event tracked successfully
        """
        self._ensure_authenticated()

        # Amplitude HTTP API V2 for event ingestion
        api_url = f"{self.BASE_URL}/v2/httpapi"

        event_data = {
            "events": [
                {
                    "user_id": event.user_id,
                    "device_id": event.session_id,
                    "event_type": event.event_name,
                    "time": int(event.timestamp.timestamp() * 1000)
                    if event.timestamp
                    else int(time.time() * 1000),
                    "event_properties": event.properties or {},
                    "user_properties": {},
                    "app_version": "1.0",
                    "platform": "Web",
                }
            ]
        }

        if event.revenue:
            event_data["events"][0]["event_properties"]["$revenue"] = float(
                event.revenue
            )

        try:
            response = requests.post(
                api_url,
                json=event_data,
                auth=(self.api_key, ""),
                timeout=self.config.timeout_seconds,
            )

            return response.status_code == 200 or response.status_code == 201

        except requests.RequestException as e:
            logger.error(f"Failed to track event in Amplitude: {e}")
            return False

    def track_events_batch(self, events: list[AnalyticsEvent]) -> bool:
        """
        Track multiple events in Amplitude.

        Args:
            events: List of AnalyticsEvent objects

        Returns:
            True if all events tracked successfully
        """
        self._ensure_authenticated()

        if not events:
            return True

        # Amplitude HTTP API V2 supports batch events
        api_url = f"{self.BASE_URL}/v2/httpapi"

        event_list = []
        for event in events:
            event_data = {
                "user_id": event.user_id,
                "device_id": event.session_id,
                "event_type": event.event_name,
                "time": int(event.timestamp.timestamp() * 1000)
                if event.timestamp
                else int(time.time() * 1000),
                "event_properties": event.properties or {},
                "user_properties": {},
                "app_version": "1.0",
                "platform": "Web",
            }

            if event.revenue:
                event_data["event_properties"]["$revenue"] = float(event.revenue)

            event_list.append(event_data)

        try:
            response = requests.post(
                api_url,
                json={"events": event_list},
                auth=(self.api_key, ""),
                timeout=self.config.timeout_seconds,
            )

            return response.status_code == 200 or response.status_code == 201

        except requests.RequestException as e:
            logger.error(f"Failed to track events batch in Amplitude: {e}")
            return False

    def get_revenue(
        self,
        start_date: date | str,
        end_date: date | str,
        currency: str = "USD",
    ) -> RevenueData:
        """
        Get revenue metrics from Amplitude.

        Args:
            start_date: Start date
            end_date: End date
            currency: Currency code

        Returns:
            RevenueData with revenue metrics
        """
        self._ensure_authenticated()

        start = self._parse_date(start_date)
        end = self._parse_date(end_date)

        try:
            # Use Amplitude's Revenue analysis via Chart API
            params = {
                "e": '{"type":"behavior","params":{"event_name":"Revenue","event_type":"direct"}}',
                "m": "total",
                "start": start.strftime("%Y%m%d"),
                "end": end.strftime("%Y%m%d"),
                "i": 1440,  # Daily interval
            }

            response = self._make_request("v2/query", params)
            data = response.json()

            total_revenue = Decimal("0")
            transaction_count = 0

            if "data" in data and "series" in data["data"]:
                for point in data["data"]["series"]:
                    if "value" in point:
                        total_revenue += Decimal(str(point["value"]))
                        transaction_count += 1

            aov = (
                total_revenue / transaction_count
                if transaction_count > 0
                else Decimal("0")
            )

            return RevenueData(
                total_revenue=total_revenue,
                currency=currency,
                start_date=start,
                end_date=end,
                transaction_count=transaction_count,
                average_order_value=aov,
            )

        except requests.RequestException as e:
            raise APIError(f"Amplitude API error fetching revenue: {e}") from e

    def get_user_count(
        self,
        start_date: date | str,
        end_date: date | str,
    ) -> int:
        """
        Get unique user count from Amplitude.

        Args:
            start_date: Start date
            end_date: End date

        Returns:
            Number of unique users
        """
        self._ensure_authenticated()

        start = self._parse_date(start_date)
        end = self._parse_date(end_date)

        try:
            params = {
                "m": "uniques",
                "start": start.strftime("%Y%m%d"),
                "end": end.strftime("%Y%m%d"),
                "i": 1440,  # Daily interval
            }

            response = self._make_request("v2/users", params)
            data = response.json()

            if "data" in data and "series" in data["data"]:
                # Sum up unique users across the period
                return sum(
                    point.get("value", 0) for point in data["data"]["series"]
                )

            return 0

        except requests.RequestException as e:
            raise APIError(f"Amplitude API error fetching user count: {e}") from e

    def get_funnel_analysis(
        self,
        funnel_steps: list[str],
        start_date: date | str,
        end_date: date | str,
        window_days: int = 30,
    ) -> FunnelAnalysis:
        """
        Analyze conversion funnel in Amplitude.

        Args:
            funnel_steps: List of event names for funnel steps
            start_date: Start date
            end_date: End date
            window_days: Time window in days

        Returns:
            FunnelAnalysis object
        """
        self._ensure_authenticated()

        start = self._parse_date(start_date)
        end = self._parse_date(end_date)

        try:
            # Build funnel request
            steps_data = []
            total_users = 0

            # Query each step individually (Amplitude funnel analysis requires specialized endpoints)
            for i, step_name in enumerate(funnel_steps):
                params = {
                    "e": f'{{"type":"behavior","params":{{"event_name":"{step_name}"}}}}',
                    "m": "uniques",
                    "start": start.strftime("%Y%m%d"),
                    "end": end.strftime("%Y%m%d"),
                }

                response = self._make_request("v2/query", params)
                data = response.json()

                users = 0
                if "data" in data and "series" in data["data"]:
                    users = sum(
                        point.get("value", 0) for point in data["data"]["series"]
                    )

                if i == 0:
                    total_users = users

                completion_rate = 100.0
                dropoff_rate = 0.0
                conversion_rate = None

                if i > 0 and steps_data:
                    previous_users = steps_data[i - 1].users
                    if previous_users > 0:
                        completion_rate = (users / previous_users) * 100
                        dropoff_rate = 100 - completion_rate

                if i == 0:
                    conversion_rate = 100.0
                elif total_users > 0:
                    conversion_rate = (users / total_users) * 100

                step = FunnelStep(
                    step_name=step_name,
                    step_number=i + 1,
                    users=int(users),
                    completion_rate=completion_rate,
                    dropoff_rate=dropoff_rate,
                    conversion_rate=conversion_rate,
                )

                steps_data.append(step)

            overall_conversion = (
                (steps_data[-1].users / steps_data[0].users) * 100
                if steps_data and steps_data[0].users > 0
                else 0.0
            )

            return FunnelAnalysis(
                funnel_name=" → ".join(funnel_steps),
                start_date=start,
                end_date=end,
                total_users=total_users,
                steps=steps_data,
                overall_conversion_rate=overall_conversion,
            )

        except requests.RequestException as e:
            raise APIError(f"Amplitude API error fetching funnel: {e}") from e

    def get_cohort_analysis(
        self,
        cohort_start_date: date | str,
        cohort_end_date: date | str,
        metric: str = "retention",
        periods: int = 12,
    ) -> list[CohortData]:
        """
        Analyze cohorts in Amplitude.

        Args:
            cohort_start_date: Cohort start date
            cohort_end_date: Cohort end date
            metric: Metric to analyze
            periods: Number of periods

        Returns:
            List of CohortData objects
        """
        self._ensure_authenticated()

        start = self._parse_date(cohort_start_date)
        end = self._parse_date(cohort_end_date)

        try:
            # Amplitude cohort analysis via segmentation API
            params = {
                "m": f"retention({metric})",
                "start": start.strftime("%Y%m%d"),
                "end": end.strftime("%Y%m%d"),
                "n": periods,
            }

            response = self._make_request("v2/cohorts", params)
            data = response.json()

            cohorts = []

            if "data" in data:
                for cohort_data in data["data"]:
                    cohort_size = cohort_data.get("size", 0)
                    retention_by_period = {}

                    for i, period_retention in enumerate(
                        cohort_data.get("retention", [])
                    ):
                        retention_by_period[i] = period_retention

                    cohorts.append(
                        CohortData(
                            cohort_name=cohort_data.get("name", "unknown"),
                            cohort_size=cohort_size,
                            start_date=start,
                            retention_by_period=retention_by_period,
                        )
                    )

            return cohorts

        except requests.RequestException as e:
            raise APIError(f"Amplitude API error fetching cohorts: {e}") from e

    def get_user_profile(self, user_id: str) -> AnalyticsUser | None:
        """
        Get user profile from Amplitude.

        Args:
            user_id: User ID or Device ID in Amplitude

        Returns:
            AnalyticsUser object or None
        """
        self._ensure_authenticated()

        try:
            params = {
                "user": f'{{"user_id":"{user_id}"}}',
            }

            response = self._make_request("v2/userprofile", params)
            data = response.json()

            if "data" not in data:
                return None

            user_data = data["data"]
            user_properties = user_data.get("user_properties", {})

            return AnalyticsUser(
                user_id=user_id,
                first_seen=datetime.fromtimestamp(
                    user_data.get("first_event_time", 0) / 1000
                )
                if "first_event_time" in user_data
                else None,
                last_seen=datetime.fromtimestamp(
                    user_data.get("last_event_time", 0) / 1000
                )
                if "last_event_time" in user_data
                else None,
                total_sessions=user_data.get("num_sessions", 0),
                total_revenue=Decimal(str(user_data.get("lifetime_revenue", 0))),
                properties=user_properties,
            )

        except requests.RequestException as e:
            raise APIError(f"Amplitude API error fetching user profile: {e}") from e

    def get_events(
        self,
        start_date: date | str,
        end_date: date | str,
        event_name: str | None = None,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[AnalyticsEvent]:
        """
        Retrieve events from Amplitude.

        Args:
            start_date: Start date
            end_date: End date
            event_name: Optional event name filter
            user_id: Optional user ID filter
            limit: Maximum events to return

        Returns:
            List of AnalyticsEvent objects
        """
        self._ensure_authenticated()

        start = self._parse_date(start_date)
        end = self._parse_date(end_date)

        try:
            params = {
                "start": start.strftime("%Y%m%d"),
                "end": end.strftime("%Y%m%d"),
                "limit": limit,
            }

            if event_name:
                params["event_names"] = f'["{event_name}"]'

            if user_id:
                params["user"] = f'{{"user_id":"{user_id}"}}'

            response = self._make_request("v2/events", params)
            data = response.json()

            events = []
            if "data" in data:
                for event_data in data["data"]:
                    events.append(
                        AnalyticsEvent(
                            event_name=event_data.get("event_type"),
                            event_type="custom",
                            timestamp=datetime.fromtimestamp(
                                event_data.get("time", 0) / 1000
                            ),
                            user_id=event_data.get("user_id"),
                            session_id=event_data.get("device_id"),
                            properties=event_data.get("event_properties"),
                        )
                    )

            return events[:limit]

        except requests.RequestException as e:
            raise APIError(f"Amplitude API error fetching events: {e}") from e

    def _make_request(self, endpoint: str, params: dict) -> Any:
        """
        Make an authenticated request to Amplitude API.

        Args:
            endpoint: API endpoint path
            params: Query parameters

        Returns:
            Response object
        """
        if self.session is None:
            raise AuthenticationError("Not authenticated")

        url = f"{self.BASE_URL}/{endpoint}"

        # Add timestamp for signature
        params["timestamp"] = int(time.time())

        # Calculate signature
        query_string = urlencode(sorted(params.items()))
        signature = hmac.new(
            self.secret_key.encode(), query_string.encode(), hashlib.sha256
        ).hexdigest()

        params["signature"] = signature

        response = self.session.get(
            url, params=params, auth=(self.api_key, ""), timeout=self.config.timeout_seconds
        )

        response.raise_for_status()
        return response

    def _ensure_authenticated(self) -> None:
        """Ensure the client is authenticated."""
        if not self.is_authenticated():
            self.authenticate()


# Add timedelta import
from datetime import timedelta
