# API Profile Configuration Guide

**Marketing Hub v1.0.0** - Complete API configuration documentation

---

## Overview

Marketing Hub supports multiple API profiles for different configurations. This allows you to:
- Switch between different API providers
- Use different models for different tasks
- Maintain separate configurations for development/production
- Test connections before saving

---

## Configuration Methods

### Method 1: Global Settings (Recommended)

**Location:** `~/.claude/settings.json` or `$CLAUDE_CONFIG_DIR/settings.json`

**Priority:** Highest (overrides all other configuration)

**Example:**
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-your-token-here",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-20250929",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20250514",
    "API_TIMEOUT_MS": "120000"
  }
}
```

**How to Create:**

1. **Locate or create settings directory:**
   ```bash
   # Windows
   echo %USERPROFILE%\.claude

   # macOS/Linux
   echo ~/.claude
   ```

2. **Create settings.json file:**
   ```bash
   # macOS/Linux
   cat > ~/.claude/settings.json << 'EOF'
   {
     "env": {
       "ANTHROPIC_AUTH_TOKEN": "your-token-here",
       "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
     }
   }
   EOF

   # Windows (PowerShell)
   @'
   {
     "env": {
       "ANTHROPIC_AUTH_TOKEN": "your-token-here",
       "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
     }
   }
   '@ | Out-File -Encoding UTF8 $env:USERPROFILE\.claude\settings.json
   ```

3. **Validate configuration:**
   ```bash
   cat ~/.claude/settings.json | python -m json.tool
   ```

### Method 2: Project .env File

**Location:** `apps/backend/.env`

**Priority:** Medium (overridden by global settings)

**Example:**
```bash
# API Configuration
ANTHROPIC_AUTH_TOKEN=sk-ant-your-token-here
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Model Configuration
ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-20250514
ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-5-20250514

# Request Settings
API_TIMEOUT_MS=120000
MAX_TOKENS=200000
```

**Important:** Never commit `.env` files to version control. Add to `.gitignore`:
```
.env
.env.local
.env.production
```

### Method 3: API Settings UI

**Location:** Electron App → Settings → API Settings

**Features:**
- Multi-profile support
- Connection testing
- Model selection
- Visual configuration

**Steps:**

1. **Open API Settings:**
   - Launch Marketing Hub app
   - Navigate to Settings
   - Click "API Settings"

2. **Create New Profile:**
   - Click "Add Profile"
   - Enter profile name (e.g., "Production", "Development", "Custom API")
   - Configure settings:
     - API Token
     - Base URL
     - Haiku Model
     - Sonnet Model
     - Opus Model
     - Timeout (ms)

3. **Test Connection:**
   - Click "Test Connection" button
   - Verify all models are accessible
   - Check response times

4. **Save Profile:**
   - Click "Save Profile"
   - Settings persisted to localStorage

---

## Configuration Priority Chain

Marketing Hub reads configuration in the following order (highest to lowest):

1. **Global `~/.claude/settings.json`** - Highest priority
2. **Project `.env` file** - Medium priority
3. **System environment variables** - Low priority
4. **Hardcoded defaults** - Fallback only

**Example:**
```
Global settings: ANTHROPIC_AUTH_TOKEN=token-a
Project .env:    ANTHROPIC_AUTH_TOKEN=token-b
System env:      ANTHROPIC_AUTH_TOKEN=token-c

Result: token-a is used (global settings wins)
```

---

## API Endpoints

### Official Anthropic API

**Base URL:** `https://api.anthropic.com`

**Models:**
- `claude-haiku-4-20250514` - Haiku (fast, cost-effective)
- `claude-sonnet-4-5-20250929` - Sonnet (balanced)
- `claude-opus-4-5-20250514` - Opus (highest quality)

**Get API Token:** https://console.anthropic.com/

### Custom API Endpoints

Marketing Hub supports custom API endpoints (e.g., for proxies or self-hosted solutions).

**Configuration:**
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-custom-endpoint.com"
  }
}
```

**Requirements:**
- Must be Anthropic-compatible API
- Must support same request/response format
- Must handle streaming responses

---

## Model Selection Guide

### Haiku (claude-haiku-4-20250514)

**Best For:**
- Quick content generation
- Social media posts
- Email subject lines
- Simple copy variations

**Characteristics:**
- Fast response time
- Lower cost
- Good for simple tasks

**Not Recommended For:**
- Complex campaign strategy
- Long-form content
- Data analysis

### Sonnet (claude-sonnet-4-5-20250929)

**Best For:**
- Campaign planning
- Email copy
- Blog posts
- Content ideation

**Characteristics:**
- Balanced speed and quality
- Cost-effective
- Good for most marketing tasks

**Recommended As:**
- Default model for most operations

### Opus (claude-opus-4-5-20250514)

**Best For:**
- Complex campaign strategy
- Long-form content (whitepapers, guides)
- Competitive analysis
- Data-intensive analytics

**Characteristics:**
- Highest quality output
- Slower response time
- Higher cost

**Recommended As:**
- Default for Campaign Planner Agent
- Default for Marketing Analytics Agent

---

## Global Settings API

### Reading Settings Programmatically

**Python Backend:**
```python
from core.global_settings import GlobalSettings

# Initialize
settings = GlobalSettings()

# Get API token
token = settings.api_token

# Get base URL
base_url = settings.base_url

# Get model mappings
models = settings.models  # {'haiku': '...', 'sonnet': '...', 'opus': '...'}

# Get specific setting
timeout = settings.get('API_TIMEOUT_MS', 120000) // 1000
```

### Creating a Client with Global Settings

**Python Backend:**
```python
from core.client import create_client

# Client automatically reads global settings
client = create_client(
    project_dir="/path/to/project",
    spec_dir="/path/to/spec",
    model="claude-sonnet-4-5-20250929",  # Will use global setting if not specified
    agent_type="content_creator"
)

# Global settings priority is applied automatically
# 1. Global ~/.claude/settings.json
# 2. Project .env
# 3. System environment variables
# 4. Hardcoded defaults
```

---

## Testing Configuration

### Backend Configuration Test

**Python Script:**
```python
from core.global_settings import GlobalSettings
from core.client import create_client

# Test global settings
settings = GlobalSettings()
print(f"API Token: {settings.api_token[:10]}...")
print(f"Base URL: {settings.base_url}")
print(f"Models: {settings.models}")

# Test client creation
try:
    client = create_client(
        project_dir=".",
        spec_dir="./test-spec",
        model="claude-haiku-4-20250514",
        agent_type="content_creator"
    )
    print("✓ Client created successfully")
except Exception as e:
    print(f"✗ Client creation failed: {e}")
```

### Frontend Configuration Test

**UI Test:**
1. Open API Settings in the app
2. Click "Test Connection"
3. Verify all 3 models respond
4. Check response times are acceptable

---

## Troubleshooting

### Issue: "API Token Not Found"

**Solution:**
1. Check `~/.claude/settings.json` exists
2. Validate JSON syntax: `python -m json.tool ~/.claude/settings.json`
3. Verify `ANTHROPIC_AUTH_TOKEN` is present
4. Check file permissions: `chmod 600 ~/.claude/settings.json`

### Issue: "Invalid API Token"

**Solution:**
1. Verify token at https://console.anthropic.com/
2. Check for whitespace in token: `echo "$ANTHROPIC_AUTH_TOKEN" | cat -A`
3. Regenerate token if expired
4. Ensure no extra quotes in JSON

### Issue: "Model Not Available"

**Solution:**
1. Verify model name is correct
2. Check API endpoint supports the model
3. Test with official API: `curl https://api.anthropic.com/v1/messages`
4. Try different model (e.g., Sonnet instead of Opus)

### Issue: "Connection Timeout"

**Solution:**
1. Increase timeout in settings:
   ```json
   {
     "env": {
       "API_TIMEOUT_MS": "300000"
     }
   }
   ```
2. Check network connectivity
3. Verify firewall allows connections
4. Try alternative endpoint (if using proxy)

### Issue: "Global Settings Not Loading"

**Solution:**
1. Verify path: `echo ~/.claude/settings.json`
2. Check `$CLAUDE_CONFIG_DIR` environment variable
3. Ensure file is readable: `cat ~/.claude/settings.json`
4. Check for JSON syntax errors

---

## Security Best Practices

### 1. Token Storage

**Do:**
- Store tokens in `~/.claude/settings.json`
- Set file permissions: `chmod 600 ~/.claude/settings.json`
- Use environment-specific tokens (dev vs prod)
- Rotate tokens regularly

**Don't:**
- Commit tokens to git
- Share tokens in chat/email
- Hardcode tokens in source files
- Use production tokens for development

### 2. Token Rotation

**Recommended:** Rotate API tokens every 90 days

**Steps:**
1. Generate new token at https://console.anthropic.com/
2. Update `~/.claude/settings.json`
3. Test connection before fully switching
4. Revoke old token after 24 hours

### 3. Access Control

**File Permissions:**
```bash
# Restrict to owner only
chmod 600 ~/.claude/settings.json

# Verify
ls -la ~/.claude/settings.json
# Should show: -rw------- (600)
```

---

## Advanced Configuration

### Multiple API Profiles

**Use Case:** Different configurations for different projects

**Implementation:**
```json
{
  "env": {
    "DEFAULT_PROFILE": "production",
    "PRODUCTION_API_TOKEN": "sk-ant-prod-token",
    "DEVELOPMENT_API_TOKEN": "sk-ant-dev-token",
    "PRODUCTION_BASE_URL": "https://api.anthropic.com",
    "DEVELOPMENT_BASE_URL": "https://api-dev.anthropic.com"
  }
}
```

### Proxy Configuration

**Use Case:** Route API requests through proxy

**Implementation:**
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-proxy.com/v1"
  }
}
```

**Requirements:**
- Proxy must handle Anthropic API format
- Must support streaming responses
- Must preserve authentication headers

### Custom Model Mappings

**Use Case:** Use different model names or endpoints

**Implementation:**
```python
from core.global_settings import GlobalSettings

settings = GlobalSettings()

# Override model mappings
custom_models = {
    "haiku": "custom-haiku-model",
    "sonnet": "custom-sonnet-model",
    "opus": "custom-opus-model"
}

# Use in client creation
client = create_client(
    project_dir=".",
    spec_dir="./spec",
    model=custom_models["sonnet"],
    agent_type="content_creator"
)
```

---

## Summary

Marketing Hub v1.0.0 provides flexible API configuration through:

1. **Global Settings** (`~/.claude/settings.json`) - Recommended
2. **Project .env** files - Development
3. **API Settings UI** - User-friendly configuration
4. **Environment Variables** - CI/CD pipelines

**Configuration Priority:** Global → .env → System env → Defaults

**Supported Models:**
- Haiku: Fast, cost-effective
- Sonnet: Balanced (recommended default)
- Opus: Highest quality

For additional help, see:
- [Migration Guide](MIGRATION_GUIDE.md)
- [Platform Integrations](PLATFORM_INTEGRATIONS.md)
- [Validation Report](../MARKETING_HUB_VALIDATION_REPORT.md)

---

**Last Updated:** 2026-01-24
**Version:** 1.0.0
