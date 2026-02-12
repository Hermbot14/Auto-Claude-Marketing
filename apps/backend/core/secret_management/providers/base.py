"""
Base Provider Interface for Secret Management System.

This module defines the abstract interface that all secret providers must implement.
Providers are responsible for the actual storage and retrieval of secrets.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ProviderType(str, Enum):
    """Types of secret providers."""

    ENVIRONMENT = "environment"
    VAULT = "vault"
    AWS_KMS = "aws_kms"
    AZURE_KEYVAULT = "azure_keyvault"
    GCP_KMS = "gcp_kms"


@dataclass
class ProviderConfig:
    """Configuration for a secret provider."""

    provider_type: ProviderType
    priority: int = 0  # Higher priority providers are checked first
    enabled: bool = True
    config: Dict[str, Any] = field(default_factory=dict)

    # Health check settings
    health_check_interval: int = 300  # seconds
    health_check_timeout: int = 30  # seconds

    # Performance settings
    cache_ttl: int = 300  # seconds, 0 to disable caching
    max_connections: int = 10

    # Security settings
    encryption_enabled: bool = True
    access_logging_enabled: bool = True


@dataclass
class ProviderHealth:
    """Health status of a provider."""

    provider_type: ProviderType
    is_healthy: bool
    last_check: datetime
    response_time_ms: float
    error_message: Optional[str] = None
    consecutive_failures: int = 0
    last_success: Optional[datetime] = None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "provider_type": self.provider_type.value,
            "is_healthy": self.is_healthy,
            "last_check": self.last_check.isoformat(),
            "response_time_ms": self.response_time_ms,
            "error_message": self.error_message,
            "consecutive_failures": self.consecutive_failures,
            "last_success": self.last_success.isoformat() if self.last_success else None,
        }


@dataclass
class SecretValue:
    """Wrapper for secret value with metadata."""

    value: str
    provider: ProviderType
    cached: bool = False
    cached_at: Optional[datetime] = None
    version: Optional[str] = None

    def __str__(self) -> str:
        """Return string representation (hides value for logging)."""
        return f"SecretValue(provider={self.provider.value}, cached={self.cached})"

    def __repr__(self) -> str:
        """Return detailed representation (hides value)."""
        return self.__str__()


class SecretProvider(ABC):
    """
    Abstract base class for secret providers.

    All providers must implement these methods for secret storage and retrieval.
    Providers are responsible for their own encryption and security measures.
    """

    def __init__(self, config: ProviderConfig):
        """
        Initialize the provider.

        Args:
            config: Provider configuration
        """
        self.config = config
        self._health: Optional[ProviderHealth] = None

    # ========================================================================
    # Required Methods
    # ========================================================================

    @abstractmethod
    def get_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Retrieve a secret from the provider.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context for retrieval (tenant, user, etc.)

        Returns:
            Secret value or None if not found

        Raises:
            ProviderError: If retrieval fails
        """
        pass

    @abstractmethod
    def store_secret(
        self,
        secret_id: str,
        secret_value: str,
        secret_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store a secret in the provider.

        Args:
            secret_id: Unique identifier for the secret
            secret_value: The secret value to store
            secret_type: Type of secret (api_key, token, etc.)
            context: Additional context (tenant, user, etc.)

        Returns:
            True if stored successfully

        Raises:
            ProviderError: If storage fails
        """
        pass

    @abstractmethod
    def delete_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Delete a secret from the provider.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context for deletion

        Returns:
            True if deleted successfully

        Raises:
            ProviderError: If deletion fails
        """
        pass

    @abstractmethod
    def list_secrets(
        self,
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        List all secret IDs in the provider.

        Args:
            context: Additional context for listing

        Returns:
            List of secret IDs

        Raises:
            ProviderError: If listing fails
        """
        pass

    @abstractmethod
    def secret_exists(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Check if a secret exists in the provider.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context for checking

        Returns:
            True if secret exists
        """
        pass

    # ========================================================================
    # Optional Methods with Defaults
    # ========================================================================

    def initialize(self) -> None:
        """
        Initialize the provider.

        Called once when the provider is registered.
        Use this to set up connections, validate config, etc.
        """
        pass

    def shutdown(self) -> None:
        """
        Shutdown the provider gracefully.

        Called when the application is shutting down.
        Use this to close connections, cleanup resources, etc.
        """
        pass

    def health_check(self) -> ProviderHealth:
        """
        Check the health of the provider.

        Returns:
            ProviderHealth status

        Default implementation checks if provider can list secrets.
        """
        import time

        start_time = time.time()

        try:
            # Try to list secrets as a basic health check
            self.list_secrets()

            elapsed = (time.time() - start_time) * 1000  # Convert to ms

            health = ProviderHealth(
                provider_type=self.config.provider_type,
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
                provider_type=self.config.provider_type,
                is_healthy=False,
                last_check=datetime.now(),
                response_time_ms=elapsed,
                error_message=str(e),
                consecutive_failures=failures,
                last_success=self._health.last_success if self._health else None,
            )

            self._health = health
            return health

    def rotate_secret(
        self,
        secret_id: str,
        new_value: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Rotate a secret with a new value.

        Default implementation deletes and recreates the secret.
        Override for more sophisticated rotation behavior.

        Args:
            secret_id: Unique identifier for the secret
            new_value: New secret value
            context: Additional context for rotation

        Returns:
            True if rotated successfully
        """
        self.delete_secret(secret_id, context)
        return self.store_secret(secret_id, new_value, "rotated", context)

    def get_provider_info(self) -> Dict[str, Any]:
        """
        Get information about the provider.

        Returns:
            Dictionary with provider metadata
        """
        return {
            "type": self.config.provider_type.value,
            "priority": self.config.priority,
            "enabled": self.config.enabled,
            "config": {k: "***" for k in self.config.config.keys()},
        }


class ProviderError(Exception):
    """Base exception for provider errors."""

    def __init__(
        self,
        message: str,
        provider_type: ProviderType,
        secret_id: Optional[str] = None,
        original_error: Optional[Exception] = None
    ):
        self.message = message
        self.provider_type = provider_type
        self.secret_id = secret_id
        self.original_error = original_error
        super().__init__(self.message)


class SecretNotFoundError(ProviderError):
    """Raised when a secret is not found."""

    pass


class SecretAlreadyExistsError(ProviderError):
    """Raised when attempting to store a duplicate secret."""

    pass
