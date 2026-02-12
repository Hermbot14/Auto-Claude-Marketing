"""
Encrypted Data Models for Zero-Knowledge Storage
=================================================

SQLAlchemy models for storing encrypted user data.
The server stores encrypted blobs WITHOUT decryption capability.

Security Properties:
- Zero-knowledge: Server cannot decrypt stored data
- Tenant isolation: Per-tenant encrypted data separation
- Metadata encryption: Sensitive metadata encrypted separately
- Audit logging: All access logged for compliance

Threat Model: See apps/backend/docs/THREAT_MODEL.md
"""

from datetime import datetime, timedelta
from typing import Optional, List, TYPE_CHECKING
from enum import Enum
import uuid

try:
    from sqlalchemy import (
        Column, String, DateTime, Boolean, Integer, LargeBinary, Text,
        ForeignKey, Index, UniqueConstraint, JSON, BigInteger
    )
    from sqlalchemy.orm import (
        relationship, declarative_base, validates, Session
    )
    from sqlalchemy.sql import func
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    Column = None
    relationship = None

if TYPE_CHECKING and SQLALCHEMY_AVAILABLE:
    from sqlalchemy.orm import Mapped, mapped_column

if SQLALCHEMY_AVAILABLE:
    Base = declarative_base()
else:
    class Base:
        pass


# =============================================================================
# Enums
# =============================================================================


class EncryptionStatus(str, Enum):
    """Status of encrypted data."""

    ACTIVE = "active"
    SHARED = "shared"
    EXPIRED = "expired"
    REVOKED = "revoked"
    DELETED = "deleted"


class ShareScope(str, Enum):
    """Sharing scope for encrypted content."""

    PRIVATE = "private"  # Only owner
    SELECTED = "selected"  # Specific recipients
    TEAM = "team"  # All team members
    PUBLIC = "public"  # Anyone with link


class KeyRotationStatus(str, Enum):
    """Key rotation status."""

    CURRENT = "current"
    ROTATING = "rotating"
    ROTATED = "rotated"
    COMPROMISED = "compromised"


# =============================================================================
# Encrypted Content Model
# =============================================================================


if SQLALCHEMY_AVAILABLE:

    class EncryptedContent(Base):
        """
        Zero-knowledge encrypted content storage.

        Stores ONLY encrypted data. Server cannot decrypt.
        Decryption requires client-side private keys.
        """

        __tablename__ = "encrypted_content"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Tenant isolation (REQUIRED for zero-knowledge)
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        )

        # Content identification
        content_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
        version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0.0")

        # Encrypted data blob (server CANNOT decrypt this)
        encrypted_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)

        # Encryption metadata (required for decryption by client)
        algorithm: Mapped[str] = mapped_column(String(32), nullable=False, default="AES-256-GCM")
        key_id: Mapped[str] = mapped_column(String(64), nullable=False)  # Ref to encrypted key

        # Integrity verification
        nonce: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # GCM IV (12 bytes)
        tag: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # GCM auth tag (16 bytes)

        # Content metadata (NOT encrypted in this model, but can be)
        content_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
        mime_type: Mapped[str] = mapped_column(String(128), nullable=False, default="application/octet-stream")
        size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

        # Sharing metadata
        share_scope: Mapped[str] = mapped_column(
            String(32),
            nullable=False,
            default=ShareScope.PRIVATE.value
        )
        encrypted_key: Mapped[Optional[bytes]] = mapped_column(
            LargeBinary,
            nullable=True,
        )  # RSA-encrypted AES key for sharing

        # Access control
        owner_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )
        expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
        last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Key versioning for rotation support
        key_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])

        # Audit metadata
        access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
        checksum_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

        # Indexes and constraints
        __table_args__ = (
            Index("idx_enc_content_tenant", "tenant_id"),
            Index("idx_enc_content_owner", "owner_id"),
            Index("idx_enc_content_status", "share_scope", "key_version"),
            Index("idx_enc_content_expires", "expires_at"),
            UniqueConstraint("tenant_id", "content_id", name="uq_enc_content_tenant_id"),
        )

        @validates("share_scope")
        def validate_share_scope(self, key, value):
            if value not in [s.value for s in ShareScope]:
                raise ValueError(f"Invalid share_scope: {value}")
            return value

        @property
        def is_expired(self) -> bool:
            """Check if content has expired."""
            if self.expires_at is None:
                return False
            return datetime.utcnow() > self.expires_at

        @property
        def is_shared(self) -> bool:
            """Check if content is shared."""
            return self.share_scope != ShareScope.PRIVATE.value

        @property
        def needs_rotation(self) -> bool:
            """Check if key rotation is needed."""
            # Rotate if older than 90 days
            if self.created_at < datetime.utcnow() - timedelta(days=90):
                return True
            return False

        def to_dict(self) -> dict:
            """Convert to dictionary (never includes encrypted data)."""
            return {
                "id": self.id,
                "content_id": self.content_id,
                "tenant_id": self.tenant_id,
                "version": self.version,
                "algorithm": self.algorithm,
                "key_id": self.key_id,
                "content_hash": self.content_hash,
                "mime_type": self.mime_type,
                "size_bytes": self.size_bytes,
                "share_scope": self.share_scope,
                "owner_id": self.owner_id,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "expires_at": self.expires_at.isoformat() if self.expires_at else None,
                "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at else None,
                "key_version": self.key_version,
                "access_count": self.access_count,
                "checksum_verified": self.checksum_verified,
                "is_expired": self.is_expired,
                "is_shared": self.is_shared,
                "needs_rotation": self.needs_rotation,
            }

        def __repr__(self) -> str:
            return f"<EncryptedContent(id={self.id}, content_id={self.content_id})>"


    class EncryptedShare(Base):
        """
        Share grants for encrypted content.

        Manages who can access shared encrypted content.
        The encrypted_key is stored here for authorized recipients.
        """

        __tablename__ = "encrypted_shares"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign keys
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        )
        content_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("encrypted_content.id"),
            nullable=False,
            index=True,
        )

        # Recipient information
        recipient_key_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
        recipient_email: Mapped[Optional[str]] = mapped_column(String(255))
        recipient_display_name: Mapped[Optional[str]] = mapped_column(String(255))

        # Encrypted key for recipient (RSA-OAEP encrypted)
        encrypted_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)

        # Share metadata
        permissions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
        expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Status tracking
        access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
        last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
        revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )

        # Relationships
        content: Mapped["EncryptedContent"] = relationship(
            "EncryptedContent",
            foreign_keys=[content_id]
        )
        tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])

        # Indexes
        __table_args__ = (
            Index("idx_enc_share_recipient", "recipient_key_id"),
            Index("idx_enc_share_content", "content_id"),
            Index("idx_enc_share_expires", "expires_at"),
        )

        @property
        def is_active(self) -> bool:
            """Check if share is active."""
            if self.revoked_at:
                return False
            if self.expires_at and datetime.utcnow() > self.expires_at:
                return False
            return True

        @property
        def is_revoked(self) -> bool:
            """Check if share has been revoked."""
            return self.revoked_at is not None

        def to_dict(self) -> dict:
            """Convert to dictionary."""
            return {
                "id": self.id,
                "content_id": self.content_id,
                "tenant_id": self.tenant_id,
                "recipient_key_id": self.recipient_key_id,
                "recipient_email": self.recipient_email,
                "recipient_display_name": self.recipient_display_name,
                "permissions": self.permissions,
                "access_count": self.access_count,
                "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at else None,
                "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "is_active": self.is_active,
                "is_revoked": self.is_revoked,
            }

        def __repr__(self) -> str:
            return f"<EncryptedShare(id={self.id}, recipient={self.recipient_key_id})>"


    class PublicKeyRegistry(Base):
        """
        Registry of public keys for zero-knowledge encryption.

        Stores ONLY public keys. Private keys NEVER stored here.
        Used for sharing encrypted content between users.
        """

        __tablename__ = "public_key_registry"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign key
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        )

        # Key identification
        key_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
        owner_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
        owner_email: Mapped[Optional[str]] = mapped_column(String(255))
        owner_display_name: Mapped[Optional[str]] = mapped_column(String(255))

        # Public key data (PEM format)
        public_key_pem: Mapped[str] = mapped_column(Text, nullable=False)

        # Key metadata
        key_type: Mapped[str] = mapped_column(String(32), nullable=False, default="RSA-4096")
        algorithm: Mapped[str] = mapped_column(String(32), nullable=False, default="RSA-OAEP")
        key_bits: Mapped[int] = mapped_column(Integer, nullable=False, default=4096)

        # Key versioning for rotation
        key_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
        previous_key_id: Mapped[Optional[str]] = mapped_column(String(64))  # For key rotation chain

        # Status
        status: Mapped[str] = mapped_column(String(32), nullable=False, default=KeyRotationStatus.CURRENT.value)

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )
        expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
        revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])

        # Tracking
        last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
        usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

        # Indexes
        __table_args__ = (
            Index("idx_pk_registry_owner", "owner_id"),
            Index("idx_pk_registry_key", "key_id"),
            Index("idx_pk_registry_status", "status"),
        )

        @property
        def is_active(self) -> bool:
            """Check if key is active."""
            if self.revoked_at:
                return False
            if self.expires_at and datetime.utcnow() > self.expires_at:
                return False
            if self.status != KeyRotationStatus.CURRENT.value:
                return False
            return True

        @property
        def is_expired(self) -> bool:
            """Check if key has expired."""
            if self.expires_at is None:
                return False
            return datetime.utcnow() > self.expires_at

        def to_dict(self) -> dict:
            """Convert to dictionary."""
            return {
                "id": self.id,
                "key_id": self.key_id,
                "tenant_id": self.tenant_id,
                "owner_id": self.owner_id,
                "owner_email": self.owner_email,
                "owner_display_name": self.owner_display_name,
                "key_type": self.key_type,
                "algorithm": self.algorithm,
                "key_bits": self.key_bits,
                "key_version": self.key_version,
                "previous_key_id": self.previous_key_id,
                "status": self.status,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "expires_at": self.expires_at.isoformat() if self.expires_at else None,
                "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
                "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
                "usage_count": self.usage_count,
                "is_active": self.is_active,
                "is_expired": self.is_expired,
            }

        def __repr__(self) -> str:
            return f"<PublicKeyRegistry(id={self.id}, key_id={self.key_id})>"


    class KeyShard(Base):
        """
        Key shards for zero-knowledge recovery.

        Implements Shamir's Secret Sharing for key recovery.
        M shards required to reconstruct key (default: 3-of-5).
        """

        __tablename__ = "key_shards"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign keys
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        )
        key_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

        # Shard information
        shard_index: Mapped[int] = mapped_column(Integer, nullable=False)
        total_shards: Mapped[int] = mapped_column(Integer, nullable=False)  # N
        threshold: Mapped[int] = mapped_column(Integer, nullable=False)  # M

        # Encrypted shard data
        encrypted_shard: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)

        # Integrity verification
        checksum: Mapped[str] = mapped_column(String(64), nullable=False)

        # Storage location hint (for distributed storage)
        storage_hint: Mapped[Optional[str]] = mapped_column(String(255))

        # Status
        used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
        expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

        # Timestamps
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])

        # Indexes
        __table_args__ = (
            Index("idx_key_shard_key", "key_id"),
            Index("idx_key_shard_index", "key_id", "shard_index"),
        )

        @property
        def is_valid(self) -> bool:
            """Check if shard is valid (not expired or used)."""
            if self.used_at:
                return False
            if self.expires_at and datetime.utcnow() > self.expires_at:
                return False
            return True

        @property
        def is_expired(self) -> bool:
            """Check if shard has expired."""
            if self.expires_at is None:
                return False
            return datetime.utcnow() > self.expires_at

        def to_dict(self) -> dict:
            """Convert to dictionary."""
            return {
                "id": self.id,
                "key_id": self.key_id,
                "tenant_id": self.tenant_id,
                "shard_index": self.shard_index,
                "total_shards": self.total_shards,
                "threshold": self.threshold,
                "checksum": self.checksum,
                "storage_hint": self.storage_hint,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "used_at": self.used_at.isoformat() if self.used_at else None,
                "expires_at": self.expires_at.isoformat() if self.expires_at else None,
                "is_valid": self.is_valid,
                "is_expired": self.is_expired,
            }

        def __repr__(self) -> str:
            return f"<KeyShard(id={self.id}, key_id={self.key_id}, shard_index={self.shard_index})>"


    class EncryptionAuditLog(Base):
        """
        Audit log for encryption operations.

        Tracks all encryption/decryption operations for compliance.
        Required for SOC 2, GDPR, and other compliance frameworks.
        """

        __tablename__ = "encryption_audit_log"

        # Primary key
        id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

        # Foreign key
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        )

        # Operation details
        operation: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
        operation_type: Mapped[str] = mapped_column(String(32), nullable=False)  # encrypt, decrypt, share, revoke

        # Target identification
        target_id: Mapped[Optional[str]] = mapped_column(String(64))  # content_id or key_id
        target_type: Mapped[Optional[str]] = mapped_column(String(32))  # content, key, shard

        # User context
        user_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
        user_email: Mapped[Optional[str]] = mapped_column(String(255))
        ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # For security analysis

        # Result
        success: Mapped[bool] = mapped_column(Boolean, nullable=False)
        error_code: Mapped[Optional[str]] = mapped_column(String(32))
        error_message: Mapped[Optional[str]] = mapped_column(Text)

        # Metadata
        metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

        # Timestamp
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )

        # Relationships
        tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])

        # Indexes
        __table_args__ = (
            Index("idx_audit_operation", "operation", "created_at"),
            Index("idx_audit_user", "user_id"),
            Index("idx_audit_tenant", "tenant_id"),
            Index("idx_audit_success", "success"),
        )

        def to_dict(self) -> dict:
            """Convert to dictionary."""
            return {
                "id": self.id,
                "tenant_id": self.tenant_id,
                "operation": self.operation,
                "operation_type": self.operation_type,
                "target_id": self.target_id,
                "target_type": self.target_type,
                "user_id": self.user_id,
                "user_email": self.user_email,
                "ip_address": self.ip_address,
                "success": self.success,
                "error_code": self.error_code,
                "error_message": self.error_message,
                "metadata": self.metadata,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }

        def __repr__(self) -> str:
            return f"<EncryptionAuditLog(id={self.id}, operation={self.operation})>"


# =============================================================================
# Tenant-Scoped Mixin
# =============================================================================


class TenantScopedEncryptedModel:
    """
    Mixin for encrypted models that need tenant isolation.
    """

    if SQLALCHEMY_AVAILABLE:
        tenant_id: Mapped[str] = mapped_column(
            String(36),
            ForeignKey("tenants.id"),
            nullable=False,
            index=True
        )

        @declared_attr
        def __table_args__(cls):
            return (
                Index(f"idx_{cls.__tablename__}_tenant", "tenant_id"),
            )


# =============================================================================
# Helper Functions
# =============================================================================


def verify_integrity_before_storage(
    encrypted_data: bytes,
    nonce: bytes,
    tag: bytes,
    content_hash: str
) -> bool:
    """
    Verify encrypted data integrity before storage.

    Args:
        encrypted_data: Encrypted content
        nonce: GCM nonce (must be 12 bytes)
        tag: GCM tag (must be 16 bytes)
        content_hash: SHA-256 of original content

    Returns:
        True if integrity checks pass
    """
    # Verify nonce length
    if len(nonce) != 12:
        return False

    # Verify tag length
    if len(tag) != 16:
        return False

    # Verify data is not empty
    if len(encrypted_data) == 0:
        return False

    # Verify hash format
    if len(content_hash) != 64:
        return False

    return True


def calculate_storage_path(
    tenant_id: str,
    content_id: str,
    base_path: str = "./data/encrypted"
) -> dict:
    """
    Calculate storage paths for encrypted content.

    Args:
        tenant_id: Tenant identifier
        content_id: Content identifier
        base_path: Base storage path

    Returns:
        Dictionary with paths for data, metadata, and keys
    """
    from pathlib import Path

    base = Path(base_path)

    return {
        "data": base / "data" / tenant_id / f"{content_id}.enc",
        "metadata": base / "metadata" / tenant_id / f"{content_id}.meta.json",
        "key": base / "keys" / tenant_id / f"{content_id}.key.enc",
    }
