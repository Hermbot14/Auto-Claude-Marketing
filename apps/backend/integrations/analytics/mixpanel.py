"""
Mixpanel Analytics Integration
==============================

Integration with Mixpanel API for event tracking and user analytics.

Requirements:
    - mixpanel Python package
    - Mixpanel Project ID and API Secret
"""

import logging
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


class MixpanelAnalytics(AnalyticsPlatform):
    """
    Mixpanel analytics platform integration.

    Uses the Mixpanel API to:
    - Track events (via import API)
    - Query event data
    - Analyze funnels
    - Calculate retention cohorts
    - Get user profiles
    """

    BASE_URL = "https://mixpanel.com/api"
    API_VERSION = "2.0"

    def __init__(self, config: AnalyticsConfig):
        """
        Initialize Mixpanel integration.

        Args:
            config: AnalyticsConfig with Mixpanel settings
        """
        super().__init__(config)
        self.project_id = config.mixpanel_project_id
        self.api_secret = config.mixpanel_api_secret
        self.api_region = config.mixpanel_api_region
        self.session: Any = None

        # Regional endpoint support
        if self.api_region == "EU":
            self.BASE_URL = "https://eu.mixpanel.com/api"

        if not self.project_id or not self.api_secret:
            logger.warning("Mixpanel credentials not configured")

    def authenticate(self) -> bool:
        """
        Authenticate with Mixpanel API.

        Mixpanel uses API signature authentication. This method
        verifies credentials by making a test API call.

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
            self.session.params = {"project_id": self.project_id}

            # Test authentication with a simple request
            response = self._make_request("events/properties/top", {"limit": 1})

            if response.status_code == 200:
                self._authenticated = True
                logger.info(f"Authenticated with Mixpanel project: {self.project_id}")
                return True

            self._authenticated = False
            raise AuthenticationError(
                f"Mixpanel authentication failed: {response.text}"
            )

        except requests.RequestException as e:
            self._authenticated = False
            raise AuthenticationError(f"Mixpanel authentication error: {e}") from e

    def track_event(self, event: AnalyticsEvent) -> bool:
        """
        Track a single event in Mixpanel.

        Args:
            event: AnalyticsEvent to track

        Returns:
            True if event tracked successfully
        """
        self._ensure_authenticated()

        # Mixpanel Import API for historical events
        import_url = f"{self.BASE_URL.replace('/api', '')}/import"
        params = {
            "strict": 1,
            "project_id": self.project_id,
        }

        event_data = {
            "event": event.event_name,
            "properties": {
                "time": int(event.timestamp.timestamp()) if event.timestamp else None,
                "distinct_id": event.user_id,
                "$insert_id": f"{event.event_name}_{event.timestamp.isoformat()}",
                "mp_lib": "python",
            },
        }

        if event.properties:
            event_data["properties"].update(event.properties)

        if event.revenue:
            event_data["properties"]["$amount"] = float(event.revenue)

        try:
            response = requests.post(
                import_url,
                params=params,
                json=[event_data],
                auth=(self.api_secret, ""),
                timeout=self.config.timeout_seconds,
            )

            return response.status_code == 200

        except requests.RequestException as e:
            logger.error(f"Failed to track event in Mixpanel: {e}")
            return False

    def track_events_batch(self, events: list[AnalyticsEvent]) -> bool:
        """
        Track multiple events in Mixpanel.

        Args:
            events: List of AnalyticsEvent objects

        Returns:
            True if all events tracked successfully
        """
        self._ensure_authenticated()

        if not events:
            return True

        # Batch events using Import API
        import_url = f"{self.BASE_URL.replace('/api', '')}/import"
        params = {
            "strict": 1,
            "project_id": self.project_id,
        }

        event_data_list = []
        for event in events:
            event_data = {
                "event": event.event_name,
                "properties": {
                    "time": (
                        int(event.timestamp.timestamp()) if event.timestamp else None
                    ),
                    "distinct_id": event.user_id,
                    "$insert_id": f"{event.event_name}_{event.timestamp.isoformat() if event.timestamp else datetime.now().isoformat()}",
                    "mp_lib": "python",
                },
            }

            if event.properties:
                event_data["properties"].update(event.properties)

            if event.revenue:
                event_data["properties"]["$amount"] = float(event.revenue)

            event_data_list.append(event_data)

        try:
            response = requests.post(
                import_url,
                params=params,
                json=event_data_list,
                auth=(self.api_secret, ""),
                timeout=self.config.timeout_seconds,
            )

            return response.status_code == 200

        except requests.RequestException as e:
            logger.error(f"Failed to track events batch in Mixpanel: {e}")
            return False

    def get_revenue(
        self,
        start_date: date | str,
        end_date: date | str,
        currency: str = "USD",
    ) -> RevenueData:
        """
        Get revenue metrics from Mixpanel.

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
            # Query revenue using transaction event (if configured)
            # Or use Mixpanel's revenue calculation features
            params = {
                "event": "[$any] with properties [\"$amount\"]",
                "type": "general",
                "unit": "day",
                "from_date": start.isoformat(),
                "to_date": end.isoformat(),
                "limit": 1000,
            }

            response = self._make_request("events/sum", params)
            data = response.json()

            total_revenue = Decimal(str(data.get("value", 0)))
            transaction_count = int(data.get("count", 0))

            aov = (
                total_revenue / transaction_count
                if transaction_count > 0
                else Decimal("0")
            )

            # Get revenue by source/channel
            params_source = {
                "event": "[$any] with properties [\"$amount\"]",
                "type": "general",
                "on": "properties[$source]",
                "unit": "day",
                "from_date": start.isoformat(),
                "to_date": end.isoformat(),
            }

            response_source = self._make_request("events/sum", params_source)
            data_source = response_source.json()

            revenue_by_source: dict[str, Decimal] = {}
            if "data" in data_source:
                for item in data_source["data"]:
                    source = item.get("key", "unknown")
                    value = Decimal(str(item.get("value", 0)))
                    revenue_by_source[source] = value

            return RevenueData(
                total_revenue=total_revenue,
                currency=currency,
                start_date=start,
                end_date=end,
                transaction_count=transaction_count,
                average_order_value=aov,
                revenue_by_source=revenue_by_source if revenue_by_source else None,
            )

        except requests.RequestException as e:
            raise APIError(f"Mixpanel API error fetching revenue: {e}") from e

    def get_user_count(
        self,
        start_date: date | str,
        end_date: date | str,
    ) -> int:
        """
        Get unique user count from Mixpanel.

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
                "from_date": start.isoformat(),
                "to_date": end.isoformat(),
                "type": "unique",
            }

            response = self._make_request("events/total", params)
            data = response.json()

            return int(data.get("total", 0))

        except requests.RequestException as e:
            raise APIError(f"Mixpanel API error fetching user count: {e}") from e

    def get_funnel_analysis(
        self,
        funnel_steps: list[str],
        start_date: date | str,
        end_date: date | str,
        window_days: int = 30,
    ) -> FunnelAnalysis:
        """
        Analyze conversion funnel in Mixpanel.

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
            params = {
                "funnel_id": ",".join(funnel_steps),
                "from_date": start.isoformat(),
                "to_date": end.isoformat(),
                "interval": f"{window_days}",
            }

            response = self._make_request("funnels/results", params)
            data = response.json()

            steps_data = []
            total_users = 0

            if "data" in data:
                for i, step_data in enumerate(data["data"]):
                    step_name = funnel_steps[i]
                    users = step_data.get("count", 0)

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
                        users=users,
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
            raise APIError(f"Mixpanel API error fetching funnel: {e}") from e

    def get_cohort_analysis(
        self,
        cohort_start_date: date | str,
        cohort_end_date: date | str,
        metric: str = "retention",
        periods: int = 12,
    ) -> list[CohortData]:
        """
        Analyze cohorts in Mixpanel.

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
            # Use Mixpanel's retention API for cohort analysis
            params = {
                "from_date": start.isoformat(),
                "to_date": end.isoformat(),
                "born_event": "user_sign_up",  # Cohort defining event
                "interval_count": periods,
                "interval_unit": "day",
            }

            response = self._make_request("retention/analysis", params)
            data = response.json()

            cohorts = []

            if "data" in data:
                for cohort_name, retention_data in data["data"].items():
                    cohort_size = retention_data.get("first_amount", 0)
                    retention_by_period = {}

                    for i, period_data in enumerate(retention_data.get("data", [])):
                        retention_by_period[i] = period_data.get("count", 0)

                    cohorts.append(
                        CohortData(
                            cohort_name=cohort_name,
                            cohort_size=cohort_size,
                            start_date=start,
                            retention_by_period=retention_by_period,
                        )
                    )

            return cohorts

        except requests.RequestException as e:
            raise APIError(f"Mixpanel API error fetching cohorts: {e}") from e

    def get_user_profile(self, user_id: str) -> AnalyticsUser | None:
        """
        Get user profile from Mixpanel.

        Args:
            user_id: Distinct ID in Mixpanel

        Returns:
            AnalyticsUser object or None
        """
        self._ensure_authenticated()

        try:
            params = {
                "distinct_id": user_id,
            }

            response = self._make_request("engage", params)
            data = response.json()

            if "results" not in data or not data["results"]:
                return None

            user_data = data["results"][0]
            properties = user_data.get("$properties", {})

            return AnalyticsUser(
                user_id=user_id,
                first_seen=datetime.fromtimestamp(properties.get("$first_seen", 0))
                if "$first_seen" in properties
                else None,
                last_seen=datetime.fromtimestamp(properties.get("$last_seen", 0))
                if "$last_seen" in properties
                else None,
                total_sessions=int(properties.get("$sessions", 0)),
                total_revenue=Decimal(str(properties.get("$revenue", 0))),
                properties=properties,
            )

        except requests.RequestException as e:
            raise APIError(f"Mixpanel API error fetching user profile: {e}") from e

    def get_events(
        self,
        start_date: date | str,
        end_date: date | str,
        event_name: str | None = None,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[AnalyticsEvent]:
        """
        Retrieve events from Mixpanel.

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
                "from_date": start.isoformat(),
                "to_date": end.isoformat(),
                "limit": limit,
            }

            if event_name:
                params["event"] = f'["{event_name}"]'

            if user_id:
                params["distinct_id"] = user_id

            response = self._make_request("events", params)
            data = response.json()

            events = []
            if "event" in data:
                for event_data in data["event"]:
                    properties = event_data.get("properties", {})

                    events.append(
                        AnalyticsEvent(
                            event_name=event_data.get("event"),
                            event_type="custom",
                            timestamp=datetime.fromtimestamp(
                                properties.get("time", 0)
                            ),
                            user_id=properties.get("distinct_id"),
                            properties=properties,
                            revenue=Decimal(str(properties.get("$amount", 0)))
                            if "$amount" in properties
                            else None,
                        )
                    )

            return events[:limit]

        except requests.RequestException as e:
            raise APIError(f"Mixpanel API error fetching events: {e}") from e

    def _make_request(self, endpoint: str, params: dict) -> Any:
        """
        Make an authenticated request to Mixpanel API.

        Args:
            endpoint: API endpoint path
            params: Query parameters

        Returns:
            Response object
        """
        if self.session is None:
            raise AuthenticationError("Not authenticated")

        url = f"{self.BASE_URL}/{self.API_VERSION}/{endpoint}"

        params.update({
            "project_id": self.project_id,
        })

        response = self.session.get(
            url,
            params=params,
            auth=(self.api_secret, ""),
            timeout=self.config.timeout_seconds,
        )

        response.raise_for_status()
        return response

    def _ensure_authenticated(self) -> None:
        """Ensure the client is authenticated."""
        if not self.is_authenticated():
            self.authenticate()
