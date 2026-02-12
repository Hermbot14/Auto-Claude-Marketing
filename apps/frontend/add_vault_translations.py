#!/usr/bin/env python3
"""Add vault translations to settings.json"""
import json
import sys
from pathlib import Path

# Read current settings.json
settings_file = Path(__file__).parent / 'settings.json'
with open(settings_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add vault translations after apiConfig
vault_translations = {
    "credentials": {
        "title": "Stored Credentials",
        "description": "Credentials currently stored in the secure vault",
        "empty": "No credentials stored in vault",
        "totalCount": "Total credentials: {{count}}",
        "filteredCount": "{{count}} credentials match filter"
    },
    "addCredential": {
        "title": "Add Credential",
        "description": "Store a new credential in the vault",
        "label": "Credential ID",
        "placeholder": "my-api-key",
        "description": "Unique identifier for this credential (auto-generated if empty)"
    },
    "credentialType": {
        "title": "Credential Type",
        "description": "Type of credential (API key, auth token, etc.)"
    },
    "credentialValue": {
        "title": "Credential Value",
        "description": "The secret credential value to store"
    },
    "rotationIntervalDays": {
        "title": "Rotation Interval (Days)",
        "description": "How often this credential should be rotated (0 to disable)"
    },
    "tenantId": {
        "title": "Tenant ID",
        "description": "Isolate credentials by tenant (leave empty for default)"
    },
    "actions": {
        "save": "Save to Vault",
        "saving": "Saving...",
        "cancel": "Cancel"
    },
    "migrate": {
        "title": "Migrate Legacy Credentials",
        "description": "Import credentials from environment variables or plaintext files",
        "strategyEnvVars": "Environment Variables",
        "strategyFiles": "Plaintext Files",
        "sourceDir": "Source Directory",
        "dryRun": "Test mode without making changes",
        "migrateButton": "Migrate",
        "migrating": "Migrating...",
        "results": "Results"
    },
    "rotation": {
        "title": "Credential Rotation",
        "description": "Automatic credential rotation settings",
        "enabled": "Enable automatic rotation",
        "enabledDescription": "Automatically rotate credentials at configured intervals",
        "intervalDays": "Rotation Interval (Days)",
        "intervalDescription": "How often credentials should be rotated (0 to disable)",
        "globalSettings": "Global Rotation Settings",
        "status": {
            "title": "Rotation Status",
            "active": "Active",
            "rotating": "Rotating",
            "expired": "Expired",
            "rotationFailed": "Rotation Failed"
        },
        "needsRotation": "Credentials needing rotation: {{count}}",
        "lastRotated": "Last rotated: {{date}}"
    },
    "auditLog": {
        "title": "Audit Log",
        "description": "Access history and security events",
        "actions": {
            "access": "Access",
            "store": "Store",
            "rotate": "Rotate",
            "delete": "Delete",
            "migrateIn": "Migrate In",
            "migrateOut": "Migrate Out"
        },
        "filter": {
            "allEvents": "All Events",
            "accessEvents": "Access Only",
            "securityEvents": "Security Events"
        },
        "timestamp": "Timestamp",
        "action": "Action",
        "credentialId": "Credential ID",
        "credentialType": "Type",
        "tenantId": "Tenant",
        "success": "Success",
        "error": "Error",
        "userContext": "User",
        "clearLog": "Clear Log",
        "clearLogConfirm": "Clear all audit log entries? This cannot be undone.",
        "exportLog": "Export Log",
        "exportLogDescription": "Download audit log as JSON file"
    },
    "tenantIsolation": {
        "title": "Tenant Isolation",
        "description": "Multi-tenancy support for isolated credential storage",
        "currentTenant": "Current Tenant",
        "defaultTenant": "Default Tenant",
        "createTenant": "Create Tenant",
        "createTenantDescription": "Create isolated storage for a specific tenant",
        "tenantId": "Tenant ID",
        "tenantIdPlaceholder": "my-project",
        "tenantIdDescription": "Unique identifier for isolated credential storage",
        "createButton": "Create Tenant",
        "switchTo": "Switch to Tenant",
        "deleteTenant": "Delete Tenant",
        "deleteTenantConfirm": "Delete tenant '{{tenant}}' and all its credentials? This cannot be undone."
    },
    "security": {
        "title": "Security Information",
        "description": "Encryption details and keychain status",
        "encryptionAlgorithm": "Encryption Algorithm",
        "encryptionAlgorithmValue": "AES-256-GCM",
        "keychainBackend": "Keychain Backend",
        "keychainBackendWindows": "Windows Credential Manager",
        "keychainBackendMacOS": "macOS Keychain",
        "keychainBackendLinux": "Linux Secret Service (DBus)",
        "keychainAvailable": "Keychain Available",
        "keychainNotAvailable": "Keychain Not Available",
        "keychainUnavailableError": "Unable to access keychain. Secure vault will use in-memory keys (less secure).",
        "masterKeyStatus": "Master Key Status",
        "masterKeyExists": "Master key exists in keychain",
        "masterKeyNotExists": "Master key not found in keychain",
        "vaultVersion": "Vault Version",
        "integrityCheck": "Integrity Check",
        "integrityCheckPassed": "Passed - data integrity verified",
        "integrityCheckFailed": "Failed - data may be corrupted"
    },
    "toasts": {
        "storeSuccess": "Credential stored successfully",
        "storeSuccessDescription": "Credential '{{credentialId}}' has been stored in the secure vault",
        "storeFailed": "Failed to store credential",
        "storeFailedDescription": "Could not store credential in vault: {{error}}",
        "retrieveSuccess": "Credential retrieved successfully",
        "retrieveSuccessDescription": "Retrieved credential '{{credentialId}}' from vault",
        "retrieveFailed": "Failed to retrieve credential",
        "retrieveFailedDescription": "Could not retrieve credential from vault: {{error}}",
        "deleteSuccess": "Credential deleted successfully",
        "deleteSuccessDescription": "Credential '{{credentialId}}' has been removed from the vault",
        "deleteFailed": "Failed to delete credential",
        "deleteFailedDescription": "Could not delete credential from vault: {{error}}",
        "migrateSuccess": "Migration completed successfully",
        "migrateSuccessDescription": "Migrated {{count}} credentials to secure vault",
        "migrateFailed": "Migration failed",
        "migrateFailedDescription": "Migration encountered errors: {{error}}",
        "rotateSuccess": "Credential rotated successfully",
        "rotateSuccessDescription": "Credential '{{credentialId}}' has been marked for rotation",
        "rotateFailed": "Rotation failed",
        "rotateFailedDescription": "Could not mark credential for rotation: {{error}}",
        "tenantCreated": "Tenant created successfully",
        "tenantCreatedDescription": "Tenant '{{tenantId}}' has been created",
        "tenantDeleted": "Tenant deleted successfully",
        "tenantDeletedDescription": "Tenant '{{tenantId}}' has been removed along with all credentials",
        "auditLogCleared": "Audit log cleared",
        "auditLogClearedDescription": "All audit log entries have been deleted",
        "vaultNotInitialized": "Vault not initialized",
        "vaultNotInitializedDescription": "Secure vault is not available. Please initialize the vault first.",
        "keychainError": "Keychain error",
        "keychainErrorDescription": "Could not access OS keychain: {{error}}"
    },
    "dialogs": {
        "addCredential": {
            "title": "Add Credential",
            "description": "Store a new credential in the secure vault with AES-256-GCM encryption",
            "cancel": "Cancel"
        },
        "deleteCredential": {
            "title": "Delete Credential?",
            "description": "Are you sure you want to delete '{{credentialId}}'? This action cannot be undone.",
            "confirm": "Delete",
            "cancel": "Cancel"
        },
        "deleteTenant": {
            "title": "Delete Tenant?",
            "description": "Are you sure you want to delete tenant '{{tenantId}}' and all its credentials? This action cannot be undone.",
            "confirm": "Delete Tenant",
            "cancel": "Cancel"
        },
        "clearAuditLog": {
            "title": "Clear Audit Log?",
            "description": "Are you sure you want to clear all audit log entries? This cannot be undone.",
            "confirm": "Clear",
            "cancel": "Cancel"
        }
    }
}

# Insert after apiConfig
data['vault'] = vault_translations

# Write back
with open(settings_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Vault translations added successfully")
