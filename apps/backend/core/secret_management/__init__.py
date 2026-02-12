"""
Secret Management Module for Auto Claude Marketing Hub.

This module provides enterprise-grade secret management with:
- AES-256-GCM encryption for all secrets at rest
- Multiple provider backends (Environment, Vault, KMS)
- Automated key rotation with configurable intervals
- Comprehensive audit logging for all access
- Migration utilities for legacy secrets

Security Architecture:
----------------------
1. Encryption Layer: AES-256-GCM with authenticated encryption
2. Provider Layer: Pluggable backends for different storage mechanisms
3. Rotation Layer: Automated rotation with health monitoring
4. Audit Layer: Comprehensive logging for compliance

Usage:
------
    from core.secret_management import get_secret_manager

    manager = get_secret_manager()

    # Store a secret
    manager.store_secret(
        secret_id="my_api_key",
        secret_value="sk-ant-...",
        secret_type="anthropic_api_key"
    )

    # Retrieve a secret
    value = manager.get_secret("my_api_key")

    # Check rotation health
    health = manager.check_rotation_health()
"""

from .SecretManager import (
    SecretManager,
    SecretMetadata,
    SecretType,
    SecretAccessAuditEntry,
    RotationConfig,
    get_secret_manager,
)

from .KeyRotation import (
    KeyRotationScheduler,
    RotationTask,
    RotationStatus,
)

from .providers import (
    SecretProvider,
    EnvironmentSecretProvider,
    VaultSecretProvider,
    KmsSecretProvider,
)

__all__ = [
    # SecretManager
    "SecretManager",
    "SecretMetadata",
    "SecretType",
    "SecretAccessAuditEntry",
    "RotationConfig",
    "get_secret_manager",
    # KeyRotation
    "KeyRotationScheduler",
    "RotationTask",
    "RotationStatus",
    # Providers
    "SecretProvider",
    "EnvironmentSecretProvider",
    "VaultSecretProvider",
    "KmsSecretProvider",
]

# Version information
__version__ = "1.0.0"
