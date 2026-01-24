"""
Google Analytics 4 Integration
==============================

Integration with Google Analytics 4 Data API.
Supports event tracking, revenue analysis, funnels, and user analytics.

Requirements:
    - google-analytics-data Python package
    - GA4 Property ID
    - Service account credentials
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

try:
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Metric,
        RunReportRequest,
    )
    from google.api_core.exceptions import GoogleAPIError
except ImportError:
    BetaAnalyticsDataClient = None
    GoogleAPIError = None

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


class GoogleAnalytics4(AnalyticsPlatform):
    """
    Google Analytics 4 platform integration.

    Uses the GA4 Data API to fetch analytics data including:
    - Event tracking and analysis
    - Revenue and e-commerce metrics
    - User analytics and cohorts
    - Funnel analysis
    """

    def __init__(self, config: AnalyticsConfig):
        """
        Initialize GA4 integration.

        Args:
            config: AnalyticsConfig with GA4 settings
        """
        super().__init__(config)
        self.property_id = config.ga4_property_id
        self.client: BetaAnalyticsDataClient | None = None

        if not self.property_id:
            logger.warning("GA4 property ID not configured")

    def authenticate(self) -> bool:
        """
        Authenticate with Google Analytics 4.

        Uses service account credentials from either:
        - JSON file path (GA4_SERVICE_ACCOUNT_PATH)
        - JSON string (GA4_CREDENTIALS_JSON)

        Returns:
            True if authentication successful

        Raises:
            AuthenticationError: If authentication fails
        """
        if BetaAnalyticsDataClient is None:
            raise AuthenticationError(
                "google-analytics-data package not installed. "
                "Install with: pip install google-analytics-data"
            )

        try:
            import os

            credentials_path = self.config.ga4_service_account_path
            credentials_json = self.config.ga4_credentials_json

            if credentials_json:
                # Use JSON string credentials
                import tempfile

                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=".json", delete=False
                ) as f:
                    f.write(credentials_json)
                    temp_path = f.name

                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_path
                self.client = BetaAnalyticsDataClient()
            elif credentials_path:
                # Use file path credentials
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
                self.client = BetaAnalyticsDataClient()
            else:
                # Use default application credentials
                self.client = BetaAnalyticsDataClient()

            self._authenticated = True
            logger.info(f"Authenticated with GA4 property: {self.property_id}")
            return True

        except GoogleAPIError as e:
            self._authenticated = False
            raise AuthenticationError(f"GA4 authentication failed: {e}") from e
        except Exception as e:
            self._authenticated = False
            raise AuthenticationError(f"GA4 authentication error: {e}") from e

    def track_event(self, event: AnalyticsEvent) -> bool:
        """
        Track a single event in GA4.

        Note: GA4 Data API is read-only. Events must be sent via
        Google Analytics Measurement Protocol. This method logs
        a warning and returns False.

        Args:
            event: AnalyticsEvent to track

        Returns:
            False (Data API is read-only)
        """
        logger.warning(
            "GA4 Data API is read-only. Use Measurement Protocol to track events. "
            "See: https://developers.google.com/analytics/devguides/collection/protocol/ga4"
        )
        return False

    def track_events_batch(self, events: list[AnalyticsEvent]) -> bool:
        """
        Track multiple events in GA4.

        Note: GA4 Data API is read-only. Events must be sent via
        Google Analytics Measurement Protocol. This method logs
        a warning and returns False.

        Args:
            events: List of AnalyticsEvent objects

        Returns:
            False (Data API is read-only)
        """
        logger.warning(
            "GA4 Data API is read-only. Use Measurement Protocol to track events. "
            "See: https://developers.google.com/analytics/devguides/collection/protocol/ga4"
        )
        return False

    def get_revenue(
        self,
        start_date: date | str,
        end_date: date | str,
        currency: str = "USD",
    ) -> RevenueData:
        """
        Get revenue metrics from GA4.

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
            # Run revenue report
            request = RunReportRequest(
                property=f"properties/{self.property_id}",
                dimensions=[
                    Dimension(name="date"),
                    Dimension(name="sessionSource"),
                ],
                metrics=[
                    Metric(name="totalRevenue"),
                    Metric(name="purchases"),
                    Metric(name="itemRevenue"),
                ],
                date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
            )

            response = self.client.run_report(request)

            # Parse response
            total_revenue = Decimal("0")
            transaction_count = 0
            revenue_by_source: dict[str, Decimal] = {}

            for row in response.rows:
                revenue_value = row.metric_values[0].value
                if revenue_value:
                    revenue = Decimal(revenue_value)
                    total_revenue += revenue

                purchases = row.metric_values[1].value
                if purchases:
                    transaction_count += int(purchases)

                source = row.dimension_values[1].value
                if source and revenue_value:
                    if source not in revenue_by_source:
                        revenue_by_source[source] = Decimal("0")
                    revenue_by_source[source] += Decimal(revenue_value)

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
                revenue_by_source=revenue_by_source if revenue_by_source else None,
            )

        except GoogleAPIError as e:
            raise APIError(f"GA4 API error fetching revenue: {e}") from e

    def get_user_count(
        self,
        start_date: date | str,
        end_date: date | str,
    ) -> int:
        """
        Get unique user count from GA4.

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
            request = RunReportRequest(
                property=f"properties/{self.property_id}",
                metrics=[Metric(name="totalUsers")],
                date_ranges=[
                    DateRange(start_date=start.isoformat(), end_date=end.isoformat())
                ],
            )

            response = self.client.run_report(request)

            if response.rows and response.rows[0].metric_values[0].value:
                return int(response.rows[0].metric_values[0].value)

            return 0

        except GoogleAPIError as e:
            raise APIError(f"GA4 API error fetching user count: {e}") from e

    def get_funnel_analysis(
        self,
        funnel_steps: list[str],
        start_date: date | str,
        end_date: date | str,
        window_days: int = 30,
    ) -> FunnelAnalysis:
        """
        Analyze conversion funnel in GA4.

        Note: GA4 Funnel Exploration requires a different API approach.
        This implementation provides a basic funnel analysis using
        event counts.

        Args:
            funnel_steps: List of event names for funnel steps
            start_date: Start date
            end_date: End date
            window_days: Time window (not used in basic implementation)

        Returns:
            FunnelAnalysis object
        """
        self._ensure_authenticated()

        start = self._parse_date(start_date)
        end = self._parse_date(end_date)

        steps_data = []
        previous_users = 0

        for i, step_name in enumerate(funnel_steps):
            try:
                request = RunReportRequest(
                    property=f"properties/{self.property_id}",
                    dimensions=[Dimension(name="eventName")],
                    metrics=[Metric(name="eventCount"), Metric(name="totalUsers")],
                    dimension_filter={
                        "filter": {
                            "field_name": "eventName",
                            "string_filter": {"match_type": "EXACT", "value": step_name},
                        }
                    },
                    date_ranges=[
                        DateRange(start_date=start.isoformat(), end_date=end.isoformat())
                    ],
                )

                response = self.client.run_report(request)

                users = 0
                if response.rows:
                    users = int(response.rows[0].metric_values[1].value or 0)

                completion_rate = 100.0
                dropoff_rate = 0.0
                conversion_rate = None

                if i > 0 and previous_users > 0:
                    completion_rate = (users / previous_users) * 100
                    dropoff_rate = 100 - completion_rate

                if i == 0:
                    total_users = users
                    conversion_rate = 100.0
                elif previous_users > 0:
                    conversion_rate = (users / total_users) * 100 if i > 0 else 100.0

                step = FunnelStep(
                    step_name=step_name,
                    step_number=i + 1,
                    users=users,
                    completion_rate=completion_rate,
                    dropoff_rate=dropoff_rate,
                    conversion_rate=conversion_rate,
                )

                steps_data.append(step)
                previous_users = users

            except GoogleAPIError as e:
                logger.error(f"Error fetching funnel step {step_name}: {e}")
                continue

        overall_conversion = 0.0
        if steps_data and steps_data[0].users > 0:
            overall_conversion = (
                steps_data[-1].users / steps_data[0].users
            ) * 100

        return FunnelAnalysis(
            funnel_name=" → ".join(funnel_steps),
            start_date=start,
            end_date=end,
            total_users=steps_data[0].users if steps_data else 0,
            steps=steps_data,
            overall_conversion_rate=overall_conversion,
        )

    def get_cohort_analysis(
        self,
        cohort_start_date: date | str,
        cohort_end_date: date | str,
        metric: str = "retention",
        periods: int = 12,
    ) -> list[CohortData]:
        """
        Analyze cohorts in GA4.

        Note: GA4 Cohort Exploration requires specialized API calls.
        This is a simplified implementation using user retention.

        Args:
            cohort_start_date: Cohort start date
            cohort_end_date: Cohort end date
            metric: Metric to analyze
            periods: Number of periods

        Returns:
            List of CohortData objects
        """
        self._ensure_authenticated()

        logger.warning(
            "GA4 cohort analysis requires specialized API calls. "
            "Returning basic cohort data."
        )

        # Simplified implementation - return empty list
        # Full implementation would use GA4 Cohort API
        return []

    def get_user_profile(self, user_id: str) -> AnalyticsUser | None:
        """
        Get user profile from GA4.

        Args:
            user_id: User ID or client ID

        Returns:
            AnalyticsUser object or None
        """
        self._ensure_authenticated()

        try:
            # Query user data
            request = RunReportRequest(
                property=f"properties/{self.property_id}",
                dimensions=[
                    Dimension(name="clientId"),
                    Dimension(name="firstSessionDate"),
                    Dimension(name="sessionCount"),
                ],
                metrics=[
                    Metric(name="totalRevenue"),
                    Metric(name="sessionCount"),
                ],
                dimension_filter={
                    "filter": {
                        "field_name": "clientId",
                        "string_filter": {"match_type": "EXACT", "value": user_id},
                    }
                },
                limit=1,
            )

            response = self.client.run_report(request)

            if not response.rows:
                return None

            row = response.rows[0]

            return AnalyticsUser(
                user_id=user_id,
                first_seen=datetime.fromisoformat(row.dimension_values[1].value)
                if row.dimension_values[1].value
                else None,
                last_seen=datetime.now(),
                total_sessions=int(row.metric_values[1].value or 0),
                total_revenue=Decimal(row.metric_values[0].value or 0),
            )

        except GoogleAPIError as e:
            raise APIError(f"GA4 API error fetching user profile: {e}") from e

    def get_events(
        self,
        start_date: date | str,
        end_date: date | str,
        event_name: str | None = None,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[AnalyticsEvent]:
        """
        Retrieve events from GA4.

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
            dimensions = [
                Dimension(name="eventName"),
                Dimension(name="eventDate"),
                Dimension(name="eventTimestamp"),
                Dimension(name="clientId"),
            ]

            request = RunReportRequest(
                property=f"properties/{self.property_id}",
                dimensions=dimensions,
                metrics=[Metric(name="eventCount")],
                date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
                limit=limit,
            )

            if event_name:
                request.dimension_filter = {
                    "filter": {
                        "field_name": "eventName",
                        "string_filter": {"match_type": "EXACT", "value": event_name},
                    }
                }

            if user_id:
                if hasattr(request, "dimension_filter"):
                    # Combine filters
                    request.dimension_filter = {
                        "and_group": {
                            "expressions": [
                                request.dimension_filter,
                                {
                                    "filter": {
                                        "field_name": "clientId",
                                        "string_filter": {
                                            "match_type": "EXACT",
                                            "value": user_id,
                                        },
                                    }
                                },
                            ]
                        }
                    }
                else:
                    request.dimension_filter = {
                        "filter": {
                            "field_name": "clientId",
                            "string_filter": {"match_type": "EXACT", "value": user_id},
                        }
                    }

            response = self.client.run_report(request)

            events = []
            for row in response.rows:
                events.append(
                    AnalyticsEvent(
                        event_name=row.dimension_values[0].value,
                        event_type="custom",
                        timestamp=datetime.fromisoformat(row.dimension_values[2].value),
                        user_id=row.dimension_values[3].value,
                    )
                )

            return events[:limit]

        except GoogleAPIError as e:
            raise APIError(f"GA4 API error fetching events: {e}") from e

    def _ensure_authenticated(self) -> None:
        """Ensure the client is authenticated."""
        if not self.is_authenticated():
            self.authenticate()
