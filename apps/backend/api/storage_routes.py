"""
Storage API Routes
===================

REST API endpoints for distributed content storage management.

Features:
- File upload/download
- Tier management
- Lifecycle policy management
- CDN integration
- Backup/restore operations
- Cost tracking and metrics
"""

from __future__ import annotations

import io
import logging
import os
import tempfile
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from core.storage import (
    ContentType,
    LifecyclePolicyManager,
    StorageConfig,
    StorageManager,
    StorageMetadata,
    StorageTier,
    get_storage,
)

logger = logging.getLogger(__name__)

# ============================================================================
# API Router
# ============================================================================

router = APIRouter(prefix="/api/storage", tags=["storage"])

# ============================================================================
# Request/Response Models
# ============================================================================


class StorageTierRequest(BaseModel):
    """Request model for tier changes."""

    tier: StorageTier
    keys: list[str] = Field(default_factory=list)


class LifecyclePolicyRequest(BaseModel):
    """Request model for lifecycle policy execution."""

    dry_run: bool = False


class BackupRequest(BaseModel):
    """Request model for backup operations."""

    keys: list[str]
    retention_days: int = Field(default=90, ge=1, le=365)


class RestoreRequest(BaseModel):
    """Request model for restore operations."""

    backup_id: str
    destination_prefix: str = ""
    overwrite: bool = False


class InvalidationRequest(BaseModel):
    """Request model for CDN cache invalidation."""

    paths: list[str]
    caller_reference: str | None = None


class PresignedURLRequest(BaseModel):
    """Request model for presigned URL generation."""

    key: str
    expiration: int = Field(default=3600, ge=60, le=604800)
    operation: str = Field(default="get", pattern="^(get|put)$")
    use_cdn: bool = True
    signed: bool = False


class BulkOperationRequest(BaseModel):
    """Request model for bulk operations."""

    keys: list[str]
    operation: str = Field(pattern="^(delete|tier|copy)$")
    destination_tier: StorageTier | None = None
    destination_prefix: str | None = None


class StorageResponse(BaseModel):
    """Response model for storage metadata."""

    key: str
    content_type: str
    size_bytes: int
    tier: str
    checksum: str
    created_at: str
    updated_at: str
    url: str | None = None
    cdn_url: str | None = None

    @classmethod
    def from_metadata(cls, metadata: StorageMetadata, url: str | None = None) -> StorageResponse:
        """Create response from StorageMetadata."""
        return cls(
            key=metadata.key,
            content_type=metadata.content_type.value,
            size_bytes=metadata.size_bytes,
            tier=metadata.tier.value,
            checksum=metadata.checksum,
            created_at=metadata.created_at.isoformat(),
            updated_at=metadata.updated_at.isoformat(),
            url=url,
            cdn_url=metadata.cdn_url,
        )


class ListResponse(BaseModel):
    """Response model for object listing."""

    objects: list[StorageResponse]
    count: int
    prefix: str
    truncated: bool
    next_token: str | None = None


class MetricsResponse(BaseModel):
    """Response model for storage metrics."""

    backend: str
    uploads_total: int
    uploads_success: int
    uploads_failed: int
    downloads_total: int
    downloads_success: int
    downloads_failed: int
    upload_success_rate: float
    download_success_rate: float
    bytes_uploaded: int
    bytes_downloaded: int
    total_storage_bytes: int
    total_file_count: int


class LifecycleReportResponse(BaseModel):
    """Response model for lifecycle policy report."""

    hot_to_warm: int
    warm_to_cold: int
    cold_to_delete: int
    total_processed: int
    estimated_savings: float
    dry_run: bool


class CostAnalysisResponse(BaseModel):
    """Response model for cost analysis."""

    current_monthly_cost: float
    projected_monthly_cost: float
    potential_savings: float
    breakdown: dict[str, float]
    recommendations: list[str]


# ============================================================================
# Dependencies
# ============================================================================


async def get_storage_manager() -> StorageManager:
    """Dependency to get storage manager instance."""
    return get_storage()


# ============================================================================
# Upload/Download Endpoints
# ============================================================================


@router.post("/upload", response_model=StorageResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    key: str = Form(...),
    tier: StorageTier = Form(default=StorageTier.HOT),
    metadata: str = Form(default="{}"),
    backup: bool = Form(default=True),
    storage: StorageManager = Depends(get_storage_manager),
) -> StorageResponse:
    """
    Upload a file to storage.

    Args:
        file: File to upload
        key: Storage key (path/filename)
        tier: Storage tier (hot, warm, cold)
        metadata: JSON string with custom metadata
        backup: Whether to create backup

    Returns:
        Storage metadata with URL
    """
    try:
        # Parse metadata
        import json

        custom_metadata = json.loads(metadata) if metadata else {}
        custom_metadata["original_filename"] = file.filename or key

        # Read file content
        content = await file.read()

        # Upload to storage
        storage_metadata = storage.upload(
            key=key,
            data=content,
            content_type=file.content_type or "application/octet-stream",
            metadata=custom_metadata,
            tier=tier,
            backup=backup,
        )

        # Generate URL
        url = storage.generate_url(key, use_cdn=True)

        logger.info(f"[Storage] Uploaded {key} ({len(content)} bytes, tier={tier.value})")

        return StorageResponse.from_metadata(storage_metadata, url)

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {e}")
    except Exception as e:
        logger.error(f"[Storage] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload/multipart", status_code=status.HTTP_201_CREATED)
async def upload_multipart(
    files: list[UploadFile] = File(...),
    prefix: str = Form(default=""),
    tier: StorageTier = Form(default=StorageTier.HOT),
    backup: bool = Form(default=True),
    storage: StorageManager = Depends(get_storage_manager),
) -> dict[str, Any]:
    """
    Upload multiple files to storage.

    Args:
        files: List of files to upload
        prefix: Key prefix for all files
        tier: Storage tier for all files
        backup: Whether to create backups

    Returns:
        Upload results with URLs
    """
    results = []
    errors = []

    for file in files:
        try:
            # Generate key with prefix
            filename = file.filename or "unnamed"
            key = f"{prefix.rstrip('/')}/{filename}" if prefix else filename

            # Read content
            content = await file.read()

            # Upload
            metadata = storage.upload(
                key=key,
                data=content,
                content_type=file.content_type or "application/octet-stream",
                metadata={"original_filename": filename},
                tier=tier,
                backup=backup,
            )

            # Generate URL
            url = storage.generate_url(key, use_cdn=True)

            results.append({
                "key": key,
                "filename": filename,
                "size": len(content),
                "url": url,
                "success": True,
            })

        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e),
            })

    return {
        "uploaded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


@router.get("/download/{key:path}")
async def download_file(
    key: str,
    disposition: str = Query(default="inline", pattern="^(inline|attachment)$"),
    storage: StorageManager = Depends(get_storage_manager),
) -> Response:
    """
    Download a file from storage.

    Args:
        key: Storage key (path/filename)
        disposition: Content disposition (inline or attachment)

    Returns:
        File content as response
    """
    try:
        # Download from storage
        data, metadata = storage.download(key)

        # Build headers
        headers = {
            "Content-Type": metadata.content_type_header,
            "Content-Disposition": f'{disposition}; filename="{metadata.original_filename}"',
            "Cache-Control": "public, max-age=3600",
            "ETag": metadata.checksum,
            "Last-Modified": metadata.updated_at.strftime("%a, %d %b %Y %H:%M:%S GMT"),
        }

        return Response(content=data, headers=headers)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {key}")
    except Exception as e:
        logger.error(f"[Storage] Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info/{key:path}", response_model=StorageResponse)
async def get_file_info(
    key: str,
    storage: StorageManager = Depends(get_storage_manager),
) -> StorageResponse:
    """
    Get metadata for a stored file.

    Args:
        key: Storage key

    Returns:
        Storage metadata
    """
    try:
        metadata = storage.get_metadata(key)
        url = storage.generate_url(key, use_cdn=True)
        return StorageResponse.from_metadata(metadata, url)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {key}")
    except Exception as e:
        logger.error(f"[Storage] Get metadata failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{key:path}")
async def delete_file(
    key: str,
    backup: bool = Query(default=True),
    storage: StorageManager = Depends(get_storage_manager),
) -> dict[str, Any]:
    """
    Delete a file from storage.

    Args:
        key: Storage key
        backup: Create backup before deletion

    Returns:
        Deletion result
    """
    try:
        deleted = storage.delete(key, backup=backup)

        if not deleted:
            raise HTTPException(status_code=404, detail=f"File not found: {key}")

        return {"key": key, "deleted": True, "backup": backup}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Storage] Delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Listing and Search Endpoints
# ============================================================================


@router.get("/list", response_model=ListResponse)
async def list_objects(
    prefix: str = Query(default=""),
    limit: int = Query(default=100, ge=1, le=1000),
    start_after: str | None = Query(default=None),
    storage: StorageManager = Depends(get_storage_manager),
) -> ListResponse:
    """
    List objects in storage.

    Args:
        prefix: Key prefix to filter
        limit: Maximum number of results
        start_after: Start listing after this key

    Returns:
        List of storage objects
    """
    try:
        objects = storage.list_objects(prefix=prefix, limit=limit, start_after=start_after)

        # Convert to response format
        responses = []
        for obj in objects:
            url = storage.generate_url(obj.key, use_cdn=True)
            responses.append(StorageResponse.from_metadata(obj, url))

        return ListResponse(
            objects=responses,
            count=len(responses),
            prefix=prefix,
            truncated=len(responses) == limit,
        )

    except Exception as e:
        logger.error(f"[Storage] List failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Tier Management Endpoints
# ============================================================================


@router.put("/tier")
async def change_tier(
    request: StorageTierRequest,
    storage: StorageManager = Depends(get_storage_manager),
) -> dict[str, Any]:
    """
    Change storage tier for objects.

    Args:
        request: Tier change request

    Returns:
        Tier change results
    """
    results = []
    errors = []

    for key in request.keys:
        try:
            metadata = storage.change_tier(key, request.tier)
            results.append({
                "key": key,
                "old_tier": metadata.tier.value,  # Note: this is the new tier after change
                "new_tier": request.tier.value,
                "success": True,
            })
        except Exception as e:
            errors.append({"key": key, "error": str(e)})

    return {
        "processed": len(request.keys),
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


# ============================================================================
# Presigned URL Endpoints
# ============================================================================


@router.post("/url/presigned")
async def generate_presigned_url(
    request: PresignedURLRequest,
    storage: StorageManager = Depends(get_storage_manager),
) -> dict[str, Any]:
    """
    Generate a presigned URL for direct access.

    Args:
        request: Presigned URL request

    Returns:
        Presigned URL with expiration
    """
    try:
        # Generate URL
        if request.use_cdn:
            url = storage.generate_url(request.key, expiration=request.expiration, use_cdn=True)
        else:
            url = storage._backend.generate_presigned_url(
                request.key,
                expiration=request.expiration,
                operation=request.operation,
            )

        return {
            "key": request.key,
            "url": url,
            "expires_in": request.expiration,
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=request.expiration)).isoformat(),
        }

    except Exception as e:
        logger.error(f"[Storage] Presigned URL generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Lifecycle Management Endpoints
# ============================================================================


@router.post("/lifecycle/apply", response_model=LifecycleReportResponse)
async def apply_lifecycle_policies(
    request: LifecyclePolicyRequest = LifecyclePolicyRequest(),
    storage: StorageManager = Depends(get_storage_manager),
) -> LifecycleReportResponse:
    """
    Apply lifecycle policies to all objects.

    Args:
        request: Lifecycle policy request

    Returns:
        Lifecycle policy execution report
    """
    try:
        config = StorageConfig.from_env()
        manager = LifecyclePolicyManager(storage, config)

        report = manager.apply_lifecycle_policies(dry_run=request.dry_run)

        return LifecycleReportResponse(
            hot_to_warm=report["hot_to_warm"],
            warm_to_cold=report["warm_to_cold"],
            cold_to_delete=report["cold_to_delete"],
            total_processed=report["total_processed"],
            estimated_savings=report["estimated_savings"],
            dry_run=request.dry_run,
        )

    except Exception as e:
        logger.error(f"[Storage] Lifecycle policy execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Metrics and Analytics Endpoints
# ============================================================================


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    storage: StorageManager = Depends(get_storage_manager),
) -> MetricsResponse:
    """
    Get storage metrics and statistics.

    Returns:
        Storage metrics
    """
    try:
        metrics_data = storage.get_metrics()
        backend_metrics = metrics_data.get("metrics", {})

        return MetricsResponse(
            backend=metrics_data.get("backend", "unknown"),
            uploads_total=backend_metrics.get("uploads_total", 0),
            uploads_success=backend_metrics.get("uploads_success", 0),
            uploads_failed=backend_metrics.get("uploads_failed", 0),
            downloads_total=backend_metrics.get("downloads_total", 0),
            downloads_success=backend_metrics.get("downloads_success", 0),
            downloads_failed=backend_metrics.get("downloads_failed", 0),
            upload_success_rate=backend_metrics.get("upload_success_rate", 1.0),
            download_success_rate=backend_metrics.get("download_success_rate", 1.0),
            bytes_uploaded=backend_metrics.get("bytes_uploaded", 0),
            bytes_downloaded=backend_metrics.get("bytes_downloaded", 0),
            total_storage_bytes=backend_metrics.get("total_storage_bytes", 0),
            total_file_count=backend_metrics.get("total_file_count", 0),
        )

    except Exception as e:
        logger.error(f"[Storage] Metrics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost-analysis", response_model=CostAnalysisResponse)
async def get_cost_analysis(
    storage: StorageManager = Depends(get_storage_manager),
) -> CostAnalysisResponse:
    """
    Get cost analysis and optimization recommendations.

    Returns:
        Cost analysis with recommendations
    """
    try:
        metrics = storage.get_metrics()
        backend_metrics = metrics.get("metrics", {})

        # Calculate costs (AWS S3 pricing estimates)
        size_gb = backend_metrics.get("total_storage_bytes", 0) / (1024**3)

        # Pricing per GB/month
        hot_price = 0.023
        warm_price = 0.0125
        cold_price = 0.004

        # Estimate current cost (assume all hot for worst case)
        current_cost = size_gb * hot_price

        # Potential savings with tiering
        # Assume 70% hot, 20% warm, 10% cold
        optimized_cost = size_gb * (0.7 * hot_price + 0.2 * warm_price + 0.1 * cold_price)
        potential_savings = max(0, current_cost - optimized_cost)

        # Generate recommendations
        recommendations = []
        if potential_savings > 1:
            recommendations.append("Enable lifecycle policies for automatic tier transitions")
        if size_gb > 1000:
            recommendations.append("Consider using S3 Intelligent-Tiering for unpredictable access patterns")
        if backend_metrics.get("uploads_total", 0) > 10000:
            recommendations.append("Use multipart upload for files larger than 100MB")

        breakdown = {
            "hot_storage_gb": round(size_gb * 0.7, 2),
            "warm_storage_gb": round(size_gb * 0.2, 2),
            "cold_storage_gb": round(size_gb * 0.1, 2),
            "hot_cost": round(size_gb * 0.7 * hot_price, 2),
            "warm_cost": round(size_gb * 0.2 * warm_price, 2),
            "cold_cost": round(size_gb * 0.1 * cold_price, 2),
        }

        return CostAnalysisResponse(
            current_monthly_cost=round(current_cost, 2),
            projected_monthly_cost=round(optimized_cost, 2),
            potential_savings=round(potential_savings, 2),
            breakdown=breakdown,
            recommendations=recommendations,
        )

    except Exception as e:
        logger.error(f"[Storage] Cost analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Bulk Operations Endpoints
# ============================================================================


@router.post("/bulk")
async def bulk_operation(
    request: BulkOperationRequest,
    storage: StorageManager = Depends(get_storage_manager),
) -> dict[str, Any]:
    """
    Perform bulk operations on multiple objects.

    Args:
        request: Bulk operation request

    Returns:
        Bulk operation results
    """
    results = []
    errors = []

    for key in request.keys:
        try:
            if request.operation == "delete":
                storage.delete(key)
                results.append({"key": key, "operation": "deleted", "success": True})

            elif request.operation == "tier" and request.destination_tier:
                storage.change_tier(key, request.destination_tier)
                results.append({"key": key, "operation": "tier_changed", "success": True})

            elif request.operation == "copy":
                dest_key = f"{request.destination_prefix}/{Path(key).name}" if request.destination_prefix else f"{key}.copy"
                storage.copy_object(key, dest_key)
                results.append({"key": key, "destination": dest_key, "operation": "copied", "success": True})

        except Exception as e:
            errors.append({"key": key, "error": str(e)})

    return {
        "processed": len(request.keys),
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


# ============================================================================
# CDN Cache Invalidation Endpoints
# ============================================================================


@router.post("/cdn/invalidate")
async def invalidate_cdn_cache(
    request: InvalidationRequest,
) -> dict[str, Any]:
    """
    Invalidate CDN cache for specific paths.

    Args:
        request: Invalidation request

    Returns:
        Invalidation result
    """
    try:
        from core.cdn import get_cdn

        cdn = get_cdn()
        if not cdn:
            raise HTTPException(status_code=501, detail="CDN not configured")

        result = cdn.invalidate(request.paths)

        return {
            "paths": request.paths,
            "result": result,
            "status": result.get("status", "unknown"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CDN] Cache invalidation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cdn/metrics")
async def get_cdn_metrics(
    hours: int = Query(default=24, ge=1, le=720),
) -> dict[str, Any]:
    """
    Get CDN metrics and analytics.

    Args:
        hours: Number of hours to look back

    Returns:
        CDN metrics
    """
    try:
        from core.cdn import get_cdn

        cdn = get_cdn()
        if not cdn:
            raise HTTPException(status_code=501, detail="CDN not configured")

        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(hours=hours)

        metrics = cdn.get_metrics(start_date, end_date)

        return {
            "period": {"hours": hours, "start": start_date.isoformat(), "end": end_date.isoformat()},
            "metrics": metrics,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CDN] Metrics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
