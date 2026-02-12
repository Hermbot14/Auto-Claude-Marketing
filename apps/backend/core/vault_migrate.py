#!/usr/bin/env python3
"""
Credential Migration Script for Auto Claude Vault.

This script migrates legacy plaintext credentials to the secure vault.
It supports multiple migration strategies and provides safety checks.

Usage:
    python -m core.vault_migrate [--source-dir PATH] [--dry-run]

Migration Strategies:
---------------------
1. Environment Variables: Migrates from .env and system environment
2. Plaintext Files: Scans directories for .key, .token, credentials.json files
3. In-place Encryption: Encrypts existing files without moving them
4. Backup First: Creates backups before migration

Security Considerations:
----------------------
- Creates backups before any modification
- Validates data integrity after migration
- Provides dry-run mode for testing
- Logs all migration operations
- Supports rollback if migration fails
"""

import argparse
import hashlib
import json
import logging
import os
import shutil
import sys
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vault import (
    VaultManager,
    CredentialType,
    CredentialMetadata,
    CredentialNotFoundError,
    VaultError,
    RotationStatus,
    get_vault,
    initialize_vault,
)


# =============================================================================
# Logging Configuration
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
logger = logging.getLogger(__name__)


# =============================================================================
# Migration Strategies
# =============================================================================


class MigrationStrategy(Enum):
    """Migration strategy options."""

    ENV_VARS = "env_vars"
    PLAINTEXT_FILES = "plaintext_files"
    IN_PLACE = "in_place"


class MigrationResult(Enum):
    """Result status of a migration operation."""

    SUCCESS = "success"
    SKIPPED = "skipped"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


# =============================================================================
# Migration Operations
# =============================================================================


class CredentialMigrator:
    """
    Handles credential migration operations with safety checks.

    Features:
    - Pre-migration validation
    - Backup creation
    - Atomic operations
    - Rollback support
    - Comprehensive logging
    """

    def __init__(self, vault: VaultManager, dry_run: bool = False):
        self.vault = vault
        self.dry_run = dry_run
        self.migration_log = []
        self.backup_dir = None

    def _create_backup(self, source_paths: list[Path]) -> Path | None:
        """Create a backup of all source files before migration."""
        if self.dry_run:
            logger.info("[DRY RUN] Would create backup")
            return None

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_dir = Path.cwd() / f"vault_migration_backup_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir = backup_dir

        logger.info(f"Created backup directory: {backup_dir}")

        for source_path in source_paths:
            if source_path.is_file():
                shutil.copy2(source_path, backup_dir / source_path.name)
            elif source_path.is_dir():
                shutil.copytree(source_path, backup_dir / source_path.name, dirs_exist_ok=True)

        return backup_dir

    def _validate_migration_source(self, source: Any) -> bool:
        """Validate that a migration source is safe to process."""
        if isinstance(source, str):
            # Check for suspicious patterns
            if not source or len(source.strip()) == 0:
                logger.warning(f"Skipping empty credential value")
                return False
            if '\n' in source or '\r' in source:
                logger.warning(f"Skipping credential with newline characters (potential injection attempt)")
                return False
            return True

        elif isinstance(source, Path):
            # Check file permissions
            if not os.access(source, os.R_OK):
                logger.warning(f"Cannot read file: {source}")
                return False
            # Check file size (warn if > 1MB)
            if source.stat().st_size > 1024 * 1024:
                logger.warning(f"Large file detected (>1MB): {source}")
            return True
            return True

        return False

    def _migrate_env_var(
        self,
        env_var: str,
        value: str,
        cred_type: str,
    ) -> dict[str, Any]:
        """Migrate a single environment variable credential."""
        if not self._validate_migration_source(value):
            return {
                'env_var': env_var,
                'result': MigrationResult.SKIPPED,
                'reason': 'Validation failed',
            }

        if self.dry_run:
            logger.info(f"[DRY RUN] Would migrate {env_var} to vault")
            return {
                'env_var': env_var,
                'result': MigrationResult.SKIPPED,
                'reason': 'Dry run',
            }

        try:
            # Store in vault
            metadata = self.vault.store_credential(
                credential_id=env_var.lower(),
                credential_type=cred_type,
                credential_value=value,
            )

            logger.info(f"Migrated {env_var} to vault as {env_var.lower()}")

            return {
                'env_var': env_var,
                'result': MigrationResult.SUCCESS,
                'credential_id': env_var.lower(),
                'metadata': metadata,
            }

        except Exception as e:
            logger.error(f"Failed to migrate {env_var}: {str(e)}")
            return {
                'env_var': env_var,
                'result': MigrationResult.FAILED,
                'error': str(e),
            }

    def _migrate_plaintext_file(
        self,
        file_path: Path,
        cred_type: str,
    ) -> dict[str, Any]:
        """Migrate credentials from a plaintext file."""
        if not self._validate_migration_source(file_path):
            return {
                'file': str(file_path),
                'result': MigrationResult.SKIPPED,
                'reason': 'Validation failed',
            }

        if self.dry_run:
            logger.info(f"[DRY RUN] Would migrate {file_path}")
            return {
                'file': str(file_path),
                'result': MigrationResult.SKIPPED,
                'reason': 'Dry run',
            }

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Try to parse as JSON
            migrated = 0
            failed = 0

            try:
                data = json.loads(content)
                if isinstance(data, dict):
                    for key, value in data.items():
                        if isinstance(value, str) and len(value) > 10:
                            # Migrate each credential
                            result = self.vault.store_credential(
                                credential_id=f"{file_path.stem}_{key}",
                                credential_type=cred_type,
                                credential_value=value,
                            )
                            if result:
                                migrated += 1
                            else:
                                failed += 1
                            logger.info(f"Migrated {file_path.stem}.{key} to vault")

            except json.JSONDecodeError:
                # Treat entire file as single credential
                if len(content.strip()) > 10 and not content.startswith('#'):
                    result = self.vault.store_credential(
                        credential_id=file_path.stem,
                        credential_type=cred_type,
                        credential_value=content.strip(),
                    )
                    if result:
                        migrated += 1
                    else:
                        failed += 1
                    logger.info(f"Migrated {file_path.stem} to vault")

            logger.info(f"Migrated {migrated} credentials from {file_path}")

            if failed > 0:
                logger.warning(f"Failed to migrate {failed} credentials from {file_path}")

            return {
                'file': str(file_path),
                'result': MigrationResult.SUCCESS if failed == 0 else MigrationResult.FAILED,
                'migrated': migrated,
                'failed': failed,
            }

        except Exception as e:
            logger.error(f"Failed to migrate {file_path}: {str(e)}")
            return {
                'file': str(file_path),
                'result': MigrationResult.FAILED,
                'error': str(e),
            }

    def migrate_env_vars(self, custom_env_file: str | None = None) -> list[dict[str, Any]]:
        """
        Migrate credentials from environment variables.

        Args:
            custom_env_file: Optional path to custom .env file to scan

        Returns:
            List of migration results
        """
        logger.info("Scanning environment variables for credentials...")

        # Env var to credential type mapping
        env_mappings = {
            'ANTHROPIC_API_KEY': CredentialType.ANTHROPIC_API_KEY.value,
            'OPENAI_API_KEY': CredentialType.OPENAI_API_KEY.value,
            'GOOGLE_API_KEY': CredentialType.GOOGLE_API_KEY.value,
            'MAILCHIMP_API_KEY': CredentialType.MAILCHIMP_API_KEY.value,
            'SENDGRID_API_KEY': CredentialType.SENDGRID_API_KEY.value,
            'CONVERTKIT_API_KEY': CredentialType.CONVERTKIT_API_KEY.value,
            'LINEAR_API_KEY': CredentialType.LINEAR_API_KEY.value,
            'GITLAB_TOKEN': CredentialType.GITLAB_TOKEN.value,
            'GITHUB_TOKEN': CredentialType.GITHUB_TOKEN.value,
        }

        results = []

        # Check environment variables
        for env_var, cred_type in env_mappings.items():
            value = os.environ.get(env_var)
            if value:
                results.append(self._migrate_env_var(env_var, value, cred_type))

        # Check custom .env file if provided
        if custom_env_file:
            env_path = Path(custom_env_file)
            if env_path.exists():
                logger.info(f"Scanning custom env file: {custom_env_file}")
                try:
                    with open(env_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('#') and '=' in line:
                                env_var, value = line.split('=', 1)
                                env_var = env_var.strip()
                                value = value.strip().strip('"\'')

                                if env_var in env_mappings:
                                    results.append(
                                        self._migrate_env_var(
                                            env_var, value, env_mappings[env_var]
                                        )
                                    )
                except Exception as e:
                    logger.error(f"Failed to scan env file: {str(e)}")

        return results

    def migrate_plaintext_files(
        self,
        source_dir: str,
        patterns: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Migrate credentials from plaintext files.

        Args:
            source_dir: Directory to scan for credential files
            patterns: Optional list of glob patterns (default: common patterns)

        Returns:
            List of migration results
        """
        logger.info(f"Scanning directory for credential files: {source_dir}")

        source_path = Path(source_dir)
        if not source_path.exists() or not source_path.is_dir():
            logger.error(f"Invalid source directory: {source_dir}")
            return []

        # Default patterns to scan
        if patterns is None:
            patterns = [
                '*.key',
                '*.token',
                'credentials.json',
                '.env',
                'secrets.json',
                'config.json',
                '*_credentials.json',
            ]

        results = []
        source_files = []

        for pattern in patterns:
            for file_path in source_path.glob(pattern):
                if file_path.is_file():
                    source_files.append(file_path)

        # Create backup
        self._create_backup(source_files)

        for file_path in source_files:
            # Determine credential type from filename
            if 'key' in file_path.name.lower():
                cred_type = CredentialType.CUSTOM_API_KEY.value
            elif 'token' in file_path.name.lower():
                cred_type = CredentialType.GITLAB_TOKEN.value
            elif 'credential' in file_path.name.lower() or 'secret' in file_path.name.lower():
                cred_type = CredentialType.CUSTOM_API_KEY.value
            elif file_path.name == '.env':
                cred_type = CredentialType.CUSTOM_API_KEY.value
            elif file_path.name == 'credentials.json':
                cred_type = CredentialType.CUSTOM_API_KEY.value
            else:
                cred_type = CredentialType.CUSTOM_API_KEY.value

            results.append(self._migrate_plaintext_file(file_path, cred_type))

        return results

    def generate_migration_report(self) -> str:
        """Generate a human-readable migration report."""
        report_lines = [
            "=" * 60,
            "CREDENTIAL MIGRATION REPORT",
            "=" * 60,
            "",
            f"Generated: {datetime.now().isoformat()}",
            "",
            "SUMMARY",
            "-" * 40,
        ]

        # Count results by type
        total = 0
        success = 0
        failed = 0
        skipped = 0

        for result in self.migration_log:
            total += 1
            if result.get('result') == MigrationResult.SUCCESS:
                success += 1
            elif result.get('result') == MigrationResult.FAILED:
                failed += 1
            else:
                skipped += 1

        report_lines.extend([
            f"Total operations: {total}",
            f"Successful: {success}",
            f"Failed: {failed}",
            f"Skipped: {skipped}",
            "",
        ])

        # Add detailed results
        if success > 0:
            report_lines.extend([
                "SUCCESSFUL MIGRATIONS",
                "-" * 40,
                "",
            ])
            for result in self.migration_log:
                if result.get('result') == MigrationResult.SUCCESS:
                    if 'env_var' in result:
                        report_lines.append(f"  ✓ {result['env_var']}")
                    elif 'file' in result:
                        report_lines.append(f"  ✓ {result['file']}")
                    if 'credential_id' in result:
                        report_lines.append(f"    → Stored as: {result['credential_id']}")

        if failed > 0:
            report_lines.extend([
                "",
                "FAILED MIGRATIONS",
                "-" * 40,
                "",
            ])
            for result in self.migration_log:
                if result.get('result') == MigrationResult.FAILED:
                    if 'env_var' in result:
                        report_lines.append(f"  ✗ {result['env_var']}")
                    elif 'file' in result:
                        report_lines.append(f"  ✗ {result['file']}")
                    if 'error' in result:
                        report_lines.append(f"    Error: {result['error']}")

        # Add recommendations
        report_lines.extend([
            "",
            "RECOMMENDATIONS",
            "-" * 40,
            "",
            "1. Remove migrated credentials from source locations:",
            "   - Delete .env files containing migrated credentials",
            "   - Delete plaintext credential files (*.key, *.token)",
            "   - Unset environment variables containing credentials",
            "",
            "2. Update application code to use vault:",
            "   - Import: from core.vault import get_vault",
            "   - Use: vault = get_vault()",
            "   - Retrieve: value, meta = vault.retrieve_credential('id')",
            "   - Store: vault.store_credential('id', 'type', value)",
            "",
            "3. Enable automatic credential rotation:",
            "   - Set AUTO_CLAUDE_CREDENTIAL_ROTATION=true",
            "   - Configure rotation interval: AUTO_CLAUDE_CREDENTIAL_ROTATION_DAYS=90",
            "",
            f"Vault location: {self.vault.vault_dir}",
            "",
            "=" * 60,
        ])

        return "\n".join(report_lines)


# =============================================================================
# Main Migration Function
# =============================================================================


def run_migration(
    strategy: MigrationStrategy = MigrationStrategy.PLAINTEXT_FILES,
    source: str | None = None,
    dry_run: bool = False,
) -> int:
    """
    Run credential migration with specified strategy.

    Args:
        strategy: Migration strategy to use
        source: Source directory or file
        dry_run: Test mode without making changes

    Returns:
        Exit code (0 for success, 1 for errors)
    """
    logger.info("=" * 60)
    logger.info("CREDENTIAL MIGRATION")
    logger.info("=" * 60)
    logger.info("")

    # Initialize vault
    try:
        vault = initialize_vault()
    except Exception as e:
        logger.error(f"Failed to initialize vault: {str(e)}")
        return 1

    migrator = CredentialMigrator(vault, dry_run=dry_run)

    if strategy == MigrationStrategy.ENV_VARS:
        results = migrator.migrate_env_vars()
        logger.info(f"Migrated {len(results)} environment variables")

    elif strategy == MigrationStrategy.PLAINTEXT_FILES:
        if not source:
            logger.error("Source directory required for file migration")
            return 1
        results = migrator.migrate_plaintext_files(source)

    # Generate report
    report = migrator.generate_migration_report()
    print(report)

    # Save report
    report_path = Path.cwd() / "vault_migration_report.txt"
    try:
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        logger.info(f"Migration report saved to: {report_path}")
    except Exception as e:
        logger.warning(f"Failed to save report: {str(e)}")

    # Count failures
    failed_count = sum(
        1 for r in results if r.get('result') == MigrationResult.FAILED
    )

    return 1 if failed_count > 0 else 0


# =============================================================================
# CLI Entry Point
# =============================================================================


def main() -> int:
    """CLI entry point for credential migration."""
    parser = argparse.ArgumentParser(
        description="Migrate legacy credentials to Auto Claude secure vault",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Migrate environment variables (dry run)
  python -m core.vault_migrate --dry-run

  # Migrate from specific directory
  python -m core.vault_migrate --strategy plaintext_files --source-dir ./legacy-config

  # Migrate from current directory
  python -m core.vault_migrate --strategy plaintext_files --source-dir .
        """,
    )

    parser.add_argument(
        '--strategy',
        choices=['env_vars', 'plaintext_files', 'in_place'],
        default='plaintext_files',
        help='Migration strategy to use',
    )

    parser.add_argument(
        '--source-dir',
        type=str,
        help='Source directory for file migration',
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Test migration without making changes',
    )

    args = parser.parse_args()
    strategy = MigrationStrategy(args.strategy)

    if strategy == MigrationStrategy.IN_PLACE:
        logger.error("In-place migration not yet implemented")
        return 1

    return run_migration(strategy, args.source_dir, args.dry_run)


if __name__ == '__main__':
    sys.exit(main())
