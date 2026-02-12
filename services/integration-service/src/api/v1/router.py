"""
API Router v1 for Integration Service

Defines all API endpoints for third-party integrations.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationListResponse,
    IntegrationUpdate,
    SyncRequest,
    SyncResponse,
    WebhookCreate,
    WebhookResponse,
)
from app.services.integration_service import IntegrationService
from app.services.github_service import GitHubService
from app.services.slack_service import SlackService
from app.services.discord_service import DiscordService
from app.services.hubspot_service import HubSpotService
from app.services.mailchimp_service import MailchimpService
from app.services.analytics_service import AnalyticsIntegrationService

router = APIRouter()

# Integration endpoints
@router.post("/integrations/connect", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def connect_integration(
    integration_data: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> IntegrationResponse:
    """
    Connect a new third-party integration.

    This initiates the OAuth flow for the specified integration type.

    Args:
        integration_data: Integration connection details
        db: Database session
        current_user: Authenticated user

    Returns:
        Integration details with OAuth URL if applicable
    """
    service = IntegrationService(db)
    integration = await service.connect_integration(integration_data, current_user["user_id"])
    return IntegrationResponse.model_validate(integration)


@router.get("/integrations", response_model=IntegrationListResponse)
async def list_integrations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    integration_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> IntegrationListResponse:
    """
    List all integrations for the user.

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        integration_type: Filter by integration type
        db: Database session
        current_user: Authenticated user

    Returns:
        List of integrations
    """
    service = IntegrationService(db)
    integrations, total = await service.list_integrations(
        user_id=current_user["user_id"],
        skip=skip,
        limit=limit,
        integration_type=integration_type,
    )
    return IntegrationListResponse(
        integrations=[IntegrationResponse.model_validate(i) for i in integrations],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/integrations/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> IntegrationResponse:
    """
    Get a specific integration by ID.

    Args:
        integration_id: Integration UUID
        db: Database session
        current_user: Authenticated user

    Returns:
        Integration details

    Raises:
        HTTPException: If integration not found
    """
    service = IntegrationService(db)
    integration = await service.get_integration(integration_id, current_user["user_id"])
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )
    return IntegrationResponse.model_validate(integration)


@router.put("/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    integration_data: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> IntegrationResponse:
    """
    Update an existing integration.

    Args:
        integration_id: Integration UUID
        integration_data: Updated integration data
        db: Database session
        current_user: Authenticated user

    Returns:
        Updated integration details
    """
    service = IntegrationService(db)
    integration = await service.update_integration(
        integration_id, integration_data, current_user["user_id"]
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )
    return IntegrationResponse.model_validate(integration)


@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> None:
    """
    Disconnect and remove an integration.

    Args:
        integration_id: Integration UUID
        db: Database session
        current_user: Authenticated user

    Raises:
        HTTPException: If integration not found
    """
    service = IntegrationService(db)
    deleted = await service.disconnect_integration(integration_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )


@router.post("/integrations/{integration_id}/sync", response_model=SyncResponse)
async def sync_integration(
    integration_id: str,
    sync_request: SyncRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> SyncResponse:
    """
    Trigger a sync for an integration.

    Args:
        integration_id: Integration UUID
        sync_request: Optional sync parameters
        db: Database session
        current_user: Authenticated user

    Returns:
        Sync job details
    """
    service = IntegrationService(db)
    sync_result = await service.trigger_sync(integration_id, current_user["user_id"], sync_request)
    return SyncResponse.model_validate(sync_result)


@router.get("/integrations/{integration_id}/status")
async def get_integration_status(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get the current status of an integration.

    Returns health, last sync time, rate limit info, etc.

    Args:
        integration_id: Integration UUID
        db: Database session
        current_user: Authenticated user

    Returns:
        Integration status details
    """
    service = IntegrationService(db)
    status_info = await service.get_integration_status(integration_id, current_user["user_id"])
    if not status_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )
    return status_info


# Webhook management endpoints
@router.post("/webhooks", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    webhook_data: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> WebhookResponse:
    """
    Create a webhook configuration.

    Args:
        webhook_data: Webhook configuration
        db: Database session
        current_user: Authenticated user

    Returns:
        Created webhook details
    """
    service = IntegrationService(db)
    webhook = await service.create_webhook(webhook_data, current_user["user_id"])
    return WebhookResponse.model_validate(webhook)


@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    integration_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[WebhookResponse]:
    """
    List webhook configurations.

    Args:
        integration_id: Optional integration filter
        db: Database session
        current_user: Authenticated user

    Returns:
        List of webhooks
    """
    service = IntegrationService(db)
    webhooks = await service.list_webhooks(current_user["user_id"], integration_id)
    return [WebhookResponse.model_validate(w) for w in webhooks]


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> None:
    """
    Delete a webhook configuration.

    Args:
        webhook_id: Webhook UUID
        db: Database session
        current_user: Authenticated user

    Raises:
        HTTPException: If webhook not found
    """
    service = IntegrationService(db)
    deleted = await service.delete_webhook(webhook_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )


# Integration-specific endpoints
@router.get("/integrations/github/repositories")
async def list_github_repositories(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List GitHub repositories for an integration."""
    service = GitHubService(db)
    repos = await service.list_repositories(integration_id, current_user["user_id"])
    return {"repositories": repos}


@router.get("/integrations/slack/channels")
async def list_slack_channels(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List Slack channels for an integration."""
    service = SlackService(db)
    channels = await service.list_channels(integration_id, current_user["user_id"])
    return {"channels": channels}


@router.get("/integrations/discord/servers")
async def list_discord_servers(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List Discord servers for an integration."""
    service = DiscordService(db)
    servers = await service.list_servers(integration_id, current_user["user_id"])
    return {"servers": servers}
