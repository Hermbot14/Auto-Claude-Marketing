# MARKETING ROADMAP PHASES

This document contains pre-defined marketing phase templates that can be used when generating marketing roadmaps.

## PHASE 1: CAMPAIGN PLANNING

```json
{
  "id": "phase-campaign-planning",
  "name": "Campaign Planning",
  "description": "Strategic foundation for marketing initiatives. Define goals, audience, messaging, and budget allocation.",
  "order": 1,
  "status": "planned",
  "duration": "1-2 weeks",
  "objectives": [
    "Define clear campaign goals and KPIs",
    "Identify and understand target audience",
    "Research competitors and market positioning",
    "Develop compelling value proposition and messaging",
    "Allocate budget across marketing channels",
    "Create campaign timeline and milestones"
  ],
  "typical_tasks": [
    {
      "title": "Define Campaign Objectives",
      "description": "Establish SMART goals for the campaign (Specific, Measurable, Achievable, Relevant, Time-bound)",
      "deliverable": "Campaign objectives document with KPIs",
      "complexity": "low",
      "time": "2-4 hours"
    },
    {
      "title": "Research Target Audience",
      "description": "Gather demographic, psychographic, and behavioral data about target audience",
      "deliverable": "Audience persona profiles (1-3 personas)",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Analyze Competitors",
      "description": "Review competitor campaigns, positioning, messaging, and strategies",
      "deliverable": "Competitive analysis report",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Develop Value Proposition",
      "description": "Create unique value proposition and messaging framework",
      "deliverable": "Value proposition document and messaging guide",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Allocate Budget",
      "description": "Distribute budget across channels based on priorities and expected ROI",
      "deliverable": "Budget allocation spreadsheet",
      "complexity": "medium",
      "time": "1 day"
    },
    {
      "title": "Create Campaign Timeline",
      "description": "Develop detailed timeline with milestones and deadlines",
      "deliverable": "Campaign timeline/Gantt chart",
      "complexity": "low",
      "time": "2-4 hours"
    }
  ],
  "success_criteria": [
    "Campaign goals are SMART-compliant",
    "Target audience clearly defined with personas",
    "Competitive analysis completed with key insights",
    "Value proposition is unique and compelling",
    "Budget allocated with rationale documented",
    "Timeline is realistic with clear milestones"
  ],
  "dependencies": [],
  "next_phases": ["phase-content-strategy", "phase-seo-audit"]
}
```

---

## PHASE 2: CONTENT STRATEGY

```json
{
  "id": "phase-content-strategy",
  "name": "Content Strategy",
  "description": "Plan content that drives engagement, builds brand authority, and supports marketing goals.",
  "order": 2,
  "status": "planned",
  "duration": "2-3 weeks",
  "objectives": [
    "Audit existing content and identify gaps",
    "Develop content themes and pillars",
    "Create comprehensive content calendar",
    "Plan content formats and distribution channels",
    "Establish SEO keyword strategy",
    "Define content creation workflow"
  ],
  "typical_tasks": [
    {
      "title": "Audit Existing Content",
      "description": "Review all current content for performance, quality, and gaps",
      "deliverable": "Content audit report with recommendations",
      "complexity": "high",
      "time": "3-5 days"
    },
    {
      "title": "Develop Content Themes",
      "description": "Define content pillars and thematic focus areas",
      "deliverable": "Content themes and pillars document",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Create Content Calendar",
      "description": "Build 3-6 month content calendar with topics, formats, and deadlines",
      "deliverable": "Content calendar (spreadsheet or tool)",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Plan Content Formats",
      "description": "Determine content mix (blog posts, videos, social posts, emails, etc.)",
      "deliverable": "Content format strategy",
      "complexity": "low",
      "time": "1 day"
    },
    {
      "title": "Research SEO Keywords",
      "description": "Identify target keywords and topics for SEO optimization",
      "deliverable": "SEO keyword strategy document",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Define Content Workflow",
      "description": "Establish content creation, review, and approval process",
      "deliverable": "Content workflow template",
      "complexity": "low",
      "time": "1 day"
    },
    {
      "title": "Set Content Benchmarks",
      "description": "Establish performance benchmarks for content KPIs",
      "deliverable": "Content KPI benchmark document",
      "complexity": "low",
      "time": "1 day"
    }
  ],
  "success_criteria": [
    "Content audit completed with gap analysis",
    "Content themes align with business goals and audience needs",
    "Content calendar covers 3-6 months with consistent publishing schedule",
    "Content format mix supports campaign objectives",
    "SEO keywords identified with search volume and difficulty",
    "Content workflow is clear and repeatable",
    "Performance benchmarks established based on historical data or industry standards"
  ],
  "dependencies": ["phase-campaign-planning"],
  "next_phases": ["phase-seo-audit", "phase-social-media-strategy"]
}
```

---

## PHASE 3: SEO AUDIT

```json
{
  "id": "phase-seo-audit",
  "name": "SEO Audit",
  "description": "Optimize website and content for search engine visibility and organic traffic growth.",
  "order": 3,
  "status": "planned",
  "duration": "1-2 weeks",
  "objectives": [
    "Identify technical SEO issues",
    "Optimize on-page SEO elements",
    "Review content for keyword optimization",
    "Analyze backlink profile",
    "Identify content gaps and keyword opportunities",
    "Create prioritized SEO action plan"
  ],
  "typical_tasks": [
    {
      "title": "Conduct Technical SEO Audit",
      "description": "Crawl website to identify technical issues (crawl errors, page speed, mobile-friendliness)",
      "deliverable": "Technical SEO audit report",
      "complexity": "high",
      "time": "2-3 days"
    },
    {
      "title": "Analyze Page Speed",
      "description": "Test and optimize page load times (Core Web Vitals)",
      "deliverable": "Page speed analysis and optimization recommendations",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Review Meta Elements",
      "description": "Audit and optimize title tags, meta descriptions, headers",
      "deliverable": "Meta elements audit with optimization recommendations",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Audit Internal Linking",
      "description": "Review internal link structure and identify optimization opportunities",
      "deliverable": "Internal linking analysis and recommendations",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Analyze Keyword Usage",
      "description": "Review content for keyword optimization opportunities",
      "deliverable": "Keyword optimization report",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Audit Backlink Profile",
      "description": "Analyze quality and relevance of existing backlinks",
      "deliverable": "Backlink profile analysis",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Identify Content Gaps",
      "description": "Find keyword gaps and content opportunities competitors are targeting",
      "deliverable": "Content gap analysis",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Create SEO Action Plan",
      "description": "Prioritize SEO recommendations with estimated impact and effort",
      "deliverable": "Prioritized SEO action plan",
      "complexity": "medium",
      "time": "1-2 days"
    }
  ],
  "success_criteria": [
    "Technical SEO issues identified and prioritized",
    "Page speed benchmarks met (Core Web Vitals)",
    "Meta elements optimized for target keywords",
    "Internal linking structure improved",
    "Keyword optimization opportunities documented",
    "Backlink opportunities identified",
    "Content gaps and opportunities mapped",
    "SEO action plan is actionable and prioritized"
  ],
  "dependencies": ["phase-content-strategy"],
  "next_phases": ["phase-content-strategy", "phase-analytics-reporting"]
}
```

---

## PHASE 4: SOCIAL MEDIA STRATEGY

```json
{
  "id": "phase-social-media-strategy",
  "name": "Social Media Strategy",
  "description": "Build social media presence, engage audience, and drive brand awareness through strategic content.",
  "order": 4,
  "status": "planned",
  "duration": "2-3 weeks",
  "objectives": [
    "Select optimal social platforms based on audience",
    "Develop platform-specific content strategies",
    "Create social media content calendar",
    "Plan hashtag strategy for each platform",
    "Define social engagement workflow",
    "Set up social listening and monitoring"
  ],
  "typical_tasks": [
    {
      "title": "Research Audience Social Habits",
      "description": "Understand which platforms target audience uses and how",
      "deliverable": "Audience social media habits report",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Select Social Platforms",
      "description": "Choose which platforms to focus on based on audience and resources",
      "deliverable": "Platform selection strategy with rationale",
      "complexity": "low",
      "time": "1 day"
    },
    {
      "title": "Develop Platform-Specific Strategies",
      "description": "Create tailored content strategies for each platform",
      "deliverable": "Platform-specific strategy documents",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Create Social Content Calendar",
      "description": "Plan social media posts with themes, content, and posting times",
      "deliverable": "Social media content calendar",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Plan Hashtag Strategy",
      "description": "Research and plan hashtags for each platform",
      "deliverable": "Hashtag strategy by platform",
      "complexity": "low",
      "time": "1-2 days"
    },
    {
      "title": "Define Engagement Workflow",
      "description": "Establish how to respond to comments, mentions, and messages",
      "deliverable": "Social engagement workflow document",
      "complexity": "low",
      "time": "1 day"
    },
    {
      "title": "Set Up Social Listening",
      "description": "Configure monitoring tools for brand mentions and industry keywords",
      "deliverable": "Social listening configuration",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Establish Social KPIs",
      "description": "Define key metrics and benchmarks for social media performance",
      "deliverable": "Social media KPI benchmark document",
      "complexity": "low",
      "time": "1 day"
    }
  ],
  "success_criteria": [
    "Platform selection justified by audience research",
    "Platform-specific strategies align with platform best practices",
    "Content calendar provides consistent posting schedule",
    "Hashtag strategy optimized for each platform",
    "Engagement workflow ensures timely responses",
    "Social listening captures relevant mentions and trends",
    "KPIs are measurable and aligned with business goals"
  ],
  "dependencies": ["phase-campaign-planning", "phase-content-strategy"],
  "next_phases": ["phase-email-marketing", "phase-analytics-reporting"]
}
```

---

## PHASE 5: EMAIL MARKETING

```json
{
  "id": "phase-email-marketing",
  "name": "Email Marketing",
  "description": "Nurture leads, engage customers, and drive conversions through strategic email campaigns.",
  "order": 5,
  "status": "planned",
  "duration": "1-2 weeks",
  "objectives": [
    "Segment email list based on behavior and demographics",
    "Plan email campaigns (broadcasts, drips, welcome series)",
    "Craft compelling subject lines and email copy",
    "Design mobile-responsive email templates",
    "Set up email automation and trigger campaigns",
    "Ensure deliverability and compliance"
  ],
  "typical_tasks": [
    {
      "title": "Segment Email List",
      "description": "Divide subscribers into segments based on behavior, demographics, engagement",
      "deliverable": "Email segmentation strategy",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Plan Email Campaigns",
      "description": "Define email campaigns (newsletters, drips, promotions, welcome series)",
      "deliverable": "Email campaign calendar",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Craft Subject Lines",
      "description": "Write A/B test subject line variants (urgency, curiosity, benefit, personalization)",
      "deliverable": "Subject line variants for campaigns",
      "complexity": "low",
      "time": "1-2 days"
    },
    {
      "title": "Write Email Copy",
      "description": "Create compelling email copy with clear CTAs",
      "deliverable": "Email copy for all campaigns",
      "complexity": "medium",
      "time": "3-5 days"
    },
    {
      "title": "Design Email Templates",
      "description": "Build mobile-responsive email templates",
      "deliverable": "Email template designs",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Set Up Email Automation",
      "description": "Configure drip sequences, welcome series, and trigger campaigns",
      "deliverable": "Email automation workflows",
      "complexity": "high",
      "time": "3-5 days"
    },
    {
      "title": "Ensure Deliverability",
      "description": "Test email deliverability, configure SPF/DKIM/DMARC",
      "deliverable": "Deliverability test results",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Verify Compliance",
      "description": "Ensure CAN-SPAM, GDPR, CASL compliance",
      "deliverable": "Compliance checklist",
      "complexity": "low",
      "time": "1 day"
    },
    {
      "title": "Configure Email Tracking",
      "description": "Set up tracking for opens, clicks, conversions",
      "deliverable": "Email analytics configuration",
      "complexity": "low",
      "time": "1 day"
    }
  ],
  "success_criteria": [
    "Email segments are relevant and targeted",
    "Campaign calendar covers upcoming initiatives",
    "Subject lines are optimized for open rates",
    "Email copy is engaging and action-oriented",
    "Templates are mobile-responsive and on-brand",
    "Automation workflows are triggered correctly",
    "Deliverability rates are >95%",
    "All compliance requirements are met",
    "Tracking captures all key metrics"
  ],
  "dependencies": ["phase-campaign-planning", "phase-content-strategy"],
  "next_phases": ["phase-analytics-reporting"]
}
```

---

## PHASE 6: ANALYTICS & REPORTING

```json
{
  "id": "phase-analytics-reporting",
  "name": "Analytics & Reporting",
  "description": "Measure marketing performance, track KPIs, and optimize campaigns based on data-driven insights.",
  "order": 6,
  "status": "planned",
  "duration": "Ongoing (weekly, monthly, quarterly)",
  "objectives": [
    "Set up analytics tracking across all channels",
    "Define marketing dashboards and reports",
    "Establish KPIs and performance benchmarks",
    "Conduct regular performance reviews",
    "Analyze campaign results and ROI",
    "Generate actionable optimization recommendations"
  ],
  "typical_tasks": [
    {
      "title": "Configure Analytics Tracking",
      "description": "Set up GA4, social pixels, email tracking, UTM parameters",
      "deliverable": "Analytics tracking configuration",
      "complexity": "high",
      "time": "2-3 days"
    },
    {
      "title": "Define Marketing KPIs",
      "description": "Establish key performance indicators aligned with business goals",
      "deliverable": "KPI definition document",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Create Marketing Dashboard",
      "description": "Build dashboard(s) with key metrics and visualizations",
      "deliverable": "Marketing dashboard (Google Data Studio, etc.)",
      "complexity": "medium",
      "time": "2-3 days"
    },
    {
      "title": "Set Up Automated Reports",
      "description": "Configure automated weekly, monthly, quarterly reports",
      "deliverable": "Automated report configuration",
      "complexity": "low",
      "time": "1 day"
    },
    {
      "title": "Conduct Weekly Performance Review",
      "description": "Review weekly metrics, identify issues and opportunities",
      "deliverable": "Weekly performance report",
      "complexity": "low",
      "time": "2-3 hours/week"
    },
    {
      "title": "Analyze Campaign Results",
      "description": "Deep dive into campaign performance, what worked/what didn't",
      "deliverable": "Campaign analysis report",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Identify Optimization Opportunities",
      "description": "Find areas for improvement based on data analysis",
      "deliverable": "Optimization recommendations",
      "complexity": "medium",
      "time": "1-2 days"
    },
    {
      "title": "Present Insights to Stakeholders",
      "description": "Share findings and recommendations with team/management",
      "deliverable": "Stakeholder presentation",
      "complexity": "medium",
      "time": "1 day"
    },
    {
      "title": "Update Strategy Based on Data",
      "description": "Adjust marketing strategy and tactics based on insights",
      "deliverable": "Updated strategy document",
      "complexity": "medium",
      "time": "1-2 days"
    }
  ],
  "success_criteria": [
    "Analytics tracking covers all marketing channels",
    "KPIs are measurable and aligned with business goals",
    "Dashboards provide real-time visibility into performance",
    "Automated reports run on schedule",
    "Performance reviews identify actionable insights",
    "Campaign analysis leads to optimization",
    "Stakeholders receive clear, data-driven recommendations",
    "Strategy evolves based on performance data"
  ],
  "dependencies": ["phase-campaign-planning", "phase-content-strategy", "phase-social-media-strategy", "phase-email-marketing"],
  "next_phases": []
}
```

---

## PHASE SELECTION GUIDE

When generating a marketing roadmap, select phases based on the marketer's needs:

**For New Campaigns:**
1. Campaign Planning → Content Strategy → Social Media Strategy → Email Marketing → Analytics

**For Content-Focused Initiatives:**
1. Content Strategy → SEO Audit → Analytics

**For Social Media Growth:**
1. Campaign Planning → Social Media Strategy → Analytics

**For Email List Building:**
1. Campaign Planning → Email Marketing → Analytics

**For SEO Improvement:**
1. SEO Audit → Content Strategy → Analytics

**For Full Marketing Overhaul:**
1. Campaign Planning → Content Strategy → SEO Audit → Social Media Strategy → Email Marketing → Analytics

**For Ongoing Optimization:**
1. Analytics & Reporting (with recommendations feeding back into other phases)
