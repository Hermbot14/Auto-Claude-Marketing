"""
Secret Provider System for Auto Claude Marketing Hub.

This module implements a pluggable provider architecture for secret storage.
Providers allow different backends for secret storage:
- EnvironmentSecretProvider: Development/CI environment variables
- VaultSecretProvider: Production encrypted vault storage
- KmsSecretProvider: Cloud KMS (AWS KMS, Azure Key Vault, GCP KMS)
"""

from .base import SecretProvider, ProviderConfig, ProviderHealth
from .environment import EnvironmentSecretProvider
from .vault import VaultSecretProvider

# KMS providers are optional and require cloud credentials
try:
    from .kms import KmsSecretProvider
    _kms_available = True
except ImportError:
    _kms_available = False

__all__ = [
    "SecretProvider",
    "ProviderConfig",
    "ProviderHealth",
    "EnvironmentSecretProvider",
    "VaultSecretProvider",
]

if _kms_available:
    __all__.append("KmsSecretProvider")
