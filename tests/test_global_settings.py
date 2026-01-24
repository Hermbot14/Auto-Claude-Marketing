"""
Tests for Global Settings Module
=================================

Tests the global_settings.py module functionality including:
- Loading from standard locations
- Parsing environment variables
- Model mappings
- Error handling for missing/invalid files
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend'))

from core.global_settings import GlobalSettings


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def valid_settings_content():
    """Valid settings.json content."""
    return {
        "env": {
            "ANTHROPIC_AUTH_TOKEN": "sk-ant-api01-test-token",
            "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
            "API_TIMEOUT_MS": "3000000",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001",
            "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-20250515",
            "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20250515",
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
        },
        "enabledPlugins": {
            "test-plugin": True
        }
    }


@pytest.fixture
def minimal_settings_content():
    """Minimal settings.json with only required fields."""
    return {
        "env": {
            "ANTHROPIC_AUTH_TOKEN": "sk-ant-api01-minimal"
        }
    }


@pytest.fixture
def empty_settings_content():
    """Empty settings.json."""
    return {}


# ============================================================================
# Loading Tests
# ============================================================================

class TestLoadSettings:
    """Tests for loading settings from files."""

    def test_load_from_default_location(self, tmp_path, valid_settings_content):
        """Load settings from ~/.claude/settings.json."""
        # Create settings file in temp .claude directory
        claude_dir = tmp_path / '.claude'
        claude_dir.mkdir()
        settings_file = claude_dir / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.is_loaded is True
            assert settings.api_token == "sk-ant-api01-test-token"
            assert settings.base_url == "https://api.anthropic.com"

    def test_load_from_claude_config_dir(self, tmp_path, valid_settings_content):
        """Load from $CLAUDE_CONFIG_DIR/settings.json takes precedence."""
        # Create custom config directory
        config_dir = tmp_path / 'custom_config'
        config_dir.mkdir()
        settings_file = config_dir / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.dict(os.environ, {'CLAUDE_CONFIG_DIR': str(config_dir)}):
            with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', Path('/nonexistent/settings.json')):
                settings = GlobalSettings.load()

                assert settings.is_loaded is True
                assert settings.api_token == "sk-ant-api01-test-token"

    def test_claude_config_dir_takes_precedence(self, tmp_path, valid_settings_content):
        """$CLAUDE_CONFIG_DIR takes precedence over default location."""
        # Create custom config with different content
        config_dir = tmp_path / 'custom_config'
        config_dir.mkdir()
        custom_settings = valid_settings_content.copy()
        custom_settings['env']['ANTHROPIC_AUTH_TOKEN'] = 'custom-token'
        custom_file = config_dir / 'settings.json'
        custom_file.write_text(json.dumps(custom_settings))

        # Create default location
        default_dir = tmp_path / '.claude'
        default_dir.mkdir()
        default_file = default_dir / 'settings.json'
        default_file.write_text(json.dumps(valid_settings_content))

        with patch.dict(os.environ, {'CLAUDE_CONFIG_DIR': str(config_dir)}):
            with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', default_file):
                settings = GlobalSettings.load()

                # Should load from custom config
                assert settings.api_token == 'custom-token'

    def test_load_returns_empty_config_when_no_file(self, tmp_path):
        """Returns empty config when no settings file exists."""
        nonexistent = tmp_path / 'nonexistent' / 'settings.json'

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', nonexistent):
            with patch.dict(os.environ, {}, clear=True):
                settings = GlobalSettings.load()

                assert settings.is_loaded is False
                assert settings.api_token is None
                assert settings.base_url is None


# ============================================================================
# Invalid JSON Tests
# ============================================================================

class TestInvalidJson:
    """Tests for handling invalid JSON content."""

    def test_invalid_json_returns_empty_config(self, tmp_path):
        """Invalid JSON returns empty config."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text('{ invalid json }')

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.is_loaded is False

    def test_malformed_json_returns_empty_config(self, tmp_path):
        """Malformed JSON returns empty config."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text('{"unclosed": true')

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.is_loaded is False

    def test_empty_file_returns_empty_config(self, tmp_path):
        """Empty file returns empty config."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text('')

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.is_loaded is False


# ============================================================================
# Property Accessor Tests
# ============================================================================

class TestPropertyAccessors:
    """Tests for property accessor methods."""

    def test_api_token_property(self, tmp_path, valid_settings_content):
        """api_token property returns ANTHROPIC_AUTH_TOKEN."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.api_token == "sk-ant-api01-test-token"

    def test_base_url_property(self, tmp_path, valid_settings_content):
        """base_url property returns ANTHROPIC_BASE_URL."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.base_url == "https://api.anthropic.com"

    def test_timeout_property_valid(self, tmp_path, valid_settings_content):
        """timeout property returns parsed integer."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.timeout == 3000000
            assert isinstance(settings.timeout, int)

    def test_timeout_property_invalid(self, tmp_path):
        """Invalid timeout returns None."""
        content = {
            "env": {
                "API_TIMEOUT_MS": "not-a-number"
            }
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.timeout is None

    def test_timeout_property_missing(self, tmp_path):
        """Missing timeout returns None."""
        content = {"env": {}}
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.timeout is None

    def test_models_property_all_models(self, tmp_path, valid_settings_content):
        """models property returns all configured models."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            models = settings.models
            assert models['haiku'] == 'claude-haiku-4-5-20251001'
            assert models['sonnet'] == 'claude-sonnet-4-5-20250515'
            assert models['opus'] == 'claude-opus-4-5-20250515'

    def test_models_property_partial(self, tmp_path):
        """models property handles partial configuration."""
        content = {
            "env": {
                "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5"
            }
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            models = settings.models
            assert 'haiku' not in models
            assert models['sonnet'] == 'claude-sonnet-4-5'
            assert 'opus' not in models

    def test_models_property_empty(self, tmp_path):
        """models property returns empty dict when no models configured."""
        content = {"env": {}}
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.models == {}

    def test_env_property(self, tmp_path, valid_settings_content):
        """env property returns all environment variables."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            env = settings.env
            assert env['ANTHROPIC_AUTH_TOKEN'] == 'sk-ant-api01-test-token'
            assert env['ANTHROPIC_BASE_URL'] == 'https://api.anthropic.com'
            assert env['API_TIMEOUT_MS'] == '3000000'

    def test_is_loaded_property(self, tmp_path, valid_settings_content):
        """is_loaded property reflects config state."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()
            assert settings.is_loaded is True

        # Test with "not loaded" sentinel
        not_loaded = GlobalSettings(GlobalSettings._NOT_LOADED)
        assert not_loaded.is_loaded is False

    def test_repr(self, tmp_path, valid_settings_content):
        """__repr__ returns useful string representation."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert repr(settings) == "GlobalSettings(loaded=True)"
            assert repr(GlobalSettings(GlobalSettings._NOT_LOADED)) == "GlobalSettings(loaded=False)"


# ============================================================================
# Get Method Tests
# ============================================================================

class TestGetMethod:
    """Tests for the get() method with dot notation."""

    def test_get_single_key(self, tmp_path, valid_settings_content):
        """Get single-level key."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.get('env') == valid_settings_content['env']

    def test_get_dot_notation(self, tmp_path, valid_settings_content):
        """Get nested key using dot notation."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.get('env.ANTHROPIC_AUTH_TOKEN') == 'sk-ant-api01-test-token'
            assert settings.get('env.API_TIMEOUT_MS') == '3000000'

    def test_get_deep_nesting(self, tmp_path):
        """Get deeply nested key."""
        content = {
            "level1": {
                "level2": {
                    "level3": "deep-value"
                }
            }
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.get('level1.level2.level3') == 'deep-value'

    def test_get_missing_key_returns_default(self, tmp_path, valid_settings_content):
        """Missing key returns default value."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.get('nonexistent') is None
            assert settings.get('nonexistent', 'default') == 'default'
            assert settings.get('env.nonexistent', 'default') == 'default'

    def test_get_none_value_returns_default(self, tmp_path):
        """Explicit None value returns default."""
        content = {
            "key": None
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            # None value should trigger default return
            assert settings.get('key', 'default') == 'default'

    def test_get_empty_string_value(self, tmp_path):
        """Empty string is a valid value, not None."""
        content = {
            "env": {
                "EMPTY_VAR": ""
            }
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            # Empty string is a valid value
            result = settings.get('env.EMPTY_VAR')
            assert result == ""

    def test_get_non_dict_intermediate(self, tmp_path):
        """Handles non-dict intermediate values gracefully."""
        content = {
            "env": "not-a-dict"
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            # Should return default when intermediate is not a dict
            assert settings.get('env.SOME_KEY', 'default') == 'default'


# ============================================================================
# Edge Cases Tests
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_empty_settings_file(self, tmp_path):
        """Empty settings.json (just {}) loads successfully."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text('{}')

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            # Config is loaded but empty
            assert settings.is_loaded is True
            assert settings.api_token is None
            assert settings.base_url is None
            assert settings.env == {}

    def test_settings_without_env_section(self, tmp_path):
        """Settings without env section handled gracefully."""
        content = {
            "enabledPlugins": {
                "test": True
            }
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.is_loaded is True
            assert settings.env == {}
            assert settings.api_token is None

    def test_minimal_settings(self, tmp_path, minimal_settings_content):
        """Minimal settings with only token work."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(minimal_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.api_token == "sk-ant-api01-minimal"
            assert settings.base_url is None
            assert settings.timeout is None

    def test_unicode_content(self, tmp_path):
        """Handles unicode characters correctly."""
        content = {
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "sk-ant-api01-test",
                "COMMENT": "Test with unicode: café, 日本語, emoji 🚀"
            }
        }
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content), encoding='utf-8')

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert settings.api_token == "sk-ant-api01-test"
            assert 'café' in settings.env['COMMENT']
            assert '日本語' in settings.env['COMMENT']
            assert '🚀' in settings.env['COMMENT']

    def test_large_file(self, tmp_path):
        """Handles large settings files."""
        # Create large env dict
        large_env = {}
        for i in range(1000):
            large_env[f"VAR_{i}"] = f"value_{i}"

        content = {"env": large_env}
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            settings = GlobalSettings.load()

            assert len(settings.env) == 1000
            assert settings.get('env.VAR_0') == 'value_0'
            assert settings.get('env.VAR_999') == 'value_999'


# ============================================================================
# Direct Initialization Tests
# ============================================================================

class TestDirectInitialization:
    """Tests for direct initialization with config dict."""

    def test_init_with_config(self):
        """Can initialize directly with config dict."""
        config = {
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "direct-token"
            }
        }
        settings = GlobalSettings(config)

        assert settings.is_loaded is True
        assert settings.api_token == "direct-token"

    def test_init_with_empty_config(self):
        """Can initialize with empty config dict."""
        settings = GlobalSettings({})

        # Empty dict is still considered "loaded" (user explicitly provided it)
        assert settings.is_loaded is True
        assert settings.api_token is None
        assert settings.env == {}

    def test_get_works_with_direct_init(self):
        """get() method works with directly initialized instance."""
        config = {
            "level1": {
                "level2": "value"
            }
        }
        settings = GlobalSettings(config)

        assert settings.get('level1.level2') == 'value'


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for common usage patterns."""

    def test_full_workflow(self, tmp_path, valid_settings_content):
        """Test typical usage workflow."""
        settings_file = tmp_path / 'settings.json'
        settings_file.write_text(json.dumps(valid_settings_content))

        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', settings_file):
            # Load settings
            settings = GlobalSettings.load()

            # Verify loaded
            assert settings.is_loaded is True

            # Access common properties
            token = settings.api_token
            url = settings.base_url
            timeout = settings.timeout
            models = settings.models

            # Use in application logic
            assert token is not None
            assert url is not None
            assert timeout is not None
            assert len(models) == 3

            # Get specific values with dot notation
            disable_traffic = settings.get('env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')
            assert disable_traffic == '1'

    def test_profile_switching_pattern(self, tmp_path):
        """Test switching between different profiles."""
        # Create profile 1
        profile1 = tmp_path / 'profile1.json'
        profile1.write_text(json.dumps({
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "profile1-token",
                "ANTHROPIC_BASE_URL": "https://api1.anthropic.com"
            }
        }))

        # Create profile 2
        profile2 = tmp_path / 'profile2.json'
        profile2.write_text(json.dumps({
            "env": {
                "ANTHROPIC_AUTH_TOKEN": "profile2-token",
                "ANTHROPIC_BASE_URL": "https://api2.anthropic.com"
            }
        }))

        # Load profile 1
        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', profile1):
            settings1 = GlobalSettings.load()
            assert settings1.api_token == "profile1-token"

        # Load profile 2
        with patch.object(GlobalSettings, 'DEFAULT_SETTINGS_FILE', profile2):
            settings2 = GlobalSettings.load()
            assert settings2.api_token == "profile2-token"
