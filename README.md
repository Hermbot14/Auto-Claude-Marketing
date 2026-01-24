# Auto Claude - Marketing Hub Edition

**Auto Claude with integrated Marketing Hub for AI-powered marketing automation.**

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)

---

## About

This is **Auto Claude** - an autonomous multi-agent coding framework that plans, builds, and validates software - with the **Marketing Hub** extension for AI-powered marketing campaign creation and management.

**Status**: 🚧 Marketing Hub features are under development (65% complete). See [Marketing Hub Status](#marketing-hub-status) below.

### What is Auto Claude?

Auto Claude is a multi-agent autonomous coding framework powered by Claude AI that:
- Creates implementation plans from natural language requirements
- Builds software through coordinated AI agent sessions
- Validates work with automated quality assurance
- Uses Graphiti memory for cross-session context

### What is the Marketing Hub?

The Marketing Hub extends Auto Claude with:
- **AI Marketing Agents**: Campaign planner, content creator, social media, email, and SEO specialists
- **Content Calendar**: Visual campaign scheduling and management
- **API Settings UI**: Configure multiple API profiles for different marketing services
- **Platform Integrations**: Connect to social media, email, analytics, and advertising platforms (in development)

## Quick Links

- **Documentation**: See [CLAUDE.md](CLAUDE.md) for detailed project documentation
- **Validation Report**: See [docs/validation-report/TASK-020-VALIDATION-REPORT.md](docs/validation-report/TASK-020-VALIDATION-REPORT.md)
- **Community**: [Discord Server](https://discord.gg/KCXaPBr4Dj)
- **YouTube**: [Andre Mikalsen](https://www.youtube.com/@AndreMikalsen)

## Project Structure

```
auto-claude-marketing/
├── apps/
│   ├── backend/           # Python backend - CLI and agent logic
│   │   ├── core/          # Client, auth, security, global_settings
│   │   ├── agents/        # Agent implementations (including marketing agents)
│   │   ├── prompts/       # Agent system prompts
│   │   └── integrations/  # Graphiti memory, platform integrations
│   └── frontend/          # Electron desktop UI with Marketing Hub features
├── guides/                # Documentation
├── tests/                 # Test suite
└── scripts/               # Build and utility scripts
```

## Development

### Requirements
- Python 3.12+
- Node.js 24+
- Claude API access

### Installation

```bash
# Install all dependencies
npm run install:all

# Or install separately:
cd apps/backend && uv venv && uv pip install -r requirements.txt
cd apps/frontend && npm install
```

### Running the Application

```bash
# Run in development mode
npm run dev

# Run with debugging for E2E testing
npm run dev:debug

# Build for production
npm run build

# Package as desktop app
npm run package
```

See [CLAUDE.md](CLAUDE.md) for detailed development instructions.

## Marketing Hub Status

### ✅ Implemented Features (65%)

**Backend Infrastructure:**
- ✅ Global Settings Reader (`core/global_settings.py`)
- ✅ API Settings integration with Claude SDK client
- ✅ Content Creator Agent
- ✅ Social Media Agent
- ✅ Email Agent
- ✅ SEO Agent
- ✅ Marketing Analytics Agent

**Frontend Components:**
- ✅ API Settings UI with multi-profile support
- ✅ Content Calendar with month/week/day/list views
- ✅ Kanban Board component
- ✅ Insights/Analytics components

### ❌ Missing Features (35%)

**Critical Blockers:**
- ❌ Platform Integrations (social, email, analytics, ad platforms)
- ❌ Campaign Planner Agent implementation (prompt exists)
- ❌ Integration tests for marketing workflows
- ❌ Creative Studio UI
- ❌ Brand Knowledge management

**Documentation:**
- ❌ Migration guide for Marketing Hub features
- ❌ API profile configuration guide
- ❌ Platform integration setup guides

See [Validation Report](docs/validation-report/TASK-020-VALIDATION-REPORT.md) for complete details.

## Roadmap

### Phase 1: Core Infrastructure (Current)
- [x] Global Settings integration
- [x] API Settings UI
- [x] Marketing agent implementations
- [ ] Campaign Planner agent completion
- [ ] Integration testing

### Phase 2: Platform Integrations (Next)
- [ ] Social media platforms (Twitter/X, LinkedIn, Instagram, Facebook, TikTok)
- [ ] Email platforms (Mailchimp, SendGrid, ConvertKit)
- [ ] Analytics platforms (Google Analytics, Mixpanel, Amplitude)
- [ ] Advertising platforms (Google Ads, Facebook Ads, LinkedIn Ads)

### Phase 3: Advanced Features
- [ ] Creative Studio for asset creation
- [ ] Brand Knowledge management
- [ ] Advanced Marketing Intelligence
- [ ] E2E testing suite

## Contributing

Contributions to Auto Claude Marketing Hub are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Note**: This is a feature-rich fork of Auto Claude. For the main Auto Claude project, see [github.com/AndyMik90/Auto-Claude](https://github.com/AndyMik90/Auto-Claude).

## License

**AGPL-3.0** - See [LICENSE](LICENSE) file for details.
