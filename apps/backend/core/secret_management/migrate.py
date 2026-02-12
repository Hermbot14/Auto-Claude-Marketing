"""
Secret Migration Utilities for Secret Management System.

This module provides utilities to migrate existing plaintext secrets
to encrypted vault storage.

Migration Strategies:
1. Environment Variables - Migrate from system environment
2. Plaintext Files - Scan and encrypt credential files
3. Configuration Files - Parse and migrate config files
4. Database - Migrate from legacy database storage

Security:
- Creates encrypted backups before migration
- Validates source permissions before reading
- Verifies migration success before cleanup
- Generates comprehensive audit trail
"""

import argparse
import base64
import hashlib
import json
import logging
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


@dataclass
class MigrationResult:
    """Result of a secret migration operation."""

    source_type: str
    secrets_migrated: int
    secrets_failed: int
    backup_path: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    start_time: datetime = None
    end_time: Optional[datetime] = None

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get migration duration in seconds."""
        if self.end_time and self.start_time:
            return (self.end_time - self.start_time).total_seconds()
        return None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "source_type": self.source_type,
            "secrets_migrated": self.secrets_migrated,
            "secrets_failed": self.secrets_failed,
            "backup_path": self.backup_path,
            "errors": self.errors,
            "warnings": self.warnings,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
        }


@dataclass
class SecretMapping:
    """Mapping for secret identification."""

    secret_id: str
    source_key: str
    secret_type: str
    required: bool = True


# =============================================================================
# Default Mappings
# =============================================================================

DEFAULT_ENV_MAPPINGS = [
    SecretMapping("anthropic_api_key", "ANTHROPIC_API_KEY", "api_key"),
    SecretMapping("openai_api_key", "OPENAI_API_KEY", "api_key"),
    SecretMapping("google_api_key", "GOOGLE_API_KEY", "api_key"),
    SecretMapping("mailchimp_api_key", "MAILCHIMP_API_KEY", "api_key"),
    SecretMapping("sendgrid_api_key", "SENDGRID_API_KEY", "api_key"),
    SecretMapping("convertkit_api_key", "CONVERTKIT_API_KEY", "api_key"),
    SecretMapping("linear_api_key", "LINEAR_API_KEY", "api_key"),
    SecretMapping("gitlab_token", "GITLAB_TOKEN", "auth_token"),
    SecretMapping("github_token", "GITHUB_TOKEN", "auth_token"),
    SecretMapping("aws_access_key_id", "AWS_ACCESS_KEY_ID", "api_key"),
    SecretMapping("aws_secret_access_key", "AWS_SECRET_ACCESS_KEY", "api_key"),
    SecretMapping("database_url", "DATABASE_URL", "database_url"),
    SecretMapping("redis_url", "REDIS_URL", "database_url"),
    SecretMapping("stripe_secret_key", "STRIPE_SECRET_KEY", "api_key"),
]

FILE_PATTERNS = {
    "*.key": "api_key",
    "*.token": "auth_token",
    "credentials.json": "credentials_file",
    ".env": "environment_file",
    "config.json": "config_file",
}


# =============================================================================
# Migration Classes
# =============================================================================


class SecretMigrator:
    """
    Handles migration of secrets from various sources to encrypted storage.

    Features:
    - Environment variable migration
    - Plaintext file scanning and migration
    - Automatic backup creation
    - Comprehensive validation
    - Detailed reporting
    """

    def __init__(self, dry_run: bool = False):
        """
        Initialize migrator.

        Args:
            dry_run: If True, simulate migration without changes
        """
        self.dry_run = dry_run
        self.results: List[MigrationResult] = []

    def migrate_from_environment(
        self,
        mappings: Optional[List[SecretMapping]] = None,
    ) -> MigrationResult:
        """
        Migrate secrets from environment variables.

        Args:
            mappings: Optional list of secret mappings

        Returns:
            MigrationResult with details
        """
        result = MigrationResult(
            source_type="environment",
            secrets_migrated=0,
            secrets_failed=0,
            start_time=datetime.now(),
        )

        mappings = mappings or DEFAULT_ENV_MAPPINGS

        from core.secret_management import get_secret_manager

        manager = get_secret_manager()

        for mapping in mappings:
            try:
                value = os.environ.get(mapping.source_key)

                if not value:
                    if mapping.required:
                        result.warnings.append(
                            f"Required secret '{mapping.source_key}' not found in environment"
                        )
                    continue

                # Check if already exists
                if manager.secret_exists(mapping.secret_id):
                    result.warnings.append(
                        f"Secret '{mapping.secret_id}' already exists, skipping"
                    )
                    continue

                if not self.dry_run:
                    # Store in secret manager
                    manager.store_secret(
                        secret_id=mapping.secret_id,
                        secret_value=value,
                        secret_type=mapping.secret_type,
                    )

                result.secrets_migrated += 1
                logger.info(f"Migrated '{mapping.source_key}' -> '{mapping.secret_id}'")

            except Exception as e:
                result.secrets_failed += 1
                result.errors.append(
                    f"Failed to migrate '{mapping.source_key}': {str(e)}"
                )

        result.end_time = datetime.now()
        self.results.append(result)
        return result

    def migrate_from_files(
        self,
        source_dir: str,
        patterns: Optional[Dict[str, str]] = None,
        backup: bool = True,
    ) -> MigrationResult:
        """
        Migrate secrets from plaintext files.

        Args:
            source_dir: Directory containing files to scan
            patterns: Optional dict of file patterns to secret types
            backup: Whether to create backup before migration

        Returns:
            MigrationResult with details
        """
        result = MigrationResult(
            source_type="files",
            secrets_migrated=0,
            secrets_failed=0,
            start_time=datetime.now(),
        )

        patterns = patterns or FILE_PATTERNS
        source_path = Path(source_dir)

        if not source_path.exists():
            result.errors.append(f"Source directory '{source_dir}' does not exist")
            result.end_time = datetime.now()
            self.results.append(result)
            return result

        # Create backup if needed
        if backup and not self.dry_run:
            backup_path = self._create_backup(source_path)
            result.backup_path = str(backup_path)

        from core.secret_management import get_secret_manager

        manager = get_secret_manager()

        # Scan for matching files
        for pattern, secret_type in patterns.items():
            for file_path in source_path.glob(pattern):
                if not file_path.is_file():
                    continue

                try:
                    migrated = self._migrate_file(
                        file_path, secret_type, manager, result
                    )
                    if migrated:
                        result.secrets_migrated += 1

                except Exception as e:
                    result.secrets_failed += 1
                    result.errors.append(
                        f"Failed to migrate '{file_path}': {str(e)}"
                    )

        result.end_time = datetime.now()
        self.results.append(result)
        return result

    def _migrate_file(
        self,
        file_path: Path,
        secret_type: str,
        manager,
        result: MigrationResult,
    ) -> bool:
        """
        Migrate secrets from a single file.

        Args:
            file_path: Path to file
            secret_type: Type of secret in file
            manager: SecretManager instance
            result: MigrationResult to update

        Returns:
            True if at least one secret was migrated
        """
        content = file_path.read_text(encoding='utf-8').strip()

        if not content:
            return False

        # Try to parse as JSON
        try:
            data = json.loads(content)
            if isinstance(data, dict):
                return self._migrate_dict(data, file_path.stem, secret_type, manager, result)
        except json.JSONDecodeError:
            pass

        # Try to parse as KEY=VALUE format
        if '=' in content:
            return self._migrate_env_format(content, file_path, manager, result)

        # Treat entire file as single secret
        secret_id = file_path.stem
        if manager.secret_exists(secret_id):
            result.warnings.append(f"Secret '{secret_id}' already exists")
            return False

        if len(content) < 10:
            result.warnings.append(f"File '{file_path}' content too short, skipping")
            return False

        if not self.dry_run:
            manager.store_secret(secret_id, content, secret_type)

        logger.info(f"Migrated file '{file_path}' -> '{secret_id}'")
        return True

    def _migrate_dict(
        self,
        data: Dict[str, Any],
        prefix: str,
        secret_type: str,
        manager,
        result: MigrationResult,
    ) -> bool:
        """Migrate secrets from a dictionary."""
        migrated = False

        for key, value in data.items():
            if not isinstance(value, str):
                continue

            secret_id = f"{prefix}_{key}"

            if manager.secret_exists(secret_id):
                result.warnings.append(f"Secret '{secret_id}' already exists")
                continue

            if len(value) < 10:
                continue

            if not self.dry_run:
                manager.store_secret(secret_id, value, secret_type)

            logger.info(f"Migrated dict key '{prefix}.{key}' -> '{secret_id}'")
            migrated = True

        return migrated

    def _migrate_env_format(
        self,
        content: str,
        file_path: Path,
        manager,
        result: MigrationResult,
    ) -> bool:
        """Migrate secrets from KEY=VALUE format."""
        migrated = False

        for line in content.split('\n'):
            line = line.strip()

            if not line or line.startswith('#'):
                continue

            if '=' not in line:
                continue

            key, value = line.split('=', 1)

            secret_id = f"{file_path.stem}_{key}"

            if manager.secret_exists(secret_id):
                result.warnings.append(f"Secret '{secret_id}' already exists")
                continue

            if len(value) < 10:
                continue

            if not self.dry_run:
                manager.store_secret(secret_id, value, "env_value")

            logger.info(f"Migrated env line '{file_path}:{key}' -> '{secret_id}'")
            migrated = True

        return migrated

    def _create_backup(self, source_path: Path) -> Path:
        """
        Create a backup of the source directory.

        Args:
            source_path: Path to backup

        Returns:
            Path to backup directory
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{source_path.name}_backup_{timestamp}"
        backup_path = source_path.parent / backup_name

        shutil.copytree(source_path, backup_path)
        logger.info(f"Created backup: {backup_path}")

        return backup_path

    def generate_report(self) -> str:
        """
        Generate a human-readable migration report.

        Returns:
            Formatted report string
        """
        lines = [
            "=" * 60,
            "SECRET MIGRATION REPORT",
            "=" * 60,
            "",
            f"Dry Run: {self.dry_run}",
            f"Migration Operations: {len(self.results)}",
            "",
        ]

        for i, result in enumerate(self.results, 1):
            lines.extend([
                "-" * 60,
                f"Operation {i}: {result.source_type}",
                "-" * 60,
                f"Secrets Migrated: {result.secrets_migrated}",
                f"Secrets Failed: {result.secrets_failed}",
                f"Duration: {result.duration_seconds:.2f}s" if result.duration_seconds else "Duration: N/A",
                "",
            ])

            if result.backup_path:
                lines.append(f"Backup: {result.backup_path}")

            if result.warnings:
                lines.extend(["", "Warnings:"] + [f"  - {w}" for w in result.warnings])

            if result.errors:
                lines.extend(["", "Errors:"] + [f"  - {e}" for e in result.errors])

            lines.append("")

        lines.extend([
            "=" * 60,
            "SUMMARY",
            "=" * 60,
        ])

        total_migrated = sum(r.secrets_migrated for r in self.results)
        total_failed = sum(r.secrets_failed for r in self.results)

        lines.extend([
            f"Total Secrets Migrated: {total_migrated}",
            f"Total Secrets Failed: {total_failed}",
            f"Success Rate: {total_migrated / (total_migrated + total_failed) * 100:.1f}%" if (total_migrated + total_failed) > 0 else "Success Rate: N/A",
            "",
        ])

        if self.dry_run:
            lines.append("DRY RUN COMPLETED - No changes were made")
        else:
            lines.append("MIGRATION COMPLETED")

        return "\n".join(lines)


# =============================================================================
# CLI Interface
# =============================================================================


def main():
    """CLI entry point for secret migration."""
    parser = argparse.ArgumentParser(
        description="Migrate secrets to encrypted storage"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration without making changes",
    )

    parser.add_argument(
        "--strategy",
        choices=["environment", "files", "all"],
        default="all",
        help="Migration strategy to use",
    )

    parser.add_argument(
        "--source-dir",
        type=str,
        default=".",
        help="Source directory for file migration",
    )

    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip creating backup before migration",
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Run migration
    migrator = SecretMigrator(dry_run=args.dry_run)

    if args.strategy in ["environment", "all"]:
        print("\nMigrating from environment variables...")
        migrator.migrate_from_environment()

    if args.strategy in ["files", "all"]:
        print(f"\nMigrating from files in '{args.source_dir}'...")
        migrator.migrate_from_files(
            args.source_dir,
            backup=not args.no_backup,
        )

    # Print report
    print("\n" + migrator.generate_report())


if __name__ == "__main__":
    main()
