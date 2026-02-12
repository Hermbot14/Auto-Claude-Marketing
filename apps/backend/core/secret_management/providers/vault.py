"""
Vault Provider for Secret Management.

This provider uses the existing secure vault system for encrypted storage.
Integrates with core.vault for AES-256-GCM encrypted credentials.

This is the RECOMMENDED provider for production use.
"""

import logging
from typing import Any, Dict, List, Optional

from .base import (
    SecretProvider,
    ProviderConfig,
    ProviderType,
    ProviderHealth,
    ProviderError,
    SecretNotFoundError,
)

logger = logging.getLogger(__name__)


class VaultSecretProvider(SecretProvider):
    """
    Secret provider using the encrypted vault system.

    Leverages the existing core.vault implementation for:
    - AES-256-GCM encryption at rest
    - OS keychain integration for master keys
    - Per-tenant isolation
    - Automatic credential rotation
    - Comprehensive audit logging

    Configuration:
        tenant_id: Tenant ID for isolation (default: "default")
        rotation_enabled: Enable automatic rotation (default: False)
        rotation_interval_days: Rotation interval in days (default: 90)
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize the vault provider.

        Args:
            config: Provider configuration
        """
        super().__init__(config)

        self.tenant_id = config.config.get("tenant_id", "default")
        self._vault = None

    def _get_vault(self):
        """
        Get or initialize vault instance.

        Returns:
            VaultManager instance

        Raises:
            ProviderError: If vault is not available
        """
        if self._vault is None:
            try:
                from core.vault import get_vault

                self._vault = get_vault()
                logger.debug(f"Vault provider initialized for tenant '{self.tenant_id}'")

            except ImportError as e:
                raise ProviderError(
                    "Vault module not available. Ensure core.vault is installed.",
                    provider_type=ProviderType.VAULT,
                    original_error=e,
                )
            except Exception as e:
                raise ProviderError(
                    f"Failed to initialize vault: {str(e)}",
                    provider_type=ProviderType.VAULT,
                    original_error=e,
                )

        return self._vault

    def get_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Retrieve a secret from the vault.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (may override tenant_id)

        Returns:
            Secret value or None if not found

        Raises:
            ProviderError: If retrieval fails
        """
        vault = self._get_vault()

        # Use context tenant if provided
        tenant_id = context.get("tenant_id", self.tenant_id) if context else self.tenant_id

        try:
            value, metadata = vault.retrieve_credential(
                credential_id=secret_id,
                tenant_id=tenant_id,
            )

            logger.debug(f"Retrieved secret '{secret_id}' from vault")
            return value

        except Exception as e:
            if "not found" in str(e).lower():
                return None

            raise ProviderError(
                f"Failed to retrieve secret: {str(e)}",
                provider_type=ProviderType.VAULT,
                secret_id=secret_id,
                original_error=e,
            )

    def store_secret(
        self,
        secret_id: str,
        secret_value: str,
        secret_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store a secret in the vault.

        Args:
            secret_id: Unique identifier for the secret
            secret_value: The secret value to store
            secret_type: Type of secret (api_key, token, etc.)
            context: Additional context (may override tenant_id)

        Returns:
            True if stored successfully

        Raises:
            ProviderError: If storage fails
        """
        vault = self._get_vault()

        # Use context tenant if provided
        tenant_id = context.get("tenant_id", self.tenant_id) if context else self.tenant_id

        # Get rotation interval from config or context
        rotation_interval = context.get(
            "rotation_interval_days",
            self.config.config.get("rotation_interval_days", 90)
        ) if context else self.config.config.get("rotation_interval_days", 90)

        try:
            vault.store_credential(
                credential_id=secret_id,
                credential_type=secret_type,
                credential_value=secret_value,
                tenant_id=tenant_id,
                rotation_interval_days=rotation_interval,
            )

            logger.debug(f"Stored secret '{secret_id}' in vault")
            return True

        except Exception as e:
            raise ProviderError(
                f"Failed to store secret: {str(e)}",
                provider_type=ProviderType.VAULT,
                secret_id=secret_id,
                original_error=e,
            )

    def delete_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Delete a secret from the vault.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (may override tenant_id)

        Returns:
            True if deleted successfully

        Raises:
            ProviderError: If deletion fails
        """
        vault = self._get_vault()

        # Use context tenant if provided
        tenant_id = context.get("tenant_id", self.tenant_id) if context else self.tenant_id

        try:
            vault.delete_credential(
                credential_id=secret_id,
                tenant_id=tenant_id,
            )

            logger.debug(f"Deleted secret '{secret_id}' from vault")
            return True

        except Exception as e:
            if "not found" in str(e).lower():
                raise SecretNotFoundError(
                    f"Secret '{secret_id}' not found in vault",
                    provider_type=ProviderType.VAULT,
                    secret_id=secret_id,
                    original_error=e,
                )

            raise ProviderError(
                f"Failed to delete secret: {str(e)}",
                provider_type=ProviderType.VAULT,
                secret_id=secret_id,
                original_error=e,
            )

    def list_secrets(
        self,
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        List all secret IDs in the vault.

        Args:
            context: Additional context (may override tenant_id)

        Returns:
            List of secret IDs

        Raises:
            ProviderError: If listing fails
        """
        vault = self._get_vault()

        # Use context tenant if provided
        tenant_id = context.get("tenant_id", self.tenant_id) if context else self.tenant_id

        try:
            credentials = vault.list_credentials(tenant_id=tenant_id)
            return [c.credential_id for c in credentials]

        except Exception as e:
            raise ProviderError(
                f"Failed to list secrets: {str(e)}",
                provider_type=ProviderType.VAULT,
                original_error=e,
            )

    def secret_exists(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Check if a secret exists in the vault.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (may override tenant_id)

        Returns:
            True if secret exists
        """
        secret_ids = self.list_secrets(context)
        return secret_id in secret_ids

    def rotate_secret(
        self,
        secret_id: str,
        new_value: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Rotate a secret with a new value.

        Overrides default to use vault's rotation tracking.

        Args:
            secret_id: Unique identifier for the secret
            new_value: New secret value
            context: Additional context

        Returns:
            True if rotated successfully
        """
        vault = self._get_vault()

        # Use context tenant if provided
        tenant_id = context.get("tenant_id", self.tenant_id) if context else self.tenant_id

        try:
            # Get current metadata to preserve it
            try:
                _, metadata = vault.retrieve_credential(
                    credential_id=secret_id,
                    tenant_id=tenant_id,
                )
                secret_type = metadata.credential_type
                rotation_interval = metadata.rotation_interval_days
            except:
                secret_type = "custom"
                rotation_interval = 90

            # Store new value (vault tracks rotation)
            vault.store_credential(
                credential_id=secret_id,
                credential_type=secret_type,
                credential_value=new_value,
                tenant_id=tenant_id,
                rotation_interval_days=rotation_interval,
            )

            # Mark as rotated
            vault.rotate_credential(
                credential_id=secret_id,
                tenant_id=tenant_id,
            )

            logger.debug(f"Rotated secret '{secret_id}' in vault")
            return True

        except Exception as e:
            raise ProviderError(
                f"Failed to rotate secret: {str(e)}",
                provider_type=ProviderType.VAULT,
                secret_id=secret_id,
                original_error=e,
            )

    def initialize(self) -> None:
        """
        Initialize the vault provider.

        Creates default tenant if it doesn't exist.
        """
        try:
            vault = self._get_vault()

            # Create tenant if it doesn't exist
            if self.tenant_id not in vault.list_tenants():
                vault.create_tenant(self.tenant_id)
                logger.info(f"Created vault tenant '{self.tenant_id}'")

            secret_count = len(self.list_secrets())
            logger.info(f"Vault provider initialized with {secret_count} secrets")

        except Exception as e:
            logger.error(f"Failed to initialize vault provider: {e}")
            raise

    def health_check(self) -> ProviderHealth:
        """
        Check the health of the vault provider.

        Returns:
            ProviderHealth status
        """
        import time
        from datetime import datetime

        start_time = time.time()

        try:
            vault = self._get_vault()

            # Health check: verify vault is accessible
            tenants = vault.list_tenants()
            elapsed = (time.time() - start_time) * 1000

            health = ProviderHealth(
                provider_type=ProviderType.VAULT,
                is_healthy=True,
                last_check=datetime.now(),
                response_time_ms=elapsed,
                consecutive_failures=0,
                last_success=datetime.now(),
            )

            self._health = health
            return health

        except Exception as e:
            elapsed = (time.time() - start_time) * 1000

            failures = (self._health.consecutive_failures + 1) if self._health else 1

            health = ProviderHealth(
                provider_type=ProviderType.VAULT,
                is_healthy=False,
                last_check=datetime.now(),
                response_time_ms=elapsed,
                error_message=str(e),
                consecutive_failures=failures,
                last_success=self._health.last_success if self._health else None,
            )

            self._health = health
            return health

    def get_provider_info(self) -> Dict[str, Any]:
        """
        Get information about the vault provider.

        Returns:
            Dictionary with provider metadata
        """
        info = super().get_provider_info()

        try:
            vault = self._get_vault()
            secret_count = len(self.list_secrets())

            info.update({
                "tenant_id": self.tenant_id,
                "secret_count": secret_count,
                "tenants": vault.list_tenants(),
            })
        except Exception as e:
            info["error"] = str(e)

        return info

    def get_audit_log(self, limit: int = 100) -> List[Any]:
        """
        Get recent audit log entries from vault.

        Args:
            limit: Maximum number of entries to return

        Returns:
            List of audit entries
        """
        vault = self._get_vault()
        return vault.get_audit_log(limit=limit)
