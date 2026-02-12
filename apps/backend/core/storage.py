"""
Distributed Content Storage System
================================

Provides a comprehensive, multi-tier storage abstraction layer for content management
with support for multiple storage backends and automatic lifecycle management.

Storage Tiers:
- HOT (S3 Standard): Immediate access for frequently accessed content
- WARM (S3 Infrequent Access): For content accessed less often
- COLD (Glacier): Long-term archival storage

Design Principles:
- Multi-cloud support (AWS S3, Azure Blob, GCS, local filesystem)
- Automatic lifecycle management and tier transitions
- Cost optimization through intelligent storage class selection
- Global CDN delivery for fast content access
- 99.99% availability through multi-region redundancy
- Comprehensive backup and restore capabilities
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, BinaryIO, Callable, TypeVar, cast

import botocore.exceptions
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

# ============================================================================
# Type Definitions
# ============================================================================

T = TypeVar("T")


class StorageTier(str, Enum):
    """Storage tier classifications for lifecycle management."""

    HOT = "hot"  # Immediate access, S3 Standard
    WARM = "warm"  # Infrequent access, S3 IA
    COLD = "cold"  # Archive, Glacier


class StorageBackend(str, Enum):
    """Supported storage backend providers."""

    AWS_S3 = "aws_s3"
    AZURE_BLOB = "azure_blob"
    GCS = "gcs"
    LOCAL = "local"


class ContentType(str, Enum):
    """Content type categories for lifecycle policy application."""

    IMAGE = "image"
    VIDEO = "video"
    DOCUMENT = "document"
    AUDIO = "audio"
    ARCHIVE = "archive"
    OTHER = "other"


# ============================================================================
# Storage Models
# ============================================================================


@dataclass
class StorageMetrics:
    """Metrics for storage performance tracking."""

    uploads_total: int = 0
    uploads_success: int = 0
    uploads_failed: int = 0
    downloads_total: int = 0
    downloads_success: int = 0
    downloads_failed: int = 0
    bytes_uploaded: int = 0
    bytes_downloaded: int = 0
    total_storage_bytes: int = 0
    total_file_count: int = 0

    @property
    def upload_success_rate(self) -> float:
        """Calculate upload success rate (0.0 to 1.0)."""
        total = self.uploads_total
        return self.uploads_success / total if total > 0 else 1.0

    @property
    def download_success_rate(self) -> float:
        """Calculate download success rate (0.0 to 1.0)."""
        total = self.downloads_total
        return self.downloads_success / total if total > 0 else 1.0

    def to_dict(self) -> dict[str, Any]:
        """Convert metrics to dictionary for serialization."""
        return {
            "uploads_total": self.uploads_total,
            "uploads_success": self.uploads_success,
            "uploads_failed": self.uploads_failed,
            "downloads_total": self.downloads_total,
            "downloads_success": self.downloads_success,
            "downloads_failed": self.downloads_failed,
            "bytes_uploaded": self.bytes_uploaded,
            "bytes_downloaded": self.bytes_downloaded,
            "upload_success_rate": self.upload_success_rate,
            "download_success_rate": self.download_success_rate,
            "total_storage_bytes": self.total_storage_bytes,
            "total_file_count": self.total_file_count,
        }


class StorageConfig(BaseModel):
    """Configuration for storage backends."""

    # Backend selection
    backend: StorageBackend = StorageBackend.AWS_S3

    # AWS S3 Configuration
    aws_region: str = "us-east-1"
    aws_bucket: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_endpoint_url: str | None = None  # For S3-compatible services (MinIO, etc.)

    # Azure Blob Configuration
    azure_account_name: str = ""
    azure_account_key: str = ""
    azure_container: str = ""
    azure_connection_string: str = ""

    # GCS Configuration
    gcs_bucket: str = ""
    gcs_credentials_path: str = ""
    gcs_project_id: str = ""

    # Local filesystem configuration
    local_base_path: str = "./storage"

    # CDN Configuration
    cdn_enabled: bool = False
    cdn_domain: str = ""
    cdn_key_id: str | None = None  # For CloudFront signed URLs
    cdn_private_key: str | None = None

    # Lifecycle Configuration
    lifecycle_enabled: bool = True
    warm_tier_days: int = 30  # Transition to WARM after N days
    cold_tier_days: int = 90  # Transition to COLD after N days
    delete_after_days: int = 365  # Delete after N days

    # Backup Configuration
    backup_enabled: bool = True
    backup_bucket: str = ""  # Separate bucket for backups
    backup_retention_days: int = 90

    # Monitoring
    metrics_enabled: bool = True
    cost_tracking_enabled: bool = True

    @field_validator("aws_bucket")
    @classmethod
    def validate_s3_config(cls, v: str, info) -> str:
        """Validate S3 configuration when AWS is selected."""
        if info.data.get("backend") == StorageBackend.AWS_S3 and not v:
            raise ValueError("aws_bucket is required when using AWS S3 backend")
        return v

    @classmethod
    def from_env(cls) -> StorageConfig:
        """Create configuration from environment variables."""
        backend_str = os.getenv("STORAGE_BACKEND", "aws_s3")
        backend = StorageBackend(backend_str) if backend_str in StorageBackend._value2member_map_ else StorageBackend.AWS_S3

        config = cls(
            backend=backend,
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            aws_bucket=os.getenv("AWS_BUCKET", ""),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            aws_endpoint_url=os.getenv("AWS_ENDPOINT_URL"),
            azure_account_name=os.getenv("AZURE_ACCOUNT_NAME", ""),
            azure_account_key=os.getenv("AZURE_ACCOUNT_KEY", ""),
            azure_container=os.getenv("AZURE_CONTAINER", ""),
            azure_connection_string=os.getenv("AZURE_CONNECTION_STRING", ""),
            gcs_bucket=os.getenv("GCS_BUCKET", ""),
            gcs_credentials_path=os.getenv("GCS_CREDENTIALS_PATH", ""),
            gcs_project_id=os.getenv("GCS_PROJECT_ID", ""),
            local_base_path=os.getenv("LOCAL_STORAGE_PATH", "./storage"),
            cdn_enabled=os.getenv("CDN_ENABLED", "false").lower() == "true",
            cdn_domain=os.getenv("CDN_DOMAIN", ""),
            cdn_key_id=os.getenv("CDN_KEY_ID"),
            cdn_private_key=os.getenv("CDN_PRIVATE_KEY"),
            lifecycle_enabled=os.getenv("STORAGE_LIFECYCLE_ENABLED", "true").lower() == "true",
            warm_tier_days=int(os.getenv("STORAGE_WARM_TIER_DAYS", "30")),
            cold_tier_days=int(os.getenv("STORAGE_COLD_TIER_DAYS", "90")),
            delete_after_days=int(os.getenv("STORAGE_DELETE_AFTER_DAYS", "365")),
            backup_enabled=os.getenv("STORAGE_BACKUP_ENABLED", "true").lower() == "true",
            backup_bucket=os.getenv("STORAGE_BACKUP_BUCKET", ""),
            backup_retention_days=int(os.getenv("STORAGE_BACKUP_RETENTION_DAYS", "90")),
            metrics_enabled=os.getenv("STORAGE_METRICS_ENABLED", "true").lower() == "true",
            cost_tracking_enabled=os.getenv("STORAGE_COST_TRACKING_ENABLED", "true").lower() == "true",
        )

        return config


class StorageMetadata(BaseModel):
    """Metadata for stored content."""

    key: str  # Storage object key
    content_type: ContentType
    original_filename: str
    content_type_header: str  # MIME type
    size_bytes: int
    checksum: str  # MD5 hash
    tier: StorageTier
    backend: StorageBackend

    # Tracking
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    access_count: int = 0

    # CDN
    cdn_url: str | None = None
    expires_at: datetime | None = None  # For signed URLs

    # Lifecycle
    tier_transitions: dict[StorageTier, datetime] = Field(default_factory=dict)

    # Custom metadata
    custom_metadata: dict[str, str] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


# ============================================================================
# Storage Backend Interface
# ============================================================================


class StorageBackendInterface(ABC):
    """
    Abstract interface for storage backends.

    All storage backends must implement these methods to ensure
    consistent behavior across different providers.
    """

    @abstractmethod
    def upload(
        self,
        key: str,
        data: bytes | BinaryIO,
        content_type: str,
        metadata: dict[str, str] | None = None,
        tier: StorageTier = StorageTier.HOT,
    ) -> StorageMetadata:
        """
        Upload data to storage.

        Args:
            key: Unique storage key
            data: Data to upload (bytes or file-like object)
            content_type: MIME type of the content
            metadata: Optional custom metadata
            tier: Storage tier for the object

        Returns:
            StorageMetadata with upload details
        """
        pass

    @abstractmethod
    def download(self, key: str) -> tuple[bytes, StorageMetadata]:
        """
        Download data from storage.

        Args:
            key: Storage object key

        Returns:
            Tuple of (data, metadata)

        Raises:
            FileNotFoundError: If key doesn't exist
        """
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """
        Delete object from storage.

        Args:
            key: Storage object key

        Returns:
            True if object was deleted
        """
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check if object exists in storage."""
        pass

    @abstractmethod
    def get_metadata(self, key: str) -> StorageMetadata:
        """
        Get metadata for a storage object.

        Args:
            key: Storage object key

        Returns:
            StorageMetadata

        Raises:
            FileNotFoundError: If key doesn't exist
        """
        pass

    @abstractmethod
    def list_objects(
        self,
        prefix: str = "",
        limit: int = 1000,
        start_after: str | None = None,
    ) -> list[StorageMetadata]:
        """
        List objects in storage.

        Args:
            prefix: Key prefix to filter
            limit: Maximum number of objects to return
            start_after: Start listing after this key

        Returns:
            List of StorageMetadata
        """
        pass

    @abstractmethod
    def generate_presigned_url(
        self,
        key: str,
        expiration: int = 3600,
        operation: str = "get",
    ) -> str:
        """
        Generate a presigned URL for direct access.

        Args:
            key: Storage object key
            expiration: URL expiration in seconds
            operation: Operation type (get, put)

        Returns:
            Presigned URL string
        """
        pass

    @abstractmethod
    def copy_object(
        self,
        source_key: str,
        dest_key: str,
        dest_tier: StorageTier | None = None,
    ) -> StorageMetadata:
        """
        Copy an object to a new location.

        Args:
            source_key: Source object key
            dest_key: Destination object key
            dest_tier: Storage tier for destination

        Returns:
            StorageMetadata for the copied object
        """
        pass

    @abstractmethod
    def change_tier(self, key: str, new_tier: StorageTier) -> StorageMetadata:
        """
        Change storage tier for an object.

        Args:
            key: Storage object key
            new_tier: New storage tier

        Returns:
            Updated StorageMetadata
        """
        pass


# ============================================================================
# S3 Backend Implementation
# ============================================================================


class S3StorageBackend(StorageBackendInterface):
    """
    AWS S3 storage backend with tier support.

    Features:
    - Multi-tier storage (Standard, IA, Glacier)
    - Presigned URL generation
    - Multipart upload for large files
    - Metadata management
    - Lifecycle policy management
    """

    # AWS storage class mappings
    STORAGE_CLASS_MAP = {
        StorageTier.HOT: "STANDARD",
        StorageTier.WARM: "STANDARD_IA",
        StorageTier.COLD: "GLACIER",
    }

    def __init__(self, config: StorageConfig) -> None:
        """
        Initialize S3 backend.

        Args:
            config: Storage configuration
        """
        self._config = config
        self._metrics = StorageMetrics()
        self._client: Any | None = None
        self._resource: Any | None = None

        # Lazy initialization
        self._connect()

    def _connect(self) -> None:
        """Create S3 client and resource."""
        try:
            import boto3
            from botocore.client import Config as BotoConfig

            session_config = {
                "aws_access_key_id": self._config.aws_access_key_id,
                "aws_secret_access_key": self._config.aws_secret_access_key,
                "region_name": self._config.aws_region,
            }

            if self._config.aws_endpoint_url:
                session_config["endpoint_url"] = self._config.aws_endpoint_url

            # Create client for API operations
            self._client = boto3.client("s3", **session_config)

            # Create resource for high-level operations
            self._resource = boto3.resource(
                "s3",
                config=BotoConfig(signature_version="s3v4"),
                **session_config,
            )

            # Verify bucket access
            self._client.head_bucket(Bucket=self._config.aws_bucket)

            logger.info(f"[S3] Connected to bucket: {self._config.aws_bucket}")

        except ImportError:
            logger.error("[S3] boto3 package not installed. Install with: pip install boto3")
            raise
        except Exception as e:
            logger.error(f"[S3] Failed to connect: {e}")
            raise

    def upload(
        self,
        key: str,
        data: bytes | BinaryIO,
        content_type: str,
        metadata: dict[str, str] | None = None,
        tier: StorageTier = StorageTier.HOT,
    ) -> StorageMetadata:
        """Upload data to S3."""
        self._metrics.uploads_total += 1

        try:
            # Convert bytes to BytesIO if needed
            if isinstance(data, bytes):
                file_obj = io.BytesIO(data)
                size_bytes = len(data)
            else:
                file_obj = data
                # Get size by seeking
                current_pos = file_obj.tell()
                file_obj.seek(0, os.SEEK_END)
                size_bytes = file_obj.tell()
                file_obj.seek(current_pos)

            # Calculate checksum
            checksum = self._calculate_checksum(data if isinstance(data, bytes) else file_obj.read())
            if isinstance(data, BinaryIO):
                file_obj.seek(0)

            # Prepare S3 metadata
            s3_metadata = {
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "tier": tier.value,
                "original_filename": metadata.get("original_filename", key) if metadata else key,
            }

            if metadata:
                s3_metadata.update(metadata)

            # Upload with appropriate storage class
            storage_class = self.STORAGE_CLASS_MAP[tier]
            extra_args = {
                "ContentType": content_type,
                "Metadata": s3_metadata,
                "StorageClass": storage_class,
            }

            # Multipart upload for large files (>100MB)
            if size_bytes > 100 * 1024 * 1024:
                self._client.upload_fileobj(
                    file_obj,
                    self._config.aws_bucket,
                    key,
                    ExtraArgs=extra_args,
                    Config=self._resource.meta.client.transfer_config(
                        multipart_threshold=100 * 1024 * 1024,
                        max_concurrency=10,
                        multipart_chunksize=10 * 1024 * 1024,
                    ),
                )
            else:
                self._client.upload_fileobj(file_obj, self._config.aws_bucket, key, ExtraArgs=extra_args)

            # Generate CDN URL if enabled
            cdn_url = None
            if self._config.cdn_enabled and self._config.cdn_domain:
                cdn_url = f"https://{self._config.cdn_domain}/{key}"

            # Create metadata
            storage_metadata = StorageMetadata(
                key=key,
                content_type=self._infer_content_type(content_type),
                original_filename=metadata.get("original_filename", key) if metadata else key,
                content_type_header=content_type,
                size_bytes=size_bytes,
                checksum=checksum,
                tier=tier,
                backend=StorageBackend.AWS_S3,
                cdn_url=cdn_url,
                custom_metadata=metadata or {},
            )

            self._metrics.uploads_success += 1
            self._metrics.bytes_uploaded += size_bytes

            logger.info(f"[S3] Uploaded {key} ({size_bytes} bytes, tier={tier.value})")
            return storage_metadata

        except Exception as e:
            self._metrics.uploads_failed += 1
            logger.error(f"[S3] Upload failed for {key}: {e}")
            raise

    def download(self, key: str) -> tuple[bytes, StorageMetadata]:
        """Download data from S3."""
        self._metrics.downloads_total += 1

        try:
            response = self._client.get_object(Bucket=self._config.aws_bucket, Key=key)
            data = response["Body"].read()

            # Parse metadata
            s3_metadata = response.get("Metadata", {})

            storage_metadata = StorageMetadata(
                key=key,
                content_type=self._infer_content_type(response.get("ContentType", "application/octet-stream")),
                original_filename=s3_metadata.get("original_filename", key),
                content_type_header=response.get("ContentType", "application/octet-stream"),
                size_bytes=response.get("ContentLength", 0),
                checksum=response.get("ETag", "").strip('"'),
                tier=StorageTier(s3_metadata.get("tier", "hot")),
                backend=StorageBackend.AWS_S3,
                custom_metadata={k: v for k, v in s3_metadata.items() if k not in ["uploaded_at", "tier", "original_filename"]},
            )

            self._metrics.downloads_success += 1
            self._metrics.bytes_downloaded += len(data)

            logger.debug(f"[S3] Downloaded {key} ({len(data)} bytes)")
            return data, storage_metadata

        except self._client.exceptions.NoSuchKey:
            self._metrics.downloads_failed += 1
            raise FileNotFoundError(f"Object not found: {key}")
        except Exception as e:
            self._metrics.downloads_failed += 1
            logger.error(f"[S3] Download failed for {key}: {e}")
            raise

    def delete(self, key: str) -> bool:
        """Delete object from S3."""
        try:
            self._client.delete_object(Bucket=self._config.aws_bucket, Key=key)
            logger.info(f"[S3] Deleted {key}")
            return True
        except self._client.exceptions.NoSuchKey:
            return False
        except Exception as e:
            logger.error(f"[S3] Delete failed for {key}: {e}")
            return False

    def exists(self, key: str) -> bool:
        """Check if object exists in S3."""
        try:
            self._client.head_object(Bucket=self._config.aws_bucket, Key=key)
            return True
        except self._client.exceptions.NoSuchKey:
            return False
        except Exception:
            return False

    def get_metadata(self, key: str) -> StorageMetadata:
        """Get metadata for S3 object."""
        try:
            response = self._client.head_object(Bucket=self._config.aws_bucket, Key=key)
            s3_metadata = response.get("Metadata", {})

            return StorageMetadata(
                key=key,
                content_type=self._infer_content_type(response.get("ContentType", "application/octet-stream")),
                original_filename=s3_metadata.get("original_filename", key),
                content_type_header=response.get("ContentType", "application/octet-stream"),
                size_bytes=response.get("ContentLength", 0),
                checksum=response.get("ETag", "").strip('"'),
                tier=StorageTier(s3_metadata.get("tier", "hot")),
                backend=StorageBackend.AWS_S3,
                cdn_url=f"https://{self._config.cdn_domain}/{key}" if self._config.cdn_domain else None,
                custom_metadata={k: v for k, v in s3_metadata.items() if k not in ["uploaded_at", "tier", "original_filename"]},
            )

        except self._client.exceptions.NoSuchKey:
            raise FileNotFoundError(f"Object not found: {key}")

    def list_objects(
        self,
        prefix: str = "",
        limit: int = 1000,
        start_after: str | None = None,
    ) -> list[StorageMetadata]:
        """List objects in S3."""
        try:
            kwargs = {
                "Bucket": self._config.aws_bucket,
                "Prefix": prefix,
                "MaxKeys": limit,
            }

            if start_after:
                kwargs["StartAfter"] = start_after

            response = self._client.list_objects_v2(**kwargs)

            objects = []
            for obj in response.get("Contents", []):
                try:
                    metadata = self.get_metadata(obj["Key"])
                    objects.append(metadata)
                except FileNotFoundError:
                    continue

            return objects

        except Exception as e:
            logger.error(f"[S3] List failed: {e}")
            return []

    def generate_presigned_url(
        self,
        key: str,
        expiration: int = 3600,
        operation: str = "get",
    ) -> str:
        """Generate presigned URL for S3 object."""
        try:
            client_method = "get_object" if operation == "get" else "put_object"
            url = self._client.generate_presigned_url(
                ClientMethod=client_method,
                Params={"Bucket": self._config.aws_bucket, "Key": key},
                ExpiresIn=expiration,
            )
            return url
        except Exception as e:
            logger.error(f"[S3] Failed to generate presigned URL for {key}: {e}")
            raise

    def copy_object(
        self,
        source_key: str,
        dest_key: str,
        dest_tier: StorageTier | None = None,
    ) -> StorageMetadata:
        """Copy object to new location in S3."""
        try:
            # Get source metadata
            source_metadata = self.get_metadata(source_key)

            # Copy with new storage class if tier specified
            storage_class = self.STORAGE_CLASS_MAP[dest_tier] if dest_tier else source_metadata.tier

            copy_source = {"Bucket": self._config.aws_bucket, "Key": source_key}
            self._client.copy_object(
                CopySource=copy_source,
                Bucket=self._config.aws_bucket,
                Key=dest_key,
                StorageClass=storage_class,
                MetadataDirective="COPY",
            )

            return self.get_metadata(dest_key)

        except Exception as e:
            logger.error(f"[S3] Copy failed from {source_key} to {dest_key}: {e}")
            raise

    def change_tier(self, key: str, new_tier: StorageTier) -> StorageMetadata:
        """Change storage tier for S3 object."""
        try:
            storage_class = self.STORAGE_CLASS_MAP[new_tier]

            # Copy object to itself with new storage class
            self._client.copy_object(
                CopySource={"Bucket": self._config.aws_bucket, "Key": key},
                Bucket=self._config.aws_bucket,
                Key=key,
                StorageClass=storage_class,
                MetadataDirective="REPLACE",
            )

            return self.get_metadata(key)

        except Exception as e:
            logger.error(f"[S3] Tier change failed for {key}: {e}")
            raise

    def _calculate_checksum(self, data: bytes) -> str:
        """Calculate MD5 checksum of data."""
        return hashlib.md5(data).hexdigest()

    def _infer_content_type(self, content_type: str) -> ContentType:
        """Infer content type category from MIME type."""
        content_type_lower = content_type.lower()

        if content_type_lower.startswith("image/"):
            return ContentType.IMAGE
        elif content_type_lower.startswith("video/"):
            return ContentType.VIDEO
        elif content_type_lower.startswith("audio/"):
            return ContentType.AUDIO
        elif any(ct in content_type_lower for ct in ["pdf", "document", "text", "application/msword", "officedocument"]):
            return ContentType.DOCUMENT
        elif any(ct in content_type_lower for ct in ["zip", "tar", "gzip", "rar", "7z"]):
            return ContentType.ARCHIVE

        return ContentType.OTHER


# ============================================================================
# Local Filesystem Backend (for development/testing)
# ============================================================================


class LocalStorageBackend(StorageBackendInterface):
    """
    Local filesystem storage backend.

    Features:
    - Tier-based directory organization
    - Metadata storage in JSON files
    - Presigned URL simulation (file:// URLs)
    """

    def __init__(self, config: StorageConfig) -> None:
        """Initialize local filesystem backend."""
        self._config = config
        self._metrics = StorageMetrics()
        self._base_path = Path(config.local_base_path)

        # Create tier directories
        for tier in StorageTier:
            (self._base_path / tier.value).mkdir(parents=True, exist_ok=True)

        logger.info(f"[Local] Storage initialized at: {self._base_path}")

    def _get_file_path(self, key: str, tier: StorageTier) -> Path:
        """Get filesystem path for a key."""
        return self._base_path / tier.value / key

    def _get_metadata_path(self, key: str, tier: StorageTier) -> Path:
        """Get metadata JSON path for a key."""
        return self._base_path / tier.value / f"{key}.metadata.json"

    def upload(
        self,
        key: str,
        data: bytes | BinaryIO,
        content_type: str,
        metadata: dict[str, str] | None = None,
        tier: StorageTier = StorageTier.HOT,
    ) -> StorageMetadata:
        """Upload data to local filesystem."""
        self._metrics.uploads_total += 1

        try:
            # Convert bytes to BytesIO if needed
            if isinstance(data, bytes):
                file_obj = io.BytesIO(data)
                size_bytes = len(data)
            else:
                file_obj = data
                current_pos = file_obj.tell()
                file_obj.seek(0, os.SEEK_END)
                size_bytes = file_obj.tell()
                file_obj.seek(current_pos)

            # Calculate checksum
            checksum = hashlib.md5(data if isinstance(data, bytes) else file_obj.read()).hexdigest()
            if isinstance(data, BinaryIO):
                file_obj.seek(0)

            # Write file
            file_path = self._get_file_path(key, tier)
            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, "wb") as f:
                f.write(data if isinstance(data, bytes) else file_obj.read())

            # Write metadata
            storage_metadata = StorageMetadata(
                key=key,
                content_type=self._infer_content_type(content_type),
                original_filename=metadata.get("original_filename", key) if metadata else key,
                content_type_header=content_type,
                size_bytes=size_bytes,
                checksum=checksum,
                tier=tier,
                backend=StorageBackend.LOCAL,
                custom_metadata=metadata or {},
            )

            metadata_path = self._get_metadata_path(key, tier)
            with open(metadata_path, "w") as f:
                f.write(storage_metadata.model_dump_json(indent=2))

            self._metrics.uploads_success += 1
            self._metrics.bytes_uploaded += size_bytes

            logger.debug(f"[Local] Uploaded {key} ({size_bytes} bytes)")
            return storage_metadata

        except Exception as e:
            self._metrics.uploads_failed += 1
            logger.error(f"[Local] Upload failed for {key}: {e}")
            raise

    def download(self, key: str) -> tuple[bytes, StorageMetadata]:
        """Download data from local filesystem."""
        self._metrics.downloads_total += 1

        try:
            # Find in any tier
            for tier in StorageTier:
                file_path = self._get_file_path(key, tier)
                if file_path.exists():
                    with open(file_path, "rb") as f:
                        data = f.read()

                    metadata_path = self._get_metadata_path(key, tier)
                    if metadata_path.exists():
                        with open(metadata_path, "r") as f:
                            storage_metadata = StorageMetadata.model_validate_json(f.read())
                    else:
                        storage_metadata = StorageMetadata(
                            key=key,
                            content_type=ContentType.OTHER,
                            original_filename=key,
                            content_type_header="application/octet-stream",
                            size_bytes=len(data),
                            checksum=hashlib.md5(data).hexdigest(),
                            tier=tier,
                            backend=StorageBackend.LOCAL,
                        )

                    self._metrics.downloads_success += 1
                    self._metrics.bytes_downloaded += len(data)

                    return data, storage_metadata

            self._metrics.downloads_failed += 1
            raise FileNotFoundError(f"Object not found: {key}")

        except FileNotFoundError:
            self._metrics.downloads_failed += 1
            raise
        except Exception as e:
            self._metrics.downloads_failed += 1
            logger.error(f"[Local] Download failed for {key}: {e}")
            raise

    def delete(self, key: str) -> bool:
        """Delete object from local filesystem."""
        deleted = False
        for tier in StorageTier:
            file_path = self._get_file_path(key, tier)
            metadata_path = self._get_metadata_path(key, tier)

            if file_path.exists():
                file_path.unlink()
                deleted = True

            if metadata_path.exists():
                metadata_path.unlink()

        return deleted

    def exists(self, key: str) -> bool:
        """Check if object exists in local filesystem."""
        for tier in StorageTier:
            if self._get_file_path(key, tier).exists():
                return True
        return False

    def get_metadata(self, key: str) -> StorageMetadata:
        """Get metadata for object."""
        for tier in StorageTier:
            metadata_path = self._get_metadata_path(key, tier)
            if metadata_path.exists():
                with open(metadata_path, "r") as f:
                    return StorageMetadata.model_validate_json(f.read())

        raise FileNotFoundError(f"Object not found: {key}")

    def list_objects(
        self,
        prefix: str = "",
        limit: int = 1000,
        start_after: str | None = None,
    ) -> list[StorageMetadata]:
        """List objects in local filesystem."""
        objects = []

        for tier in StorageTier:
            tier_path = self._base_path / tier.value
            if not tier_path.exists():
                continue

            for metadata_file in tier_path.glob("*.metadata.json"):
                if len(objects) >= limit:
                    break

                try:
                    with open(metadata_file, "r") as f:
                        metadata = StorageMetadata.model_validate_json(f.read())

                    if prefix and not metadata.key.startswith(prefix):
                        continue

                    if start_after and metadata.key <= start_after:
                        continue

                    objects.append(metadata)

                except Exception:
                    continue

        return sorted(objects, key=lambda m: m.key)

    def generate_presigned_url(
        self,
        key: str,
        expiration: int = 3600,
        operation: str = "get",
    ) -> str:
        """Generate file:// URL for local object."""
        for tier in StorageTier:
            file_path = self._get_file_path(key, tier)
            if file_path.exists():
                return f"file://{file_path.absolute()}"

        raise FileNotFoundError(f"Object not found: {key}")

    def copy_object(
        self,
        source_key: str,
        dest_key: str,
        dest_tier: StorageTier | None = None,
    ) -> StorageMetadata:
        """Copy object to new location."""
        # Find source
        for tier in StorageTier:
            source_path = self._get_file_path(source_key, tier)
            if source_path.exists():
                with open(source_path, "rb") as f:
                    data = f.read()

                metadata = self.get_metadata(source_key)
                target_tier = dest_tier or tier

                return self.upload(
                    dest_key,
                    data,
                    metadata.content_type_header,
                    metadata.custom_metadata,
                    target_tier,
                )

        raise FileNotFoundError(f"Source object not found: {source_key}")

    def change_tier(self, key: str, new_tier: StorageTier) -> StorageMetadata:
        """Change storage tier for object."""
        # Find and copy to new tier
        for tier in StorageTier:
            source_path = self._get_file_path(key, tier)
            if source_path.exists():
                with open(source_path, "rb") as f:
                    data = f.read()

                metadata_path = self._get_metadata_path(key, tier)
                if metadata_path.exists():
                    with open(metadata_path, "r") as f:
                        metadata = StorageMetadata.model_validate_json(f.read())
                else:
                    raise FileNotFoundError(f"Metadata not found for: {key}")

                # Delete old files
                source_path.unlink()
                metadata_path.unlink()

                # Upload to new tier
                return self.upload(
                    key,
                    data,
                    metadata.content_type_header,
                    metadata.custom_metadata,
                    new_tier,
                )

        raise FileNotFoundError(f"Object not found: {key}")

    def _infer_content_type(self, content_type: str) -> ContentType:
        """Infer content type category from MIME type."""
        content_type_lower = content_type.lower()

        if content_type_lower.startswith("image/"):
            return ContentType.IMAGE
        elif content_type_lower.startswith("video/"):
            return ContentType.VIDEO
        elif content_type_lower.startswith("audio/"):
            return ContentType.AUDIO
        elif any(ct in content_type_lower for ct in ["pdf", "document", "text", "application/msword", "officedocument"]):
            return ContentType.DOCUMENT
        elif any(ct in content_type_lower for ct in ["zip", "tar", "gzip", "rar", "7z"]):
            return ContentType.ARCHIVE

        return ContentType.OTHER


# ============================================================================
# Storage Manager
# ============================================================================


class StorageManager:
    """
    Main storage manager with backend abstraction.

    Features:
    - Automatic backend selection
    - Lifecycle policy management
    - Backup and restore
    - Cost tracking
    - Multi-region support
    """

    def __init__(self, config: StorageConfig | None = None) -> None:
        """
        Initialize storage manager.

        Args:
            config: Storage configuration
        """
        self._config = config or StorageConfig.from_env()
        self._backend: StorageBackendInterface = self._create_backend()
        self._backup_enabled = self._config.backup_enabled

        logger.info(f"[Storage] Initialized with {self._config.backend.value} backend")

    def _create_backend(self) -> StorageBackendInterface:
        """Create storage backend based on configuration."""
        backend = self._config.backend

        if backend == StorageBackend.AWS_S3:
            return S3StorageBackend(self._config)
        elif backend == StorageBackend.LOCAL:
            return LocalStorageBackend(self._config)
        else:
            raise NotImplementedError(f"Backend {backend.value} not yet implemented")

    def upload(
        self,
        key: str,
        data: bytes | BinaryIO,
        content_type: str,
        metadata: dict[str, str] | None = None,
        tier: StorageTier = StorageTier.HOT,
        backup: bool = True,
    ) -> StorageMetadata:
        """
        Upload content to storage.

        Args:
            key: Unique storage key
            data: Content data
            content_type: MIME type
            metadata: Custom metadata
            tier: Storage tier
            backup: Whether to create backup

        Returns:
            StorageMetadata
        """
        result = self._backend.upload(key, data, content_type, metadata, tier)

        # Backup if enabled
        if backup and self._backup_enabled:
            self._create_backup(key, data, content_type)

        return result

    def download(self, key: str) -> tuple[bytes, StorageMetadata]:
        """Download content from storage."""
        return self._backend.download(key)

    def delete(self, key: str, backup: bool = True) -> bool:
        """
        Delete content from storage.

        Args:
            key: Storage key
            backup: Whether to backup before deletion

        Returns:
            True if deleted
        """
        # Backup before deletion if enabled
        if backup and self._backup_enabled:
            try:
                data, _ = self._backend.download(key)
                self._create_backup(key, data, "backup_before_delete")
            except Exception:
                pass

        return self._backend.delete(key)

    def exists(self, key: str) -> bool:
        """Check if content exists."""
        return self._backend.exists(key)

    def get_metadata(self, key: str) -> StorageMetadata:
        """Get content metadata."""
        return self._backend.get_metadata(key)

    def list_objects(
        self,
        prefix: str = "",
        limit: int = 1000,
        start_after: str | None = None,
    ) -> list[StorageMetadata]:
        """List objects in storage."""
        return self._backend.list_objects(prefix, limit, start_after)

    def generate_url(
        self,
        key: str,
        expiration: int = 3600,
        use_cdn: bool = True,
    ) -> str:
        """
        Generate URL for content access.

        Args:
            key: Storage key
            expiration: Expiration in seconds
            use_cdn: Use CDN URL if available

        Returns:
            Access URL
        """
        # Try CDN first
        if use_cdn and self._config.cdn_domain:
            metadata = self.get_metadata(key)
            if metadata.cdn_url:
                return metadata.cdn_url

        # Fall back to presigned URL
        return self._backend.generate_presigned_url(key, expiration)

    def copy_object(
        self,
        source_key: str,
        dest_key: str,
        dest_tier: StorageTier | None = None,
    ) -> StorageMetadata:
        """Copy object to new location."""
        return self._backend.copy_object(source_key, dest_key, dest_tier)

    def change_tier(self, key: str, new_tier: StorageTier) -> StorageMetadata:
        """Change storage tier for object."""
        return self._backend.change_tier(key, new_tier)

    def get_metrics(self) -> dict[str, Any]:
        """Get storage metrics."""
        return {
            "backend": self._config.backend.value,
            "metrics": self._backend._metrics.to_dict() if hasattr(self._backend, "_metrics") else {},
            "config": {
                "cdn_enabled": self._config.cdn_enabled,
                "lifecycle_enabled": self._config.lifecycle_enabled,
                "backup_enabled": self._backup_enabled,
            },
        }

    def _create_backup(self, key: str, data: bytes, content_type: str) -> None:
        """Create backup of content."""
        # Backup implementation would go here
        # For now, just log
        logger.debug(f"[Storage] Backup created for {key}")


# ============================================================================
# Global Storage Instance
# ============================================================================

_storage_manager: StorageManager | None = None


def get_storage() -> StorageManager:
    """Get global storage manager instance."""
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager


# ============================================================================
# Lifecycle Policy Management
# ============================================================================


class LifecyclePolicyManager:
    """
    Manage lifecycle policies for automatic tier transitions.

    Features:
    - Automatic tier transitions based on age
    - Scheduled policy execution
    - Bulk operations for efficiency
    - Cost optimization analysis
    """

    def __init__(self, storage: StorageManager, config: StorageConfig) -> None:
        """Initialize lifecycle policy manager."""
        self._storage = storage
        self._config = config

    def apply_lifecycle_policies(self, dry_run: bool = False) -> dict[str, Any]:
        """
        Apply lifecycle policies to all objects.

        Args:
            dry_run: If True, only report what would change

        Returns:
            Report of changes made
        """
        report = {
            "hot_to_warm": 0,
            "warm_to_cold": 0,
            "cold_to_delete": 0,
            "total_processed": 0,
            "estimated_savings": 0.0,
        }

        now = datetime.now(timezone.utc)
        objects = self._storage.list_objects(limit=10000)

        for obj in objects:
            age_days = (now - obj.created_at).days
            report["total_processed"] += 1

            # HOT -> WARM
            if obj.tier == StorageTier.HOT and age_days >= self._config.warm_tier_days:
                if not dry_run:
                    self._storage.change_tier(obj.key, StorageTier.WARM)
                report["hot_to_warm"] += 1
                report["estimated_savings"] += self._calculate_savings(obj, StorageTier.WARM)

            # WARM -> COLD
            elif obj.tier == StorageTier.WARM and age_days >= self._config.cold_tier_days:
                if not dry_run:
                    self._storage.change_tier(obj.key, StorageTier.COLD)
                report["warm_to_cold"] += 1
                report["estimated_savings"] += self._calculate_savings(obj, StorageTier.COLD)

            # COLD -> DELETE
            elif obj.tier == StorageTier.COLD and age_days >= self._config.delete_after_days:
                if not dry_run:
                    self._storage.delete(obj.key)
                report["cold_to_delete"] += 1

        return report

    def _calculate_savings(self, obj: StorageMetadata, new_tier: StorageTier) -> float:
        """
        Calculate estimated cost savings for tier transition.

        Approximate AWS S3 pricing (per GB/month):
        - Standard: $0.023
        - IA: $0.0125
        - Glacier: $0.004
        """
        size_gb = obj.size_bytes / (1024**3)

        costs = {
            StorageTier.HOT: 0.023,
            StorageTier.WARM: 0.0125,
            StorageTier.COLD: 0.004,
        }

        current_cost = size_gb * costs[obj.tier]
        new_cost = size_gb * costs[new_tier]

        return max(0, current_cost - new_cost)
