"""
Global Settings Reader Module
==============================

Reads and parses Claude Code global settings from ~/.claude/settings.json.
Provides convenient access to environment variables, model mappings, and
common configuration values.

Usage:
    from core.global_settings import GlobalSettings

    settings = GlobalSettings.load()
    api_token = settings.api_token
    base_url = settings.base_url
    models = settings.models

    # Or use get() with dot notation
    timeout = settings.get('env.API_TIMEOUT_MS', '120000')
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class GlobalSettings:
    """Reader for Claude Code global settings.

    Provides a clean API for accessing Claude Code configuration stored in
    ~/.claude/settings.json or $CLAUDE_CONFIG_DIR/settings.json.

    The settings file typically contains:
    {
        "env": {
            "ANTHROPIC_AUTH_TOKEN": "token",
            "ANTHROPIC_BASE_URL": "url",
            "API_TIMEOUT_MS": "3000000",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": "model-id",
            "ANTHROPIC_DEFAULT_SONNET_MODEL": "model-id",
            "ANTHROPIC_DEFAULT_OPUS_MODEL": "model-id"
        }
    }
    """

    # Standard config paths
    DEFAULT_CONFIG_DIR = Path.home() / '.claude'
    DEFAULT_SETTINGS_FILE = DEFAULT_CONFIG_DIR / 'settings.json'

    # Model mapping keys
    MODEL_KEYS = [
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',
    ]

    # Sentinel value to distinguish "no file loaded" from "empty config loaded"
    _NOT_LOADED = object()

    def __init__(self, config: dict[str, Any] | object):
        """Initialize with parsed config dictionary.

        Args:
            config: Parsed settings.json content, or _NOT_LOADED sentinel
        """
        self._config = config

    @classmethod
    def load(cls) -> 'GlobalSettings':
        """Load settings from standard locations.

        Checks in order:
        1. $CLAUDE_CONFIG_DIR/settings.json (if CLAUDE_CONFIG_DIR is set)
        2. ~/.claude/settings.json (default location)

        Returns:
            GlobalSettings instance (empty config if no file found or error)

        Note:
            Does not raise exceptions - returns sentinel on errors.
            Check is_loaded property to verify if settings were loaded.
        """
        # Check CLAUDE_CONFIG_DIR first
        config_dir = os.environ.get('CLAUDE_CONFIG_DIR')
        if config_dir:
            config_path = Path(config_dir) / 'settings.json'
            if config_path.exists():
                config = cls._load_from_file(config_path)
                # _load_from_file returns {} on error, None sentinel on failure
                if config is not None:
                    logger.debug(f"Loaded settings from {config_path}")
                    return cls(config)

        # Fall back to default location
        if cls.DEFAULT_SETTINGS_FILE.exists():
            config = cls._load_from_file(cls.DEFAULT_SETTINGS_FILE)
            if config is not None:
                logger.debug(f"Loaded settings from {cls.DEFAULT_SETTINGS_FILE}")
                return cls(config)

        logger.debug("No settings file found, using empty config")
        return cls(cls._NOT_LOADED)

    @classmethod
    def _load_from_file(cls, path: Path) -> dict[str, Any] | None:
        """Load and parse settings file.

        Args:
            path: Path to settings.json

        Returns:
            Parsed config dict (may be empty), or None on error

        Note:
            Logs errors but does not raise - returns None on failure.
        """
        try:
            content = path.read_text(encoding='utf-8')
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {path}: {e}")
            return None
        except OSError as e:
            logger.error(f"Error reading {path}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error loading {path}: {e}")
            return None

    def get(self, key: str, default: Any = None) -> Any:
        """Get config value using dot notation.

        Args:
            key: Dot-separated key path (e.g., 'env.ANTHROPIC_AUTH_TOKEN')
            default: Default value if key not found

        Returns:
            Config value or default

        Example:
            >>> settings.get('env.ANTHROPIC_AUTH_TOKEN')
            'sk-ant-api01-...'
            >>> settings.get('env.API_TIMEOUT_MS', '120000')
            '120000'
            >>> settings.get('nonexistent.key', 'default')
            'default'
        """
        # Return default if no config was loaded
        if self._config is self._NOT_LOADED:
            return default

        keys = key.split('.')
        value = self._config

        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default

        return value if value is not None else default

    @property
    def env(self) -> dict[str, str]:
        """Get all environment variables from settings.

        Returns:
            Dict of env vars, or empty dict if not configured

        Example:
            >>> settings.env
            {
                'ANTHROPIC_AUTH_TOKEN': 'sk-ant-api01-...',
                'ANTHROPIC_BASE_URL': 'https://api.anthropic.com',
                'API_TIMEOUT_MS': '3000000'
            }
        """
        return self.get('env', {})

    @property
    def api_token(self) -> str | None:
        """Get ANTHROPIC_AUTH_TOKEN from settings.

        Returns:
            API token string, or None if not configured

        Example:
            >>> settings.api_token
            'sk-ant-api01-...'
        """
        return self.get('env.ANTHROPIC_AUTH_TOKEN')

    @property
    def base_url(self) -> str | None:
        """Get ANTHROPIC_BASE_URL from settings.

        Returns:
            Base URL string, or None if not configured

        Example:
            >>> settings.base_url
            'https://api.anthropic.com'
        """
        return self.get('env.ANTHROPIC_BASE_URL')

    @property
    def timeout(self) -> int | None:
        """Get API_TIMEOUT_MS from settings.

        Returns:
            Timeout in milliseconds as int, or None if not configured or invalid

        Example:
            >>> settings.timeout
            3000000
        """
        timeout_str = self.get('env.API_TIMEOUT_MS')
        if timeout_str:
            try:
                return int(timeout_str)
            except ValueError:
                logger.warning(f"Invalid API_TIMEOUT_MS value: {timeout_str}")
        return None

    @property
    def models(self) -> dict[str, str]:
        """Get model mapping from settings.

        Returns:
            Dict mapping model tiers to model IDs:
            {
                'haiku': 'model-id',
                'sonnet': 'model-id',
                'opus': 'model-id'
            }

        Example:
            >>> settings.models
            {
                'haiku': 'claude-haiku-4-5-20251001',
                'sonnet': 'claude-sonnet-4-5-20250515',
                'opus': 'claude-opus-4-5-20250515'
            }
        """
        models = {}
        env = self.env

        if 'ANTHROPIC_DEFAULT_HAIKU_MODEL' in env:
            models['haiku'] = env['ANTHROPIC_DEFAULT_HAIKU_MODEL']
        if 'ANTHROPIC_DEFAULT_SONNET_MODEL' in env:
            models['sonnet'] = env['ANTHROPIC_DEFAULT_SONNET_MODEL']
        if 'ANTHROPIC_DEFAULT_OPUS_MODEL' in env:
            models['opus'] = env['ANTHROPIC_DEFAULT_OPUS_MODEL']

        return models

    @property
    def is_loaded(self) -> bool:
        """Check if settings were successfully loaded.

        Returns:
            True if config was loaded from a file (even if empty),
            False only if no file was found or loading failed

        Example:
            >>> settings.is_loaded
            True
        """
        return self._config is not self._NOT_LOADED

    def __repr__(self) -> str:
        """String representation of settings."""
        return f"GlobalSettings(loaded={self.is_loaded})"
