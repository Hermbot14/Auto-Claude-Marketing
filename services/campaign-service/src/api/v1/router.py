"""
API Router v1 for Campaign Service

Defines all API endpoints for campaign management.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.campaign import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignListResponse,
    CampaignLaunchRequest,
    ABTestCreate,
    ABTestResponse,
)
from app.schemas.audience import AudienceSegmentCreate, AudienceSegmentResponse
from app.services.campaign_service import CampaignService
from app.services.ab_test_service import ABTestService
from app.services.audience_service import AudienceService

router = APIRouter()

# Campaign CRUD endpoints
@router.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_data: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignResponse:
    """
    Create a new campaign.

    Args:
        campaign_data: Campaign creation data
        db: Database session
        current_user: Authenticated user

    Returns:
        Created campaign details
    """
    service = CampaignService(db)
    campaign = await service.create_campaign(campaign_data, current_user["user_id"])
    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns", response_model=CampaignListResponse)
async def list_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignListResponse:
    """
    List campaigns with optional filtering.

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        status: Filter by campaign status
        db: Database session
        current_user: Authenticated user

    Returns:
        List of campaigns
    """
    service = CampaignService(db)
    campaigns, total = await service.list_campaigns(
        user_id=current_user["user_id"],
        skip=skip,
        limit=limit,
        status=status,
    )
    return CampaignListResponse(
        campaigns=[CampaignResponse.model_validate(c) for c in campaigns],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignResponse:
    """
    Get campaign details by ID.

    Args:
        campaign_id: Campaign UUID
        db: Database session
        current_user: Authenticated user

    Returns:
        Campaign details

    Raises:
        HTTPException: If campaign not found
    """
    service = CampaignService(db)
    campaign = await service.get_campaign(campaign_id, current_user["user_id"])
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return CampaignResponse.model_validate(campaign)


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: str,
    campaign_data: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignResponse:
    """
    Update an existing campaign.

    Args:
        campaign_id: Campaign UUID
        campaign_data: Updated campaign data
        db: Database session
        current_user: Authenticated user

    Returns:
        Updated campaign details

    Raises:
        HTTPException: If campaign not found
    """
    service = CampaignService(db)
    campaign = await service.update_campaign(
        campaign_id, campaign_data, current_user["user_id"]
    )
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return CampaignResponse.model_validate(campaign)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> None:
    """
    Delete a campaign.

    Args:
        campaign_id: Campaign UUID
        db: Database session
        current_user: Authenticated user

    Raises:
        HTTPException: If campaign not found
    """
    service = CampaignService(db)
    deleted = await service.delete_campaign(campaign_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )


# Campaign control endpoints
@router.post("/campaigns/{campaign_id}/launch", response_model=CampaignResponse)
async def launch_campaign(
    campaign_id: str,
    launch_data: CampaignLaunchRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignResponse:
    """
    Launch a campaign.

    Args:
        campaign_id: Campaign UUID
        launch_data: Optional launch parameters
        db: Database session
        current_user: Authenticated user

    Returns:
        Updated campaign details

    Raises:
        HTTPException: If campaign not found or cannot be launched
    """
    service = CampaignService(db)
    campaign = await service.launch_campaign(
        campaign_id, current_user["user_id"], launch_data
    )
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/pause", response_model=CampaignResponse)
async def pause_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignResponse:
    """Pause an active campaign."""
    service = CampaignService(db)
    campaign = await service.pause_campaign(campaign_id, current_user["user_id"])
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/resume", response_model=CampaignResponse)
async def resume_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> CampaignResponse:
    """Resume a paused campaign."""
    service = CampaignService(db)
    campaign = await service.resume_campaign(campaign_id, current_user["user_id"])
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns/{campaign_id}/metrics")
async def get_campaign_metrics(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get performance metrics for a campaign."""
    service = CampaignService(db)
    metrics = await service.get_campaign_metrics(campaign_id, current_user["user_id"])
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return metrics


# A/B Test endpoints
@router.post("/campaigns/{campaign_id}/ab-tests", response_model=ABTestResponse)
async def create_ab_test(
    campaign_id: str,
    test_data: ABTestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ABTestResponse:
    """Create an A/B test for a campaign."""
    service = ABTestService(db)
    ab_test = await service.create_ab_test(campaign_id, test_data, current_user["user_id"])
    return ABTestResponse.model_validate(ab_test)


@router.get("/campaigns/{campaign_id}/ab-tests", response_model=List[ABTestResponse])
async def list_ab_tests(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[ABTestResponse]:
    """List all A/B tests for a campaign."""
    service = ABTestService(db)
    tests = await service.list_ab_tests(campaign_id, current_user["user_id"])
    return [ABTestResponse.model_validate(t) for t in tests]


# Audience segment endpoints
@router.post("/audience-segments", response_model=AudienceSegmentResponse)
async def create_audience_segment(
    segment_data: AudienceSegmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> AudienceSegmentResponse:
    """Create a new audience segment."""
    service = AudienceService(db)
    segment = await service.create_segment(segment_data, current_user["user_id"])
    return AudienceSegmentResponse.model_validate(segment)


@router.get("/audience-segments", response_model=List[AudienceSegmentResponse])
async def list_audience_segments(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[AudienceSegmentResponse]:
    """List all audience segments for the user."""
    service = AudienceService(db)
    segments = await service.list_segments(current_user["user_id"])
    return [AudienceSegmentResponse.model_validate(s) for s in segments]
