"""
CDN Integration Module
=====================

Provides CDN (Content Delivery Network) integration for global content delivery.

Features:
- CloudFront CDN integration
- Presigned URL generation
- Cache invalidation
- Custom domain support
- Signed URL authentication
- Edge function triggers
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import botocore.signers
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from .storage import StorageConfig

logger = logging.getLogger(__name__)


# ============================================================================
# CloudFront CDN Manager
# ============================================================================


class CloudFrontCDN:
    """
    AWS CloudFront CDN manager.

    Features:
    - Distribution management
    - Signed URL generation for private content
    - Cache invalidation
    - Custom domain configuration
    - SSL certificate management
    """

    def __init__(self, config: StorageConfig) -> None:
        """
        Initialize CloudFront CDN manager.

        Args:
            config: Storage configuration with CDN settings
        """
        self._config = config
        self._client: Any | None = None
        self._distribution_id: str | None = None
        self._domain: str = config.cdn_domain
        self._key_pair_id: str | None = config.cdn_key_id
        self._private_key: Any | None = None

        if config.cdn_enabled and config.cdn_domain:
            self._initialize()

    def _initialize(self) -> None:
        """Initialize CloudFront client and load credentials."""
        try:
            import boto3

            # Create CloudFront client
            session_config = {
                "aws_access_key_id": self._config.aws_access_key_id,
                "aws_secret_access_key": self._config.aws_secret_access_key,
                "region_name": self._config.aws_region,
            }

            if self._config.aws_endpoint_url:
                session_config["endpoint_url"] = self._config.aws_endpoint_url

            self._client = boto3.client("cloudfront", **session_config)

            # Load private key for signed URLs
            if self._config.cdn_private_key:
                self._load_private_key(self._config.cdn_private_key)

            # Get distribution ID from domain
            self._distribution_id = self._get_distribution_id()

            logger.info(f"[CDN] CloudFront initialized: {self._domain}")

        except ImportError:
            logger.warning("[CDN] boto3 not installed. Install with: pip install boto3")
        except Exception as e:
            logger.error(f"[CDN] Failed to initialize CloudFront: {e}")

    def _load_private_key(self, key_data: str) -> None:
        """Load RSA private key for signed URLs."""
        try:
            # Try to load from file path first
            key_path = Path(key_data)
            if key_path.exists():
                with open(key_path, "rb") as f:
                    key_data = f.read()

            # Parse PEM format
            self._private_key = serialization.load_pem_private_key(
                key_data.encode() if isinstance(key_data, str) else key_data,
                password=None,
                backend=default_backend(),
            )

            logger.debug("[CDN] Private key loaded for signed URLs")

        except Exception as e:
            logger.error(f"[CDN] Failed to load private key: {e}")

    def _get_distribution_id(self) -> str | None:
        """Get CloudFront distribution ID from domain."""
        try:
            if not self._client:
                return None

            paginator = self._client.get_paginator("list_distributions")
            for page in paginator.paginate():
                for dist in page.get("DistributionList", {}).get("Items", []):
                    domain_name = dist.get("DomainName", "")
                    aliases = dist.get("Aliases", {}).get("Items", {})

                    # Check if domain matches
                    if self._domain in [domain_name] + aliases.get("CNAME", []):
                        dist_id = dist.get("Id")
                        logger.debug(f"[CDN] Found distribution ID: {dist_id}")
                        return dist_id

            logger.warning(f"[CDN] No distribution found for domain: {self._domain}")
            return None

        except Exception as e:
            logger.error(f"[CDN] Failed to get distribution ID: {e}")
            return None

    def generate_signed_url(
        self,
        key: str,
        expiration: int = 3600,
        ip_range: str | None = None,
    ) -> str:
        """
        Generate signed CloudFront URL for private content.

        Args:
            key: Content key (path without domain)
            expiration: URL expiration in seconds
            ip_range: Optional IP address restriction (CIDR)

        Returns:
            Signed URL

        Raises:
            Exception: If signing fails
        """
        if not self._private_key or not self._key_pair_id:
            raise RuntimeError("CloudFront signing credentials not configured")

        try:
            # Build URL
            url = f"https://{self._domain}/{key.lstrip('/')}"

            # Calculate expiration
            expires = int(time.time()) + expiration

            # Build policy
            policy = {
                "Statement": [
                    {
                        "Resource": url,
                        "Condition": {
                            "DateLessThan": {"AWS:EpochTime": expires},
                        },
                    }
                ]
            }

            # Add IP restriction if specified
            if ip_range:
                policy["Statement"][0]["Condition"]["IpAddress"] = {
                    "AWS:SourceIp": ip_range
                }

            # Serialize and sign policy
            import json

            policy_json = json.dumps(policy, separators=(",", ":"))
            policy_bytes = policy_json.encode("utf-8")

            signature = self._private_key.sign(
                policy_bytes,
                padding.PKCS1v15(),
                hashes.SHA1(),
            )

            # Encode signature
            signature_b64 = base64.b64encode(signature).decode("utf-8")
            signature_safe = signature_b64.replace("+", "-").replace("/", "_").replace("=", "")

            # Build signed URL
            policy_b64 = base64.b64encode(policy_bytes).decode("utf-8")
            policy_safe = policy_b64.replace("+", "-").replace("/", "_").replace("=", "")

            signed_url = f"{url}?Expires={expires}&Signature={signature_safe}&Key-Pair-Id={self._key_pair_id}"

            return signed_url

        except Exception as e:
            logger.error(f"[CDN] Failed to generate signed URL: {e}")
            raise

    def generate_presigned_url(
        self,
        key: str,
        expiration: int = 3600,
        use_signed: bool = False,
        ip_range: str | None = None,
    ) -> str:
        """
        Generate presigned URL for content.

        Args:
            key: Content key
            expiration: Expiration in seconds
            use_signed: Use CloudFront signed URLs (requires private key)
            ip_range: IP restriction for signed URLs

        Returns:
            Presigned URL
        """
        url = f"https://{self._domain}/{key.lstrip('/')}"

        # Use signed URL if enabled and credentials available
        if use_signed and self._private_key and self._key_pair_id:
            return self.generate_signed_url(key, expiration, ip_range)

        # For public content, just return the URL
        # Add cache-busting query parameter for fresh content
        cache_buster = int(time.time() / 300)  # Changes every 5 minutes
        return f"{url}?_={cache_buster}"

    def invalidate_cache(
        self,
        paths: list[str],
        caller_reference: str | None = None,
    ) -> dict[str, Any]:
        """
        Invalidate CloudFront cache for specific paths.

        Args:
            paths: List of paths to invalidate (e.g., ["/images/*", "/videos/sample.mp4"])
            caller_reference: Unique identifier for this invalidation

        Returns:
            Invalidation result

        Raises:
            Exception: If invalidation fails
        """
        if not self._client or not self._distribution_id:
            logger.warning("[CDN] CloudFront not configured for cache invalidation")
            return {"status": "skipped"}

        try:
            # Generate caller reference if not provided
            if not caller_reference:
                caller_reference = f"invalidation-{int(time.time())}"

            # Create invalidation
            response = self._client.create_invalidation(
                DistributionId=self._distribution_id,
                InvalidationBatch={
                    "CallerReference": caller_reference,
                    "Paths": {
                        "Quantity": len(paths),
                        "Items": paths,
                    },
                },
            )

            invalidation = response.get("Invalidation", {})

            result = {
                "id": invalidation.get("Id"),
                "status": invalidation.get("Status"),
                "create_time": invalidation.get("CreateTime"),
                "caller_reference": caller_reference,
            }

            logger.info(f"[CDN] Cache invalidation created: {result['id']} for {len(paths)} paths")
            return result

        except Exception as e:
            logger.error(f"[CDN] Cache invalidation failed: {e}")
            raise

    def get_invalidation_status(
        self,
        invalidation_id: str,
    ) -> dict[str, Any]:
        """
        Get status of a cache invalidation.

        Args:
            invalidation_id: Invalidation ID

        Returns:
            Invalidation status
        """
        if not self._client or not self._distribution_id:
            return {"status": "unavailable"}

        try:
            response = self._client.get_invalidation(
                DistributionId=self._distribution_id,
                Id=invalidation_id,
            )

            invalidation = response.get("Invalidation", {})

            return {
                "id": invalidation.get("Id"),
                "status": invalidation.get("Status"),
                "create_time": invalidation.get("CreateTime"),
                "paths": invalidation.get("InvalidationBatch", {}).get("Paths", {}).get("Items", []),
            }

        except Exception as e:
            logger.error(f"[CDN] Failed to get invalidation status: {e}")
            return {"status": "error", "error": str(e)}

    def create_distribution(
        self,
        origin_domain: str,
        origin_path: str = "",
        enabled: bool = True,
        aliases: list[str] | None = None,
        default_ttl: int = 86400,
        price_class: str = "PriceClass_100",
    ) -> dict[str, Any]:
        """
        Create a new CloudFront distribution.

        Args:
            origin_domain: Origin domain (S3 bucket or custom)
            origin_path: Origin path prefix
            enabled: Whether distribution is enabled
            aliases: CNAME aliases for the distribution
            default_ttl: Default cache TTL in seconds
            price_class: Price class for geographic distribution

        Returns:
            Created distribution details

        Raises:
            Exception: If creation fails
        """
        if not self._client:
            raise RuntimeError("CloudFront client not initialized")

        try:
            # Build origin config
            origin_config = {
                "Id": "S3-" + origin_domain.replace(".", "-"),
                "DomainName": origin_domain,
                "S3OriginConfig": {"OriginAccessIdentity": ""} if "s3" in origin_domain.lower() else {},
            }

            if origin_path:
                origin_config["OriginPath"] = origin_path

            # Build default cache behavior
            cache_behavior = {
                "TargetOriginId": origin_config["Id"],
                "ViewerProtocolPolicy": "allow-all",
                "MinTTL": 0,
                "AllowedMethods": {
                    "Quantity": 2,
                    "Items": ["GET", "HEAD"],
                },
                "CachedMethods": {
                    "Quantity": 2,
                    "Items": ["GET", "HEAD"],
                },
                "ForwardedValues": {
                    "QueryString": False,
                    "Cookies": {"Forward": "none"},
                },
                "DefaultTTL": default_ttl,
                "MaxTTL": 31536000,  # 1 year
                "Compress": True,
            }

            # Create distribution
            response = self._client.create_distribution(
                DistributionConfig={
                    "CallerReference": f"dist-{int(time.time())}",
                    "Aliases": {
                        "Quantity": len(aliases) if aliases else 0,
                        "Items": aliases or [],
                    } if aliases else {"Quantity": 0},
                    "DefaultRootObject": "index.html",
                    "DefaultCacheBehavior": cache_behavior,
                    "Origins": {
                        "Quantity": 1,
                        "Items": [origin_config],
                    },
                    "Comment": f"Distribution for {origin_domain}",
                    "Enabled": enabled,
                    "PriceClass": price_class,
                    "ViewerCertificate": {
                        "CloudFrontDefaultCertificate": True,
                        "SSLSupportMethod": "sni-only",
                    },
                }
            )

            distribution = response.get("Distribution", {})

            logger.info(f"[CDN] Distribution created: {distribution.get('Id')}")

            return {
                "id": distribution.get("Id"),
                "domain": distribution.get("DomainName"),
                "status": distribution.get("Status"),
                "enabled": distribution.get("Enabled"),
            }

        except Exception as e:
            logger.error(f"[CDN] Failed to create distribution: {e}")
            raise

    def get_distribution_metrics(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """
        Get CloudFront distribution metrics.

        Args:
            start_date: Start date for metrics (default: 24 hours ago)
            end_date: End date for metrics (default: now)

        Returns:
            Distribution metrics
        """
        if not self._client or not self._distribution_id:
            return {"error": "CloudFront not configured"}

        try:
            import boto3

            # CloudWatch client for metrics
            cloudwatch = boto3.client(
                "cloudwatch",
                aws_access_key_id=self._config.aws_access_key_id,
                aws_secret_access_key=self._config.aws_secret_access_key,
                region_name=self._config.aws_region,
            )

            # Default to last 24 hours
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(hours=24)

            # Get metrics
            metrics = cloudwatch.get_metric_statistics(
                Namespace="AWS/CloudFront",
                MetricName="Requests",
                Dimensions=[{"Name": "DistributionId", "Value": self._distribution_id}],
                StartTime=start_date,
                EndTime=end_date,
                Period=3600,  # 1 hour
                Statistics=["Sum"],
            )

            total_requests = sum(
                dp["Sum"] for dp in metrics.get("Datapoints", [])
            )

            # Get bytes transferred
            bytes_metrics = cloudwatch.get_metric_statistics(
                Namespace="AWS/CloudFront",
                MetricName="BytesDownloaded",
                Dimensions=[{"Name": "DistributionId", "Value": self._distribution_id}],
                StartTime=start_date,
                EndTime=end_date,
                Period=3600,
                Statistics=["Sum"],
            )

            total_bytes = sum(
                dp["Sum"] for dp in bytes_metrics.get("Datapoints", [])
            )

            return {
                "distribution_id": self._distribution_id,
                "domain": self._domain,
                "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
                "requests": {"total": total_requests},
                "bytes_downloaded": {"total": total_bytes, "gb": total_bytes / (1024**3)},
            }

        except Exception as e:
            logger.error(f"[CDN] Failed to get metrics: {e}")
            return {"error": str(e)}


# ============================================================================
# CDN Manager Factory
# ============================================================================


class CDNManager:
    """
    High-level CDN manager for content delivery.

    Features:
    - Multiple CDN provider support
    - Automatic URL generation
    - Cache management
    - Analytics tracking
    """

    def __init__(self, config: StorageConfig) -> None:
        """Initialize CDN manager."""
        self._config = config
        self._cloudfront: CloudFrontCDN | None = None

        if config.cdn_enabled:
            self._cloudfront = CloudFrontCDN(config)

    def generate_url(
        self,
        key: str,
        expiration: int = 3600,
        signed: bool = False,
        ip_range: str | None = None,
    ) -> str:
        """
        Generate CDN URL for content.

        Args:
            key: Content key
            expiration: URL expiration in seconds
            signed: Generate signed URL for private content
            ip_range: IP restriction for signed URLs

        Returns:
            CDN URL or fallback URL
        """
        if self._cloudfront:
            return self._cloudfront.generate_presigned_url(
                key,
                expiration,
                use_signed=signed,
                ip_range=ip_range,
            )

        # Fallback to direct origin URL
        if self._config.backend == "aws_s3" and self._config.aws_bucket:
            region = self._config.aws_region
            return f"https://{self._config.aws_bucket}.s3.{region}.amazonaws.com/{key}"

        # No CDN available
        return f"/{key}"

    def invalidate(self, paths: list[str]) -> dict[str, Any]:
        """
        Invalidate CDN cache for paths.

        Args:
            paths: List of paths to invalidate

        Returns:
            Invalidation result
        """
        if self._cloudfront:
            return self._cloudfront.invalidate_cache(paths)

        logger.warning("[CDN] Cache invalidation requested but CDN not enabled")
        return {"status": "skipped", "reason": "CDN not enabled"}

    def get_metrics(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """
        Get CDN metrics.

        Args:
            start_date: Start date for metrics
            end_date: End date for metrics

        Returns:
            CDN metrics
        """
        if self._cloudfront:
            return self._cloudfront.get_distribution_metrics(start_date, end_date)

        return {"error": "CDN not enabled"}


# ============================================================================
# Global CDN Instance
# ============================================================================

_cdn_manager: CDNManager | None = None


def get_cdn() -> CDNManager | None:
    """Get global CDN manager instance."""
    global _cdn_manager
    if _cdn_manager is None:
        from .storage import StorageConfig

        config = StorageConfig.from_env()
        if config.cdn_enabled:
            _cdn_manager = CDNManager(config)
    return _cdn_manager
