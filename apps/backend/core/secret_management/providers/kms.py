"""
KMS Provider for Secret Management (Optional).

This provider integrates with cloud Key Management Services:
- AWS KMS (Key Management Service)
- Azure Key Vault
- GCP KMS (Cloud Key Management)

REQUIRES: Cloud SDK dependencies and credentials

This is an OPTIONAL provider that requires additional dependencies:
- AWS: boto3
- Azure: azure-keyvault-secrets, azure-identity
- GCP: google-cloud-kms
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


class KmsSecretProvider(SecretProvider):
    """
    KMS provider for cloud-based secret management.

    Supports AWS KMS, Azure Key Vault, and GCP KMS.
    Requires cloud SDK dependencies and proper credentials.

    Configuration:
        provider: "aws_kms", "azure_keyvault", or "gcp_kms"
        region: Cloud region (e.g., "us-east-1")
        key_id: KMS key identifier
        credentials_path: Path to credentials file (optional)
    """

    # Cloud provider types
    CLOUD_AWS = "aws_kms"
    CLOUD_AZURE = "azure_keyvault"
    CLOUD_GCP = "gcp_kms"

    def __init__(self, config: ProviderConfig):
        """
        Initialize the KMS provider.

        Args:
            config: Provider configuration

        Raises:
            ImportError: If cloud SDK is not installed
        """
        super().__init__(config)

        self.cloud_provider = config.config.get("provider", self.CLOUD_AWS)
        self.region = config.config.get("region", "us-east-1")
        self.key_id = config.config.get("key_id")
        self._client = None

        # Initialize appropriate cloud client
        if self.cloud_provider == self.CLOUD_AWS:
            self._init_aws_client()
        elif self.cloud_provider == self.CLOUD_AZURE:
            self._init_azure_client()
        elif self.cloud_provider == self.CLOUD_GCP:
            self._init_gcp_client()
        else:
            raise ValueError(f"Unsupported KMS provider: {self.cloud_provider}")

    def _init_aws_client(self):
        """Initialize AWS KMS client."""
        try:
            import boto3

            session_kwargs = {"region_name": self.region}

            # Support credential file
            credentials_path = self.config.config.get("credentials_path")
            if credentials_path:
                session_kwargs["profile_name"] = credentials_path

            self._client = boto3.session.Session(**session_kwargs).client("kms")
            logger.info(f"AWS KMS client initialized for region {self.region}")

        except ImportError:
            raise ImportError(
                "AWS KMS provider requires boto3. Install with: pip install boto3"
            )
        except Exception as e:
            raise ProviderError(
                f"Failed to initialize AWS KMS client: {str(e)}",
                provider_type=ProviderType.AWS_KMS,
                original_error=e,
            )

    def _init_azure_client(self):
        """Initialize Azure Key Vault client."""
        try:
            from azure.identity import DefaultAzureCredential
            from azure.keyvault.secrets import SecretClient

            vault_url = self.config.config.get(
                "vault_url",
                f"https://{self.key_id}.vault.azure.net",
            )

            self._client = SecretClient(
                vault_url=vault_url,
                credential=DefaultAzureCredential(),
            )

            logger.info(f"Azure Key Vault client initialized for {vault_url}")

        except ImportError:
            raise ImportError(
                "Azure Key Vault provider requires azure-keyvault-secrets and azure-identity. "
                "Install with: pip install azure-keyvault-secrets azure-identity"
            )
        except Exception as e:
            raise ProviderError(
                f"Failed to initialize Azure Key Vault client: {str(e)}",
                provider_type=ProviderType.AZURE_KEYVAULT,
                original_error=e,
            )

    def _init_gcp_client(self):
        """Initialize GCP KMS client."""
        try:
            from google.cloud import kms_v1

            self._client = kms_v1.KeyManagementServiceClient()
            logger.info("GCP KMS client initialized")

        except ImportError:
            raise ImportError(
                "GCP KMS provider requires google-cloud-kms. "
                "Install with: pip install google-cloud-kms"
            )
        except Exception as e:
            raise ProviderError(
                f"Failed to initialize GCP KMS client: {str(e)}",
                provider_type=ProviderType.GCP_KMS,
                original_error=e,
            )

    # ========================================================================
    # Provider Implementation
    # ========================================================================

    def get_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Retrieve a secret from KMS.

        For AWS KMS, this decrypts a ciphertext.
        For Azure/GCP, this retrieves a secret from the vault.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (encryption context for AWS)

        Returns:
            Decrypted secret value or None if not found

        Raises:
            ProviderError: If retrieval fails
        """
        try:
            if self.cloud_provider == self.CLOUD_AWS:
                return self._get_aws_secret(secret_id, context)
            elif self.cloud_provider == self.CLOUD_AZURE:
                return self._get_azure_secret(secret_id)
            elif self.cloud_provider == self.CLOUD_GCP:
                return self._get_gcp_secret(secret_id)

        except Exception as e:
            if "not found" in str(e).lower():
                return None

            raise ProviderError(
                f"Failed to retrieve secret: {str(e)}",
                provider_type=ProviderType.AWS_KMS,  # Type will be overridden
                secret_id=secret_id,
                original_error=e,
            )

    def _get_aws_secret(self, secret_id: str, context: Optional[Dict[str, Any]]) -> Optional[str]:
        """Get secret from AWS KMS."""
        import base64

        # For AWS KMS, secret_id should be base64-encoded ciphertext
        try:
            ciphertext = base64.b64decode(secret_id)

            kwargs = {"CiphertextBlob": ciphertext}

            # Add encryption context if provided
            if context:
                kwargs["EncryptionContext"] = context

            response = self._client.decrypt(**kwargs)

            return response["Plaintext"].decode("utf-8")

        except Exception as e:
            logger.debug(f"AWS KMS decryption failed: {e}")
            raise

    def _get_azure_secret(self, secret_id: str) -> Optional[str]:
        """Get secret from Azure Key Vault."""
        try:
            secret = self._client.get_secret(secret_id)
            return secret.value
        except Exception as e:
            logger.debug(f"Azure Key Vault get failed: {e}")
            raise

    def _get_gcp_secret(self, secret_id: str) -> Optional[str]:
        """Get secret from GCP KMS."""
        try:
            # GCP KMS uses resource names
            key_name = self.config.config.get("key_name", self.key_id)
            resource_name = f"projects/{self.config.config.get('project')}/locations/{self.region}/keyRings/{self.config.config.get('key_ring')}/cryptoKeys/{key_name}"

            # For GCP, we'd need ciphertext to decrypt
            # This is a simplified example
            raise NotImplementedError("GCP KMS decrypt not fully implemented")

        except Exception as e:
            logger.debug(f"GCP KMS get failed: {e}")
            raise

    def store_secret(
        self,
        secret_id: str,
        secret_value: str,
        secret_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store/encrypt a secret in KMS.

        For AWS KMS, this encrypts plaintext and returns ciphertext.
        For Azure/GCP, this stores in the vault.

        Args:
            secret_id: Unique identifier for the secret
            secret_value: The secret value to store
            secret_type: Type of secret (ignored for KMS encryption)
            context: Additional context (encryption context for AWS)

        Returns:
            True if stored successfully

        Raises:
            ProviderError: If storage fails
        """
        try:
            if self.cloud_provider == self.CLOUD_AWS:
                return self._store_aws_secret(secret_id, secret_value, context)
            elif self.cloud_provider == self.CLOUD_AZURE:
                return self._store_azure_secret(secret_id, secret_value)
            elif self.cloud_provider == self.CLOUD_GCP:
                return self._store_gcp_secret(secret_id, secret_value)

        except Exception as e:
            raise ProviderError(
                f"Failed to store secret: {str(e)}",
                provider_type=ProviderType.AWS_KMS,  # Type will be overridden
                secret_id=secret_id,
                original_error=e,
            )

    def _store_aws_secret(self, secret_id: str, secret_value: str, context: Optional[Dict[str, Any]]) -> bool:
        """Encrypt secret with AWS KMS."""
        import base64

        kwargs = {
            "KeyId": self.key_id,
            "Plaintext": secret_value.encode("utf-8"),
        }

        if context:
            kwargs["EncryptionContext"] = context

        response = self._client.encrypt(**kwargs)

        # For KMS, the "stored" secret is the ciphertext
        # Caller would need to save this somewhere
        logger.debug(f"AWS KMS encrypted '{secret_id}'")

        # Return base64-encoded ciphertext
        ciphertext_b64 = base64.b64encode(response["CiphertextBlob"]).decode("utf-8")

        # Note: In a real implementation, you'd store this ciphertext
        # For now, just log it
        logger.info(f"AWS KMS ciphertext: {ciphertext_b64[:20]}...")

        return True

    def _store_azure_secret(self, secret_id: str, secret_value: str) -> bool:
        """Store secret in Azure Key Vault."""
        self._client.set_secret(secret_id, secret_value)
        logger.debug(f"Stored '{secret_id}' in Azure Key Vault")
        return True

    def _store_gcp_secret(self, secret_id: str, secret_value: str) -> bool:
        """Store secret in GCP KMS."""
        raise NotImplementedError("GCP KMS store not fully implemented")

    def delete_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Delete a secret from KMS vault."""
        try:
            if self.cloud_provider == self.CLOUD_AWS:
                # AWS KMS doesn't store, just log
                logger.info(f"AWS KMS: delete called for '{secret_id}' (no-op)")
                return True
            elif self.cloud_provider == self.CLOUD_AZURE:
                self._client.begin_delete_secret(secret_id).wait()
                logger.debug(f"Deleted '{secret_id}' from Azure Key Vault")
                return True
            elif self.cloud_provider == self.CLOUD_GCP:
                raise NotImplementedError("GCP KMS delete not fully implemented")

        except Exception as e:
            raise ProviderError(
                f"Failed to delete secret: {str(e)}",
                provider_type=ProviderType.AWS_KMS,  # Type will be overridden
                secret_id=secret_id,
                original_error=e,
            )

    def list_secrets(
        self,
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """List secrets in KMS vault."""
        try:
            if self.cloud_provider == self.CLOUD_AWS:
                # AWS KMS doesn't list secrets
                return []
            elif self.cloud_provider == self.CLOUD_AZURE:
                secrets = self._client.list_properties_of_secrets()
                return [s.name for s in secrets]
            elif self.cloud_provider == self.CLOUD_GCP:
                raise NotImplementedError("GCP KMS list not fully implemented")

        except Exception as e:
            raise ProviderError(
                f"Failed to list secrets: {str(e)}",
                provider_type=ProviderType.AWS_KMS,  # Type will be overridden
                original_error=e,
            )

    def secret_exists(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if a secret exists in KMS."""
        try:
            if self.cloud_provider == self.CLOUD_AWS:
                # For AWS KMS, we'd need to try decrypt
                return self._get_aws_secret(secret_id, context) is not None
            elif self.cloud_provider == self.CLOUD_AZURE:
                secret = self._client.get_secret(secret_id)
                return secret is not None
            elif self.cloud_provider == self.CLOUD_GCP:
                raise NotImplementedError("GCP KMS exists not fully implemented")

        except Exception:
            return False

    def health_check(self) -> ProviderHealth:
        """Check health of KMS provider."""
        import time
        from datetime import datetime

        start_time = time.time()

        try:
            # Health check: try to list or verify connection
            self.list_secrets()

            elapsed = (time.time() - start_time) * 1000

            provider_type = ProviderType.AWS_KMS  # Default
            if self.cloud_provider == self.CLOUD_AZURE:
                provider_type = ProviderType.AZURE_KEYVAULT
            elif self.cloud_provider == self.CLOUD_GCP:
                provider_type = ProviderType.GCP_KMS

            health = ProviderHealth(
                provider_type=provider_type,
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

            provider_type = ProviderType.AWS_KMS  # Default
            if self.cloud_provider == self.CLOUD_AZURE:
                provider_type = ProviderType.AZURE_KEYVAULT
            elif self.cloud_provider == self.CLOUD_GCP:
                provider_type = ProviderType.GCP_KMS

            health = ProviderHealth(
                provider_type=provider_type,
                is_healthy=False,
                last_check=datetime.now(),
                response_time_ms=elapsed,
                error_message=str(e),
                consecutive_failures=failures,
                last_success=self._health.last_success if self._health else None,
            )

            self._health = health
            return health

    def initialize(self) -> None:
        """Initialize the KMS provider."""
        logger.info(
            f"KMS provider initialized: {self.cloud_provider} in region {self.region}"
        )

    def shutdown(self) -> None:
        """Shutdown the KMS provider."""
        self._client = None
        logger.info("KMS provider shut down")

    def get_provider_info(self) -> Dict[str, Any]:
        """Get information about the KMS provider."""
        info = super().get_provider_info()
        info.update({
            "cloud_provider": self.cloud_provider,
            "region": self.region,
            "key_id": self.key_id,
        })
        return info
