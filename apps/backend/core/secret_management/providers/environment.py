"""
Environment Variable Provider for Secret Management.

This provider reads secrets from environment variables.
Primarily intended for development and CI/CD environments.

SECURITY WARNING: Environment variables are plaintext and visible to:
- Any process with access to the environment
- System monitoring tools (ps, top, etc.)
- Child processes
- Debug logs

This provider should ONLY be used in:
- Development environments
- CI/CD pipelines with isolated runners
- Testing environments
"""

import logging
import os
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


class EnvironmentSecretProvider(SecretProvider):
    """
    Secret provider using environment variables.

    Reads secrets from environment variables with a configurable prefix.
    Provides a simple way to inject secrets in development/CI environments.

    Configuration:
        prefix: Environment variable prefix (default: "SECRET_")
        case_sensitive: Case-sensitive variable names (default: False)
        strip_whitespace: Strip whitespace from values (default: True)
    """

    # Default environment variable prefix for secrets
    DEFAULT_PREFIX = "SECRET_"

    def __init__(self, config: ProviderConfig):
        """
        Initialize the environment provider.

        Args:
            config: Provider configuration
        """
        super().__init__(config)

        self.prefix = config.config.get(
            "prefix",
            self.DEFAULT_PREFIX
        )
        self.case_sensitive = config.config.get(
            "case_sensitive",
            False
        )
        self.strip_whitespace = config.config.get(
            "strip_whitespace",
            True
        )

        # Build case-insensitive lookup if needed
        self._env_vars: Dict[str, str] = {}
        self._build_env_cache()

        logger.debug(
            f"Environment provider initialized with prefix '{self.prefix}'"
        )

    def _build_env_cache(self) -> None:
        """Build cache of environment variables for lookup."""
        if not self.case_sensitive:
            # Build case-insensitive cache
            self._env_vars = {
                k.lower(): v
                for k, v in os.environ.items()
                if k.lower().startswith(self.prefix.lower())
            }
        else:
            self._env_vars = {
                k: v
                for k, v in os.environ.items()
                if k.startswith(self.prefix)
            }

    def _get_env_key(self, secret_id: str) -> str:
        """
        Get the environment variable key for a secret ID.

        Args:
            secret_id: Secret identifier

        Returns:
            Environment variable name
        """
        env_key = f"{self.prefix}{secret_id}"

        if not self.case_sensitive:
            return env_key.lower()
        return env_key

    def _normalize_secret_id(self, secret_id: str) -> str:
        """
        Normalize secret ID for environment lookup.

        Args:
            secret_id: Secret identifier

        Returns:
            Normalized secret ID
        """
        if not self.case_sensitive:
            return secret_id.lower()
        return secret_id

    def get_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Retrieve a secret from environment variables.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (ignored for environment provider)

        Returns:
            Secret value or None if not found

        Raises:
            ProviderError: If retrieval fails
        """
        normalized_id = self._normalize_secret_id(secret_id)
        env_key = self._get_env_key(normalized_id)

        value = self._env_vars.get(env_key)

        if value is None:
            # Try refresh cache in case env vars changed
            self._build_env_cache()
            value = self._env_vars.get(env_key)

        if value is None:
            return None

        if self.strip_whitespace:
            value = value.strip()

        logger.debug(f"Retrieved secret '{secret_id}' from environment")
        return value

    def store_secret(
        self,
        secret_id: str,
        secret_value: str,
        secret_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Store a secret in environment variables.

        WARNING: This sets the environment variable for the current process only.
        Child processes will inherit the variable, but it won't persist
        across process restarts or system reboots.

        Args:
            secret_id: Unique identifier for the secret
            secret_value: The secret value to store
            secret_type: Type of secret (ignored for environment)
            context: Additional context (ignored)

        Returns:
            True if stored successfully
        """
        normalized_id = self._normalize_secret_id(secret_id)
        env_key = self._get_env_key(normalized_id)

        # Set environment variable for current process
        os.environ[env_key] = secret_value

        # Update cache
        self._env_vars[env_key] = secret_value

        logger.debug(f"Stored secret '{secret_id}' in environment")
        return True

    def delete_secret(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Delete a secret from environment variables.

        WARNING: This only removes the variable from the current process.
        It doesn't modify parent process or system environment.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (ignored)

        Returns:
            True if deleted successfully
        """
        normalized_id = self._normalize_secret_id(secret_id)
        env_key = self._get_env_key(normalized_id)

        if env_key not in self._env_vars:
            raise SecretNotFoundError(
                f"Secret '{secret_id}' not found in environment",
                provider_type=ProviderType.ENVIRONMENT,
                secret_id=secret_id,
            )

        # Delete from current process
        del os.environ[env_key]

        # Update cache
        del self._env_vars[env_key]

        logger.debug(f"Deleted secret '{secret_id}' from environment")
        return True

    def list_secrets(
        self,
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        List all secret IDs in the environment.

        Args:
            context: Additional context (ignored)

        Returns:
            List of secret IDs
        """
        secret_ids = []
        prefix_len = len(self.prefix)

        for env_key in self._env_vars.keys():
            # Extract secret ID from environment variable name
            secret_id = env_key[prefix_len:] if env_key.startswith(self.prefix) else env_key
            secret_ids.append(secret_id)

        return sorted(secret_ids)

    def secret_exists(
        self,
        secret_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Check if a secret exists in the environment.

        Args:
            secret_id: Unique identifier for the secret
            context: Additional context (ignored)

        Returns:
            True if secret exists
        """
        normalized_id = self._normalize_secret_id(secret_id)
        env_key = self._get_env_key(normalized_id)
        return env_key in self._env_vars

    def initialize(self) -> None:
        """
        Initialize the environment provider.

        Refreshes environment cache and logs warnings about security.
        """
        self._build_env_cache()

        secret_count = len(self.list_secrets())

        logger.warning(
            f"EnvironmentSecretProvider initialized with {secret_count} secrets. "
            "WARNING: Environment variables are plaintext and visible to "
            "system monitoring tools. Use only in development/CI environments."
        )

    def health_check(self) -> ProviderHealth:
        """
        Check the health of the environment provider.

        Environment provider is always healthy if process is running.

        Returns:
            ProviderHealth status
        """
        import time

        start_time = time.time()

        try:
            # Health check: verify we can read environment
            secret_count = len(self.list_secrets())
            elapsed = (time.time() - start_time) * 1000

            health = ProviderHealth(
                provider_type=ProviderType.ENVIRONMENT,
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
                provider_type=ProviderType.ENVIRONMENT,
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
        Get information about the environment provider.

        Returns:
            Dictionary with provider metadata
        """
        info = super().get_provider_info()
        info.update({
            "prefix": self.prefix,
            "case_sensitive": self.case_sensitive,
            "strip_whitespace": self.strip_whitespace,
            "secret_count": len(self.list_secrets()),
        })
        return info


# Import datetime for health check
from datetime import datetime
