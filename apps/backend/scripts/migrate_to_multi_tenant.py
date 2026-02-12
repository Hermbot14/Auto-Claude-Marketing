#!/usr/bin/env python3
"""
Multi-Tenant Migration Script for Auto Claude Marketing Hub

This script migrates existing single-tenant data to the new multi-tenant architecture.
It handles:
- Creating default tenant from existing data
- Migrating user accounts to tenant members
- Updating all data with tenant_id references
- Preserving existing data integrity

Usage:
    python scripts/migrate_to_multi_tenant.py [--dry-run] [--tenant-id DEFAULT]
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.tenant_context import Tenant, TenantStatus, TierType, TenantBranding, TenantLimits
from core.multi_tenancy import TenantStore, TenantConfig
from models.tenant import get_limits_for_tier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MigrationConfig:
    """Configuration for the migration process."""

    def __init__(self, dry_run: bool = False, default_tenant_id: str = "default"):
        self.dry_run = dry_run
        self.default_tenant_id = default_tenant_id
        self.backup_dir = Path(".auto-claude/migration_backup")
        self.specs_dir = Path(".auto-claude/specs")
        self.tenants_dir = Path(".auto-claude/tenants")


class DataBackup:
    """Handles backup creation before migration."""

    def __init__(self, config: MigrationConfig):
        self.config = config
        self.backup_path = config.backup_dir / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def create_backup(self) -> Path:
        """Create a backup of all data before migration."""
        if self.config.dry_run:
            logger.info("[DRY RUN] Would create backup at: %s", self.backup_path)
            return self.backup_path

        logger.info("Creating backup at: %s", self.backup_path)
        self.backup_path.mkdir(parents=True, exist_ok=True)

        # Backup specs directory
        if self.config.specs_dir.exists():
            backup_specs = self.backup_path / "specs"
            shutil.copytree(self.config.specs_dir, backup_specs)
            logger.info("Backed up specs directory")

        # Backup existing tenant data if any
        if self.config.tenants_dir.exists():
            backup_tenants = self.backup_path / "tenants"
            shutil.copytree(self.config.tenants_dir, backup_tenants)
            logger.info("Backed up existing tenants directory")

        # Create migration manifest
        manifest = {
            "backup_time": datetime.now().isoformat(),
            "dry_run": self.config.dry_run,
            "default_tenant_id": self.config.default_tenant_id,
            "backup_path": str(self.backup_path),
        }

        manifest_path = self.backup_path / "migration_manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        logger.info("Migration manifest saved to: %s", manifest_path)
        return self.backup_path


class TenantMigrator:
    """Handles tenant creation and data migration."""

    def __init__(self, config: MigrationConfig):
        self.config = config
        self.tenant_config = TenantConfig(
            enabled=True,
            default_tenant_id=config.default_tenant_id,
            storage_path=str(config.tenants_dir)
        )
        self.tenant_store = TenantStore(self.tenant_config)

    def create_default_tenant(self) -> Tenant:
        """Create the default tenant from existing configuration."""
        logger.info("Creating default tenant: %s", self.config.default_tenant_id)

        # Try to load existing user data for customization
        user_data = self._load_existing_user_data()

        tenant = Tenant(
            tenant_id=self.config.default_tenant_id,
            name=user_data.get("company_name", "Auto Claude"),
            status=TenantStatus.ACTIVE,
            tier=TierType.ENTERPRISE,  # Default to enterprise for existing users
            branding=TenantBranding(
                company_name=user_data.get("company_name", "Auto Claude"),
                logo_url=user_data.get("logo_url"),
                primary_color=user_data.get("primary_color", "#3b82f6"),
                secondary_color=user_data.get("secondary_color", "#8b5cf6"),
            ),
            limits=get_limits_for_tier(TierType.ENTERPRISE),
            metadata={
                "migrated_at": datetime.now().isoformat(),
                "migration_source": "single_tenant",
                "original_user_count": user_data.get("user_count", 1),
            },
            created_at=user_data.get("created_at", datetime.now().isoformat()),
        )

        if self.config.dry_run:
            logger.info("[DRY RUN] Would create tenant: %s", tenant.tenant_id)
            logger.info("[DRY RUN] Tenant data: %s", json.dumps(tenant.to_dict(), indent=2))
            return tenant

        self.tenant_store.save(tenant)
        logger.info("Created default tenant: %s", tenant.tenant_id)
        return tenant

    def _load_existing_user_data(self) -> Dict[str, Any]:
        """Load existing user data for customizing the default tenant."""
        data = {}

        # Try to load user settings
        settings_path = Path(".auto-claude/settings.json")
        if settings_path.exists():
            try:
                with open(settings_path, "r") as f:
                    settings = json.load(f)
                    data["company_name"] = settings.get("user_name", "Auto Claude")
                    data["created_at"] = settings.get("created_at")
            except Exception as e:
                logger.warning("Failed to load settings: %s", e)

        # Try to load auth data for user count
        auth_path = Path(".auto-claude/auth.json")
        if auth_path.exists():
            try:
                with open(auth_path, "r") as f:
                    auth = json.load(f)
                    data["user_count"] = len(auth.get("users", [])) + 1
            except Exception as e:
                logger.warning("Failed to load auth data: %s", e)

        return data


class SpecMigrator:
    """Handles migration of spec data to tenant-scoped format."""

    def __init__(self, config: MigrationConfig, tenant_id: str):
        self.config = config
        self.tenant_id = tenant_id
        self.specs_dir = config.specs_dir

    def migrate_specs(self) -> int:
        """Migrate all specs to include tenant_id."""
        migrated_count = 0

        if not self.specs_dir.exists():
            logger.info("No specs directory found, skipping spec migration")
            return 0

        for spec_path in self.specs_dir.iterdir():
            if not spec_path.is_dir():
                continue

            spec_name = spec_path.name
            logger.info("Migrating spec: %s", spec_name)

            # Read spec.json if exists
            spec_json_path = spec_path / "spec.json"
            if spec_json_path.exists():
                try:
                    with open(spec_json_path, "r") as f:
                        spec_data = json.load(f)

                    # Add tenant_id to spec
                    spec_data["tenant_id"] = self.tenant_id

                    if self.config.dry_run:
                        logger.info("[DRY RUN] Would update spec: %s", spec_name)
                        migrated_count += 1
                        continue

                    # Write back with tenant_id
                    with open(spec_json_path, "w") as f:
                        json.dump(spec_data, f, indent=2)

                    migrated_count += 1
                    logger.info("Migrated spec: %s", spec_name)

                except Exception as e:
                    logger.error("Failed to migrate spec %s: %s", spec_name, e)

        logger.info("Migrated %d specs", migrated_count)
        return migrated_count

    def migrate_implementation_plans(self) -> int:
        """Migrate implementation plans to include tenant_id."""
        migrated_count = 0

        for spec_path in self.specs_dir.iterdir():
            if not spec_path.is_dir():
                continue

            plan_path = spec_path / "implementation_plan.json"
            if not plan_path.exists():
                continue

            try:
                with open(plan_path, "r") as f:
                    plan_data = json.load(f)

                # Add tenant_id to plan metadata
                if "metadata" not in plan_data:
                    plan_data["metadata"] = {}
                plan_data["metadata"]["tenant_id"] = self.tenant_id

                if self.config.dry_run:
                    logger.info("[DRY RUN] Would update plan for: %s", spec_path.name)
                    migrated_count += 1
                    continue

                with open(plan_path, "w") as f:
                    json.dump(plan_data, f, indent=2)

                migrated_count += 1

            except Exception as e:
                logger.error("Failed to migrate plan for %s: %s", spec_path.name, e)

        logger.info("Migrated %d implementation plans", migrated_count)
        return migrated_count


class QAMigrator:
    """Handles migration of QA reports to tenant-scoped format."""

    def __init__(self, config: MigrationConfig, tenant_id: str):
        self.config = config
        self.tenant_id = tenant_id
        self.specs_dir = config.specs_dir

    def migrate_qa_reports(self) -> int:
        """Migrate QA reports to include tenant_id."""
        migrated_count = 0

        for spec_path in self.specs_dir.iterdir():
            if not spec_path.is_dir():
                continue

            qa_report_path = spec_path / "qa_report.md"
            if not qa_report_path.exists():
                continue

            try:
                with open(qa_report_path, "r") as f:
                    content = f.read()

                # Add tenant_id to QA report if not present
                if "Tenant ID:" not in content:
                    tenant_line = f"\n**Tenant ID:** {self.tenant_id}\n"

                    if self.config.dry_run:
                        logger.info("[DRY RUN] Would update QA report for: %s", spec_path.name)
                        migrated_count += 1
                        continue

                    with open(qa_report_path, "w") as f:
                        f.write(content + tenant_line)

                    migrated_count += 1

            except Exception as e:
                logger.error("Failed to migrate QA report for %s: %s", spec_path.name, e)

        logger.info("Migrated %d QA reports", migrated_count)
        return migrated_count


def run_migration(config: MigrationConfig) -> Dict[str, Any]:
    """Run the complete migration process."""
    logger.info("Starting multi-tenant migration...")
    logger.info("Dry run: %s", config.dry_run)

    results = {
        "success": True,
        "errors": [],
        "migrated": {
            "tenants": 0,
            "specs": 0,
            "plans": 0,
            "qa_reports": 0,
        },
    }

    try:
        # Step 1: Create backup
        logger.info("Step 1: Creating backup...")
        backup = DataBackup(config)
        backup.create_backup()
        logger.info("Backup created successfully")

        # Step 2: Create default tenant
        logger.info("Step 2: Creating default tenant...")
        tenant_migrator = TenantMigrator(config)
        tenant = tenant_migrator.create_default_tenant()
        results["migrated"]["tenants"] = 1
        logger.info("Default tenant created: %s", tenant.tenant_id)

        # Step 3: Migrate specs
        logger.info("Step 3: Migrating specs...")
        spec_migrator = SpecMigrator(config, tenant.tenant_id)
        results["migrated"]["specs"] = spec_migrator.migrate_specs()

        # Step 4: Migrate implementation plans
        logger.info("Step 4: Migrating implementation plans...")
        results["migrated"]["plans"] = spec_migrator.migrate_implementation_plans()

        # Step 5: Migrate QA reports
        logger.info("Step 5: Migrating QA reports...")
        qa_migrator = QAMigrator(config, tenant.tenant_id)
        results["migrated"]["qa_reports"] = qa_migrator.migrate_qa_reports()

        logger.info("Migration completed successfully!")
        logger.info("Summary: %s", json.dumps(results["migrated"], indent=2))

    except Exception as e:
        logger.error("Migration failed: %s", e)
        results["success"] = False
        results["errors"].append(str(e))

    return results


def verify_migration(config: MigrationConfig) -> bool:
    """Verify that migration was successful."""
    logger.info("Verifying migration...")

    # Check that default tenant exists
    tenant_store = TenantStore(config.tenants_dir)
    tenant = tenant_store.get(config.default_tenant_id)

    if tenant is None:
        logger.error("Default tenant not found!")
        return False

    logger.info("Default tenant verified: %s", tenant.tenant_id)

    # Check that specs have tenant_id
    specs_verified = 0
    for spec_path in config.specs_dir.iterdir():
        if not spec_path.is_dir():
            continue

        spec_json_path = spec_path / "spec.json"
        if spec_json_path.exists():
            try:
                with open(spec_json_path, "r") as f:
                    spec_data = json.load(f)

                if spec_data.get("tenant_id") == config.default_tenant_id:
                    specs_verified += 1

            except Exception:
                pass

    logger.info("Verified %d specs with tenant_id", specs_verified)
    return True


def main():
    """Main entry point for the migration script."""
    parser = argparse.ArgumentParser(
        description="Migrate Auto Claude to multi-tenant architecture"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run migration without making changes"
    )
    parser.add_argument(
        "--tenant-id",
        default="default",
        help="ID for the default tenant (default: default)"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify migration after completion"
    )

    args = parser.parse_args()

    config = MigrationConfig(
        dry_run=args.dry_run,
        default_tenant_id=args.tenant_id
    )

    # Run migration
    results = run_migration(config)

    # Verify if requested
    if args.verify and results["success"] and not config.dry_run:
        verify_migration(config)

    # Exit with appropriate code
    sys.exit(0 if results["success"] else 1)


if __name__ == "__main__":
    main()
