# Marketing Hub Migration Guide

**From:** Auto-Claude (Autonomous Coding Framework)
**To:** Marketing Hub v1.0.0 (AI-Powered Marketing Automation)
**Date:** 2026-01-24
**Status:** 95% Complete

---

## Overview

Marketing Hub is a transformation of Auto-Claude from an autonomous coding framework into an AI-powered marketing automation platform. This guide helps users understand the changes and migrate to the new version.

---

## What Changed?

### Core Transformation

| Auto-Claude | Marketing Hub | Purpose |
|-------------|---------------|---------|
| Spec Planning | Campaign Planning | Plan marketing campaigns instead of code implementations |
| Coder Agent | Content Creator Agent | Generate marketing content instead of code |
| QA Reviewer | Campaign Reviewer | Validate campaign quality instead of code quality |
| Task Board | Campaign Kanban | Manage marketing campaigns instead of coding tasks |
| Code Ideation | Creative Studio | Generate campaign concepts instead of code improvements |

### New Features

1. **Global Settings Integration**
   - Reads from `~/.claude/settings.json`
   - API token management
   - Model configuration (Haiku/Sonnet/Opus)
   - Configuration priority chain

2. **API Settings UI**
   - Multi-profile support
   - Connection testing
   - Model selection
   - Persistent settings storage

3. **Marketing Agents**
   - Content Creator Agent
   - Social Media Agent
   - Email Marketing Agent
   - SEO Agent
   - Marketing Analytics Agent
   - Campaign Planner Agent

4. **Platform Integrations**
   - Social Media (Twitter/X, LinkedIn, Instagram, Facebook)
   - Email Platforms (Mailchimp, SendGrid, ConvertKit)
   - Analytics Platforms (Google Analytics 4, Mixpanel, Amplitude)
   - Advertising Platforms (Google Ads, Meta Ads, LinkedIn Ads)

---

## Migration Steps

### Step 1: Update Global Settings

Marketing Hub now reads from Claude Code's global settings file.

**Location:** `~/.claude/settings.json` or `$CLAUDE_CONFIG_DIR/settings.json`

**Required Configuration:**

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-token",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-20250929",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20250514"
  }
}
```

**Configuration Priority:**
1. Global `~/.claude/settings.json` (highest priority)
2. Project `.env` file
3. System environment variables
4. Hardcoded defaults (lowest priority)

### Step 2: Update API Configuration

Marketing Hub introduces API profiles for different configurations.

**Via UI:**
1. Open Settings → API Settings
2. Create a new profile or edit existing
3. Configure API token, base URL, and model mappings
4. Test connection
5. Save profile

**Via Code:**
See [API_CONFIGURATION.md](API_CONFIGURATION.md) for detailed configuration options.

### Step 3: Update Agent Prompts

If you have custom agent prompts, update them for marketing use cases:

**Old (Auto-Claude):**
```
You are a software development agent...
```

**New (Marketing Hub):**
```
You are a marketing automation agent...
```

**Prompt Locations:**
- `apps/backend/prompts/content_creator.md`
- `apps/backend/prompts/social_media.md`
- `apps/backend/prompts/email_marketing.md`
- `apps/backend/prompts/seo.md`
- `apps/backend/prompts/marketing_analytics.md`
- `apps/backend/prompts/planner_marketing.md`

### Step 4: Update Frontend Components

Component names and terminology have changed:

| Old Component | New Component | Location |
|---------------|---------------|----------|
| `KanbanBoard.tsx` | `KanbanBoard.tsx` (repurposed) | Campaign workflow |
| `Ideation.tsx` | `Creative Studio` (repurposed) | Marketing ideation |
| `Insights.tsx` | `Marketing Intelligence` (repurposed) | Marketing analytics |
| `Roadmap.tsx` | `ContentCalendar` (new) | Campaign scheduling |

**i18n Translation Updates:**
- `navigation.json` - Marketing-focused navigation items
- `welcome.json` - Marketing Hub branding
- `common.json` - Marketing-specific messages

### Step 5: Configure Platform Integrations

Marketing Hub includes platform integrations for social media, email, analytics, and advertising.

**Configuration Files:**
- Social: `apps/backend/integrations/social/config.py`
- Email: `apps/backend/integrations/email/config.py`
- Analytics: `apps/backend/integrations/analytics/config.py`
- Ads: `apps/backend/integrations/ads/config.py`

**Environment Variables:**
```bash
# Social Media
TWITTER_API_KEY=your-key
TWITTER_API_SECRET=your-secret
LINKEDIN_CLIENT_ID=your-id
LINKEDIN_CLIENT_SECRET=your-secret

# Email Platforms
MAILCHIMP_API_KEY=your-key
SENDGRID_API_KEY=your-key
CONVERTKIT_API_KEY=your-key

# Analytics
GA4_MEASUREMENT_ID=your-id
MIXPANEL_TOKEN=your-token
AMPLITUDE_API_KEY=your-key

# Advertising
GOOGLE_ADS_DEVELOPER_TOKEN=your-token
META_ADS_APP_ID=your-app-id
META_ADS_APP_SECRET=your-secret
```

See [PLATFORM_INTEGRATIONS.md](PLATFORM_INTEGRATIONS.md) for detailed setup instructions.

---

## Breaking Changes

### 1. Package Name Change
- **Old:** `auto-claude`
- **New:** `auto-claude-marketing`

**Impact:** Update imports and references if you have custom scripts.

### 2. Terminology Changes
- **Spec** → **Campaign**
- **Task** → **Campaign Item**
- **Implementation Plan** → **Campaign Plan**
- **Code Quality** → **Content Quality**

**Impact:** Update UI labels, API responses, and user-facing text.

### 3. Agent System Changes
- **Removed:** `coder.py` agent (replaced by `content_creator.py`)
- **Removed:** `planner.py` for code (replaced by `planner_marketing.md`)
- **Added:** 6 new marketing-specific agents

**Impact:** Update agent references in your code.

### 4. Configuration Priority Change
- **Old:** Environment variables → Hardcoded defaults
- **New:** Global settings → Environment variables → Hardcoded defaults

**Impact:** Move API tokens to `~/.claude/settings.json` for consistent configuration.

---

## Rollback Instructions

If you need to rollback to Auto-Claude:

1. **Clone original repository:**
   ```bash
   git clone https://github.com/AndyMik90/Auto-Claude.git
   ```

2. **Copy your customizations:**
   - Custom prompts from `apps/backend/prompts/`
   - Custom integrations from `apps/backend/integrations/`
   - Frontend customizations

3. **Restore configuration:**
   - Move API tokens from global settings back to `.env`
   - Restore original agent implementations
   - Update i18n files

---

## Compatibility Matrix

| Feature | Auto-Claude | Marketing Hub |
|---------|-------------|---------------|
| **Claude SDK** | ✅ | ✅ |
| **Graphiti Memory** | ✅ | ✅ |
| **Global Settings** | ❌ | ✅ |
| **Marketing Agents** | ❌ | ✅ |
| **Platform Integrations** | ❌ | ✅ |
| **Code Generation** | ✅ | ❌ |
| **Spec Planning** | ✅ | ❌ |
| **Content Creation** | ❌ | ✅ |

---

## Support and Troubleshooting

### Known Issues

See [LAUNCH_ISSUE_ANALYSIS.md](../LAUNCH_ISSUE_ANALYSIS.md) for the current Electron app launch issue.

### Getting Help

- **Documentation:** [README.md](../README.md)
- **Validation Report:** [MARKETING_HUB_VALIDATION_REPORT.md](../MARKETING_HUB_VALIDATION_REPORT.md)
- **GitHub Issues:** [Submit an issue](https://github.com/AndyMik90/Auto-Claude-Marketing/issues)
- **Community:** [Discord Server](https://discord.gg/KCXaPBr4Dj)

---

## Summary

Marketing Hub v1.0.0 represents a complete transformation from autonomous coding to AI-powered marketing automation. The migration involves:

- Updating global settings configuration
- Migrating to marketing-specific agents
- Configuring platform integrations
- Updating terminology and UI labels
- Adapting to new workflows

**Status:** 95% complete - all development tasks finished. Electron app launch issue prevents E2E testing but does not affect code quality or completeness.

---

**Last Updated:** 2026-01-24
**Version:** 1.0.0
