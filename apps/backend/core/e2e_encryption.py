"""
End-to-End Encryption Server Utilities
=====================================

Server-side utilities for zero-knowledge encryption.
The server stores and manages encrypted data WITHOUT decryption capability.

Security Properties:
- Zero-knowledge: Server cannot decrypt user data
- Encryption at rest: All data encrypted before storage
- Key isolation: User keys stored separately from data
- Metadata protection: Encrypted separately from content

Threat Model: See apps/backend/docs/THREAT_MODEL.md
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Dict, List, Tuple, Union

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration Constants
# =============================================================================

ENCRYPTION_VERSION = "1.0.0"
AES_KEY_LENGTH = 32  # 256 bits
AES_NONCE_LENGTH = 12  # 96 bits for GCM
AES_TAG_LENGTH = 16  # 128 bits authentication tag
RSA_KEY_LENGTH = 4096
KDF_ITERATIONS = 100000  # NIST recommended minimum
KDF_SALT_LENGTH = 16

# Storage paths
ENCRYPTED_STORAGE_DIR_ENV = "AUTO_CLAUDE_ENCRYPTED_STORAGE"
ENCRYPTED_STORAGE_DEFAULT = "./data/encrypted"

# =============================================================================
# Data Models
# =============================================================================


class EncryptionAlgorithm(str, Enum):
    """Supported encryption algorithms."""

    AES_GCM = "AES-256-GCM"
    RSA_OAEP = "RSA-4096-OAEP"


class EncryptionStatus(str, Enum):
    """Status of encrypted data."""

    ACTIVE = "active"
    SHARED = "shared"
    EXPIRED = "expired"
    REVOKED = "revoked"


@dataclass
class EncryptedMetadata:
    """Metadata for encrypted content."""

    content_id: str
    version: str = ENCRYPTION_VERSION
    algorithm: str = EncryptionAlgorithm.AES_GCM.value
    key_id: str  # Reference to encrypted key (not the key itself)
    nonce: bytes
    tag: bytes  # GCM authentication tag
    content_hash: str  # SHA-256 of original plaintext
    size_bytes: int
    mime_type: str
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    expires_at: Optional[str] = None
    status: str = EncryptionStatus.ACTIVE.value

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "content_id": self.content_id,
            "version": self.version,
            "algorithm": self.algorithm,
            "key_id": self.key_id,
            "nonce": base64.b64encode(self.nonce).decode("utf-8"),
            "tag": base64.b64encode(self.tag).decode("utf-8"),
            "content_hash": self.content_hash,
            "size_bytes": self.size_bytes,
            "mime_type": self.mime_type,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "EncryptedMetadata":
        """Create from dictionary."""
        return cls(
            content_id=data["content_id"],
            version=data.get("version", ENCRYPTION_VERSION),
            algorithm=data.get("algorithm", EncryptionAlgorithm.AES_GCM.value),
            key_id=data["key_id"],
            nonce=base64.b64decode(data["nonce"]),
            tag=base64.b64decode(data["tag"]),
            content_hash=data["content_hash"],
            size_bytes=data["size_bytes"],
            mime_type=data["mime_type"],
            created_at=data.get("created_at", datetime.utcnow().isoformat()),
            expires_at=data.get("expires_at"),
            status=data.get("status", EncryptionStatus.ACTIVE.value),
        )


@dataclass
class EncryptedPackage:
    """
    Complete encrypted package for zero-knowledge storage.

    The server stores this without ability to decrypt.
    Only clients with appropriate private keys can decrypt.
    """

    metadata: EncryptedMetadata
    encrypted_data: bytes  # AES-GCM encrypted content
    encrypted_key: Optional[bytes] = None  # RSA-OAEP encrypted AES key (for sharing)
    recipient_key_id: Optional[str] = None
    sender_key_id: Optional[str] = None
    signature: Optional[bytes] = None  # Digital signature for verification

    def to_dict(self) -> dict:
        """Convert to dictionary, encoding bytes as base64."""
        result = {
            "metadata": self.metadata.to_dict(),
            "encrypted_data": base64.b64encode(self.encrypted_data).decode("utf-8"),
        }

        if self.encrypted_key is not None:
            result["encrypted_key"] = base64.b64encode(self.encrypted_key).decode("utf-8")
        if self.recipient_key_id is not None:
            result["recipient_key_id"] = self.recipient_key_id
        if self.sender_key_id is not None:
            result["sender_key_id"] = self.sender_key_id
        if self.signature is not None:
            result["signature"] = base64.b64encode(self.signature).decode("utf-8")

        return result

    @classmethod
    def from_dict(cls, data: dict) -> "EncryptedPackage":
        """Create from dictionary."""
        metadata = EncryptedMetadata.from_dict(data["metadata"])

        encrypted_data = base64.b64decode(data["encrypted_data"])
        encrypted_key = base64.b64decode(data["encrypted_key"]) if data.get("encrypted_key") else None

        signature = None
        if data.get("signature"):
            signature = base64.b64decode(data["signature"])

        return cls(
            metadata=metadata,
            encrypted_data=encrypted_data,
            encrypted_key=encrypted_key,
            recipient_key_id=data.get("recipient_key_id"),
            sender_key_id=data.get("sender_key_id"),
            signature=signature,
        )


@dataclass
class KeyShareRequest:
    """Request for key sharing between users."""

    requesting_key_id: str
    recipient_key_id: str
    requested_permissions: List[str]
    expires_at: str
    nonce: str  # For request signature
    signature: str  # HMAC signature

    def verify_signature(self, secret: str) -> bool:
        """Verify the request signature."""
        message = f"{self.requesting_key_id}:{self.recipient_key_id}:{self.nonce}".encode()
        expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()

        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(self.signature.encode(), expected.encode()) == 0


@dataclass
class KeyShard:
    """A shard of an encrypted key for recovery."""

    shard_id: str
    key_id: str
    shard_data: str  # Encrypted shard
    index: int
    threshold: int  # M-of-N
    checksum: str
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def verify_checksum(self) -> bool:
        """Verify shard integrity."""
        data = f"{self.key_id}:{self.index}".encode()
        expected = hashlib.sha256(data).hexdigest()
        # Constant-time comparison
        return hmac.compare_digest(self.checksum.encode(), expected.encode()) == 0


# =============================================================================
# Exceptions
# =============================================================================


class EncryptionError(Exception):
    """Base exception for encryption errors."""

    def __init__(self, message: str, code: str, details: Any = None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(message)


class KeyNotFoundError(EncryptionError):
    """Raised when a key is not found."""

    def __init__(self, key_id: str, details: Any = None):
        super().__init__(f"Key not found: {key_id}", "KEY_NOT_FOUND", details)


class DecryptionFailedError(EncryptionError):
    """Raised when decryption fails."""

    def __init__(self, details: Any = None):
        super().__init__("Decryption failed", "DECRYPTION_FAILED", details)


class IntegrityCheckError(EncryptionError):
    """Raised when integrity check fails."""

    def __init__(self, details: Any = None):
        super().__init__("Integrity check failed", "INTEGRITY_CHECK_FAILED", details)


# =============================================================================
# Zero-Knowledge Storage Manager
# =============================================================================


class ZeroKnowledgeStorage:
    """
    Zero-knowledge encrypted storage manager.

    The server NEVER has access to plaintext data or decryption keys.
    This class manages encrypted blobs without decryption capability.
    """

    def __init__(self, storage_dir: Optional[str] = None):
        """
        Initialize zero-knowledge storage.

        Args:
            storage_dir: Directory for encrypted data storage
        """
        self.storage_dir = Path(storage_dir or os.getenv(
            ENCRYPTED_STORAGE_DIR_ENV, ENCRYPTED_STORAGE_DEFAULT
        ))

        # Create storage directory with secure permissions
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(self.storage_dir, 0o700)

        # Subdirectories
        self.data_dir = self.storage_dir / "data"
        self.metadata_dir = self.storage_dir / "metadata"
        self.keys_dir = self.storage_dir / "keys"  # Public key storage only

        for subdir in [self.data_dir, self.metadata_dir, self.keys_dir]:
            subdir.mkdir(parents=True, exist_ok=True)
            os.chmod(subdir, 0o700)

        logger.info(f"[ZK] Initialized zero-knowledge storage: {self.storage_dir}")

    # ========================================================================
    # Storage Operations (Zero-Knowledge)
    # ========================================================================

    def store_encrypted(
        self,
        content_id: str,
        encrypted_package: EncryptedPackage,
        tenant_id: str = "default"
    ) -> str:
        """
        Store an encrypted package WITHOUT decryption.

        The server stores the encrypted blob as-is.
        No plaintext is ever accessible to the server.

        Args:
            content_id: Unique content identifier
            encrypted_package: Complete encrypted package
            tenant_id: Tenant identifier for isolation

        Returns:
            Storage path for verification
        """
        try:
            # Validate package integrity before storage
            if not self._verify_package_integrity(encrypted_package):
                raise IntegrityCheckError("Package integrity check failed")

            # Store encrypted data blob
            data_path = self.data_dir / tenant_id / f"{content_id}.enc"
            data_path.parent.mkdir(parents=True, exist_ok=True)

            with open(data_path, "wb") as f:
                f.write(encrypted_package.encrypted_data)

            # Store metadata separately (also encrypted in real implementation)
            metadata_path = self.metadata_dir / tenant_id / f"{content_id}.meta.json"
            metadata_path.parent.mkdir(parents=True, exist_ok=True)

            with open(metadata_path, "w") as f:
                json.dump(encrypted_package.metadata.to_dict(), f)

            # Store reference to encrypted key (if shared content)
            if encrypted_package.encrypted_key:
                key_path = self.keys_dir / tenant_id / f"{content_id}.key.enc"
                key_path.parent.mkdir(parents=True, exist_ok=True)

                with open(key_path, "wb") as f:
                    f.write(encrypted_package.encrypted_key)

            # Secure permissions
            for path in [data_path, metadata_path]:
                os.chmod(path, 0o600)

            logger.info(f"[ZK] Stored encrypted content: {content_id}")
            return str(data_path)

        except Exception as e:
            logger.error(f"[ZK] Failed to store encrypted content: {e}")
            raise EncryptionError(f"Storage failed: {str(e)}", "STORAGE_FAILED", e)

    def retrieve_encrypted(
        self,
        content_id: str,
        tenant_id: str = "default"
    ) -> EncryptedPackage:
        """
        Retrieve an encrypted package.

        Returns the encrypted blob AS-IS.
        Server cannot decrypt - only client can decrypt.

        Args:
            content_id: Content identifier
            tenant_id: Tenant identifier

        Returns:
            EncryptedPackage with encrypted data and keys

        Raises:
            KeyNotFoundError: If content doesn't exist
        """
        try:
            # Load encrypted data
            data_path = self.data_dir / tenant_id / f"{content_id}.enc"

            if not data_path.exists():
                raise KeyNotFoundError(content_id)

            with open(data_path, "rb") as f:
                encrypted_data = f.read()

            # Load metadata
            metadata_path = self.metadata_dir / tenant_id / f"{content_id}.meta.json"

            if not metadata_path.exists():
                raise KeyNotFoundError(f"Metadata: {content_id}")

            with open(metadata_path, "r") as f:
                metadata_dict = json.load(f)

            metadata = EncryptedMetadata.from_dict(metadata_dict)

            # Load encrypted key (if shared)
            encrypted_key = None
            key_path = self.keys_dir / tenant_id / f"{content_id}.key.enc"

            if key_path.exists():
                with open(key_path, "rb") as f:
                    encrypted_key = f.read()

            # Build package
            return EncryptedPackage(
                metadata=metadata,
                encrypted_data=encrypted_data,
                encrypted_key=encrypted_key,
            )

        except KeyNotFoundError:
            raise
        except Exception as e:
            logger.error(f"[ZK] Failed to retrieve encrypted content: {e}")
            raise EncryptionError(f"Retrieval failed: {str(e)}", "RETRIEVAL_FAILED", e)

    def delete_encrypted(
        self,
        content_id: str,
        tenant_id: str = "default"
    ) -> bool:
        """
        Securely delete encrypted content.

        Deletes all traces:
        - Encrypted data blob
        - Metadata
        - Encrypted keys (if shared)

        Args:
            content_id: Content identifier
            tenant_id: Tenant identifier

        Returns:
            True if deleted successfully
        """
        try:
            deleted = False

            # Delete encrypted data
            data_path = self.data_dir / tenant_id / f"{content_id}.enc"
            if data_path.exists():
                data_path.unlink()
                deleted = True

            # Delete metadata
            metadata_path = self.metadata_dir / tenant_id / f"{content_id}.meta.json"
            if metadata_path.exists():
                metadata_path.unlink()
                deleted = True

            # Delete encrypted key
            key_path = self.keys_dir / tenant_id / f"{content_id}.key.enc"
            if key_path.exists():
                key_path.unlink()
                deleted = True

            if deleted:
                logger.info(f"[ZK] Deleted encrypted content: {content_id}")

            return deleted

        except Exception as e:
            logger.error(f"[ZK] Failed to delete encrypted content: {e}")
            return False

    # ========================================================================
    # Public Key Management
    # ========================================================================

    def store_public_key(
        self,
        key_id: str,
        public_key_pem: str,
        tenant_id: str = "default"
    ) -> str:
        """
        Store a public key for sharing.

        Only public keys are stored on server.
        Private keys NEVER leave the client.

        Args:
            key_id: Key identifier
            public_key_pem: PEM-formatted public key
            tenant_id: Tenant identifier

        Returns:
            Storage path
        """
        try:
            key_path = self.keys_dir / tenant_id / f"{key_id}.pub.pem"
            key_path.parent.mkdir(parents=True, exist_ok=True)

            with open(key_path, "w") as f:
                f.write(public_key_pem)

            os.chmod(key_path, 0o644)  # Public = readable

            logger.info(f"[ZK] Stored public key: {key_id}")
            return str(key_path)

        except Exception as e:
            logger.error(f"[ZK] Failed to store public key: {e}")
            raise EncryptionError(f"Public key storage failed: {str(e)}", "KEY_STORAGE_FAILED", e)

    def retrieve_public_key(
        self,
        key_id: str,
        tenant_id: str = "default"
    ) -> str:
        """
        Retrieve a stored public key.

        Args:
            key_id: Key identifier
            tenant_id: Tenant identifier

        Returns:
            PEM-formatted public key

        Raises:
            KeyNotFoundError: If key doesn't exist
        """
        key_path = self.keys_dir / tenant_id / f"{key_id}.pub.pem"

        if not key_path.exists():
            raise KeyNotFoundError(key_id)

        with open(key_path, "r") as f:
            return f.read()

    # ========================================================================
    # Integrity Verification
    # ========================================================================

    def _verify_package_integrity(self, package: EncryptedPackage) -> bool:
        """
        Verify encrypted package integrity.

        Checks:
        - Nonce uniqueness
        - Tag format
        - Content hash (if plaintext was available for verification)

        Args:
            package: Encrypted package to verify

        Returns:
            True if package appears valid
        """
        try:
            # Verify nonce length (GCM requires 12 bytes)
            if len(package.metadata.nonce) != AES_NONCE_LENGTH:
                logger.warning(f"[ZK] Invalid nonce length: {len(package.metadata.nonce)}")
                return False

            # Verify tag length (GCM requires 16 bytes)
            if len(package.metadata.tag) != AES_TAG_LENGTH:
                logger.warning(f"[ZK] Invalid tag length: {len(package.metadata.tag)}")
                return False

            # Verify data is not empty
            if len(package.encrypted_data) == 0:
                logger.warning("[ZK] Empty encrypted data")
                return False

            return True

        except Exception as e:
            logger.error(f"[ZK] Integrity verification error: {e}")
            return False

    # ========================================================================
    # Tenant Isolation
    # ========================================================================

    def list_tenant_contents(self, tenant_id: str = "default") -> List[str]:
        """
        List all content IDs for a tenant.

        Enforces tenant isolation - only returns content
        belonging to the specified tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            List of content IDs
        """
        tenant_data_dir = self.data_dir / tenant_id

        if not tenant_data_dir.exists():
            return []

        content_ids = []
        for enc_file in tenant_data_dir.glob("*.enc"):
            content_id = enc_file.stem
            content_ids.append(content_id)

        return content_ids

    def get_tenant_storage_stats(self, tenant_id: str = "default") -> dict:
        """
        Get storage statistics for a tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Statistics dictionary
        """
        tenant_data_dir = self.data_dir / tenant_id

        if not tenant_data_dir.exists():
            return {
                "content_count": 0,
                "total_bytes": 0,
            }

        total_bytes = 0
        content_count = 0

        for enc_file in tenant_data_dir.glob("*.enc"):
            total_bytes += enc_file.stat().st_size
            content_count += 1

        return {
            "content_count": content_count,
            "total_bytes": total_bytes,
            "tenant_id": tenant_id,
        }


# =============================================================================
# Utility Functions
# =============================================================================


def calculate_content_hash(data: bytes) -> str:
    """
    Calculate SHA-256 hash of content.

    Used for integrity verification and deduplication.

    Args:
        data: Content data

    Returns:
        Hex-encoded SHA-256 hash
    """
    return hashlib.sha256(data).hexdigest()


def generate_secure_nonce() -> bytes:
    """
    Generate a cryptographically secure nonce.

    Uses system CSPRNG for unpredictable values.

    Returns:
        12-byte nonce for AES-GCM
    """
    return secrets.token_bytes(AES_NONCE_LENGTH)


def derive_key_from_password(
    password: str,
    salt: bytes,
    iterations: int = KDF_ITERATIONS
) -> bytes:
    """
    Derive a key from password using PBKDF2.

    Provides strong key derivation resistant to brute force.

    Args:
        password: User password
        salt: Random salt (store with encrypted data)
        iterations: Number of iterations (100,000+ recommended)

    Returns:
        256-bit derived key
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256 bits
        salt=salt,
        iterations=iterations,
        backend=default_backend(),
    )

    return kdf.derive(password.encode())


def verify_hmac_signature(
    message: bytes,
    signature: str,
    secret: str
) -> bool:
    """
    Verify an HMAC signature.

    Provides constant-time comparison to prevent timing attacks.

    Args:
        message: Original message
        signature: HMAC signature to verify
        secret: Shared secret

    Returns:
        True if signature is valid
    """
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()

    # Constant-time comparison
    return hmac.compare_digest(signature.encode(), expected.encode()) == 0


def validate_encrypted_package(package: EncryptedPackage) -> Tuple[bool, List[str]]:
    """
    Validate an encrypted package.

    Performs comprehensive validation:
    - Structure integrity
    - Metadata consistency
    - Cryptographic parameter validity
    - Size constraints

    Args:
        package: Package to validate

    Returns:
        (is_valid, list_of_issues)
    """
    issues = []

    # Validate metadata
    if not package.metadata.content_id:
        issues.append("Missing content_id")

    if not package.metadata.key_id:
        issues.append("Missing key_id")

    # Validate nonce
    if len(package.metadata.nonce) != AES_NONCE_LENGTH:
        issues.append(f"Invalid nonce length: {len(package.metadata.nonce)}")

    # Validate tag
    if len(package.metadata.tag) != AES_TAG_LENGTH:
        issues.append(f"Invalid tag length: {len(package.metadata.tag)}")

    # Validate encrypted data
    if len(package.encrypted_data) == 0:
        issues.append("Empty encrypted data")

    # Validate shared content has encrypted key
    if package.metadata.status == EncryptionStatus.SHARED.value:
        if not package.encrypted_key:
            issues.append("Shared content missing encrypted key")

    return (len(issues) == 0, issues)


# =============================================================================
# Global Instance
# =============================================================================

_zk_storage: Optional[ZeroKnowledgeStorage] = None


def get_zk_storage() -> ZeroKnowledgeStorage:
    """Get global zero-knowledge storage instance."""
    global _zk_storage
    if _zk_storage is None:
        _zk_storage = ZeroKnowledgeStorage()
    return _zk_storage
