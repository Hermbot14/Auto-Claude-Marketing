# Platform Integrations Setup Guide

**Marketing Hub v1.0.0** - Complete platform integration documentation

---

## Overview

Marketing Hub includes integrations with 15+ marketing platforms across 4 categories:

- **Social Media** (4 platforms)
- **Email Marketing** (3 platforms)
- **Analytics** (3 platforms)
- **Advertising** (3 platforms)
- **SEO Tools** (5 integrations)

---

## Quick Setup Checklist

- [ ] Configure social media platforms
- [ ] Configure email platforms
- [ ] Configure analytics platforms
- [ ] Configure advertising platforms
- [ ] Configure SEO tools
- [ ] Test all integrations
- [ ] Set up webhooks (optional)

---

## 1. Social Media Integrations

### Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| Twitter/X | ✅ Complete | Post, schedule, analytics |
| LinkedIn | ✅ Complete | Post, schedule, analytics |
| Instagram | ✅ Complete | Post, schedule, analytics |
| Facebook | ✅ Complete | Post, schedule, analytics |

### Twitter/X Integration

**Location:** `apps/backend/integrations/social/twitter.py`

**Required Credentials:**
```bash
# apps/backend/.env
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-secret
TWITTER_BEARER_TOKEN=your-bearer-token
```

**Setup Steps:**

1. **Create Twitter Developer Account:**
   - Go to https://developer.twitter.com/
   - Apply for developer access
   - Create a new app

2. **Get API Credentials:**
   - Navigate to your app dashboard
   - Copy API Key, API Secret, Bearer Token
   - Generate Access Token and Secret

3. **Configure Marketing Hub:**
   - Add credentials to `.env` file
   - Or use API Settings UI in the app

4. **Test Integration:**
   ```python
   from integrations.social.twitter import TwitterPlatform
   from integrations.social.factory import SocialPlatformFactory

   # Initialize
   twitter = SocialPlatformFactory.create_platform('twitter', {
       'api_key': 'your-key',
       'api_secret': 'your-secret',
       'access_token': 'your-token',
       'access_secret': 'your-secret'
   })

   # Test connection
   if twitter.connect():
       print("✓ Twitter connected")

       # Test post
       result = twitter.post("Test post from Marketing Hub")
       print(f"✓ Post created: {result['id']}")
   ```

**Features:**
- Post tweets (text, images, videos)
- Schedule posts
- Get analytics (impressions, engagements)
- Delete posts
- Reply to tweets

**Rate Limits:**
- Post: 300 tweets/3 hours
- Read: 900 requests/15 minutes

### LinkedIn Integration

**Location:** `apps/backend/integrations/social/linkedin.py`

**Required Credentials:**
```bash
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/callback
LINKEDIN_ACCESS_TOKEN=your-access-token
```

**Setup Steps:**

1. **Create LinkedIn Developer Account:**
   - Go to https://www.linkedin.com/developers/
   - Create a new app
   - Select permissions: `r_liteprofile`, `w_member_social`

2. **Get API Credentials:**
   - Copy Client ID and Client Secret
   - Set Redirect URI

3. **Configure Marketing Hub:**
   - Add credentials to `.env` file

4. **Test Integration:**
   ```python
   from integrations.social.linkedin import LinkedInPlatform

   linkedin = LinkedInPlatform({
       'client_id': 'your-id',
       'client_secret': 'your-secret',
       'access_token': 'your-token'
   })

   if linkedin.connect():
       # Test post
       result = linkedin.post("Test post from Marketing Hub")
       print(f"✓ Post created: {result['id']}")
   ```

**Features:**
- Post to personal profile
- Post to company pages
- Schedule posts
- Get analytics

### Instagram Integration

**Location:** `apps/backend/integrations/social/instagram.py`

**Required Credentials:**
```bash
INSTAGRAM_BUSINESS_ID=your-business-id
INSTAGRAM_ACCESS_TOKEN=your-access-token
FACEBOOK_PAGE_ID=your-page-id
```

**Setup Steps:**

1. **Convert to Instagram Business Account:**
   - Go to Instagram profile → Settings → Account
   - Switch to Professional Account
   - Connect to Facebook Page

2. **Create Facebook App:**
   - Go to https://developers.facebook.com/
   - Create new app
   - Add Instagram Graph API

3. **Get Access Token:**
   - Use Instagram Graph API Explorer
   - Generate long-lived access token (60 days)

4. **Configure Marketing Hub:**
   - Add credentials to `.env` file

5. **Test Integration:**
   ```python
   from integrations.social.instagram import InstagramPlatform

   instagram = InstagramPlatform({
       'business_id': 'your-id',
       'access_token': 'your-token'
   })

   if instagram.connect():
       # Test post (requires image URL)
       result = instagram.post(
           "Test post from Marketing Hub",
           image_url="https://example.com/image.jpg"
       )
       print(f"✓ Post created: {result['id']}")
   ```

**Features:**
- Post images and videos
- Schedule posts
- Get analytics (impressions, reach, engagement)
- Multiple image carousel posts

### Facebook Integration

**Location:** `apps/backend/integrations/social/facebook.py`

**Required Credentials:**
```bash
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_ACCESS_TOKEN=your-access-token
FACEBOOK_PAGE_ID=your-page-id
```

**Setup Steps:**

1. **Create Facebook App:**
   - Go to https://developers.facebook.com/
   - Create new app
   - Add Facebook Login product

2. **Get Page Access Token:**
   - Use Graph API Explorer
   - Generate page access token
   - Select permissions: `pages_read_engagement`, `pages_manage_posts`

3. **Configure Marketing Hub:**
   - Add credentials to `.env` file

4. **Test Integration:**
   ```python
   from integrations.social.facebook import FacebookPlatform

   facebook = FacebookPlatform({
       'app_id': 'your-id',
       'app_secret': 'your-secret',
       'access_token': 'your-token',
       'page_id': 'your-page-id'
   })

   if facebook.connect():
       result = facebook.post("Test post from Marketing Hub")
       print(f"✓ Post created: {result['id']}")
   ```

**Features:**
- Post to pages
- Schedule posts
- Get analytics
- Post with images/videos

---

## 2. Email Platform Integrations

### Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| Mailchimp | ✅ Complete | Campaigns, lists, automation |
| SendGrid | ✅ Complete | Emails, templates, analytics |
| ConvertKit | ✅ Complete | Broadcasts, sequences, forms |

### Mailchimp Integration

**Location:** `apps/backend/integrations/email/mailchimp.py`

**Required Credentials:**
```bash
MAILCHIMP_API_KEY=your-api-key-us19
MAILCHIMP_DC=us19  # Data center from API key suffix
```

**Setup Steps:**

1. **Get API Key:**
   - Go to https://admin.mailchimp.com/account/api/
   - Create an API key
   - Note the data center (e.g., `us19`)

2. **Configure Marketing Hub:**
   ```bash
   MAILCHIMP_API_KEY=abc123xyz-us19
   ```

3. **Test Integration:**
   ```python
   from integrations.email.mailchimp import MailchimpProvider

   mailchimp = MailchimpProvider({
       'api_key': 'your-key'
   })

   if mailchimp.connect():
       # Get lists
       lists = mailchimp.get_lists()
       print(f"✓ Found {len(lists)} lists")

       # Create campaign
       campaign = mailchimp.create_campaign(
           subject="Test Campaign",
           from_name="Marketing Hub",
           reply_to="noreply@example.com",
           html_content="<h1>Hello</h1>"
       )
       print(f"✓ Campaign created: {campaign['id']}")
   ```

**Features:**
- Create and send campaigns
- Manage subscriber lists
- Add/remove subscribers
- Get campaign analytics
- Create automation workflows

**Rate Limits:**
- Multi-factor authentication: 10 connections per second
- OAuth 2: 10 connections per second

### SendGrid Integration

**Location:** `apps/backend/integrations/email/sendgrid.py`

**Required Credentials:**
```bash
SENDGRID_API_KEY=SG.your-api-key-here
```

**Setup Steps:**

1. **Get API Key:**
   - Go to https://app.sendgrid.com/settings/api_keys
   - Create API key with "Mail Send" permissions
   - Copy the key (starts with `SG.`)

2. **Configure Marketing Hub:**
   ```bash
   SENDGRID_API_KEY=SG.abc123xyz
   ```

3. **Test Integration:**
   ```python
   from integrations.email.sendgrid import SendGridProvider

   sendgrid = SendGridProvider({
       'api_key': 'SG.your-key'
   })

   if sendgrid.connect():
       # Send email
       result = sendgrid.send_email(
           to="user@example.com",
           subject="Test from Marketing Hub",
           html_content="<h1>Hello</h1>"
       )
       print(f"✓ Email sent: {result['message_id']}")
   ```

**Features:**
- Send individual emails
- Send bulk emails
- Use templates
- Get email analytics
- Manage contacts

**Rate Limits:**
- Free: 100 emails/day
- Pro: 50,000 emails/month
- Premier: Custom

### ConvertKit Integration

**Location:** `apps/backend/integrations/email/convertkit.py`

**Required Credentials:**
```bash
CONVERTKIT_API_SECRET=your-api-secret
```

**Setup Steps:**

1. **Get API Secret:**
   - Go to https://app.convertkit.com/account_settings/advanced_settings
   - Copy your API secret

2. **Configure Marketing Hub:**
   ```bash
   CONVERTKIT_API_SECRET=your-secret
   ```

3. **Test Integration:**
   ```python
   from integrations.email.convertkit import ConvertKitProvider

   convertkit = ConvertKitProvider({
       'api_secret': 'your-secret'
   })

   if convertkit.connect():
       # Create broadcast
       broadcast = convertkit.create_broadcast(
           subject="Test Broadcast",
           content="<h1>Hello from Marketing Hub</h1>"
       )
       print(f"✓ Broadcast created: {broadcast['id']}")
   ```

**Features:**
- Create and send broadcasts
- Manage email sequences
- Add subscribers to forms
- Get subscriber analytics
- Tag subscribers

---

## 3. Analytics Platform Integrations

### Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| Google Analytics 4 | ✅ Complete | Events, conversions, reports |
| Mixpanel | ✅ Complete | Events, funnels, retention |
| Amplitude | ✅ Complete | Events, cohorts, analysis |

### Google Analytics 4 Integration

**Location:** `apps/backend/integrations/analytics/ga4.py`

**Required Credentials:**
```bash
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_JSON_KEY_PATH=/path/to/service-account.json
GA4_PROPERTY_ID=123456789
```

**Setup Steps:**

1. **Create GA4 Property:**
   - Go to https://analytics.google.com/
   - Create GA4 property
   - Copy Measurement ID (starts with `G-`)

2. **Create Service Account:**
   - Go to https://console.cloud.google.com/
   - Create service account
   - Download JSON key file
   - Enable Analytics API

3. **Add Service Account to GA4:**
   - In GA4 Admin → Property Access Management
   - Add service account email
   - Grant "Viewer" permissions

4. **Configure Marketing Hub:**
   ```bash
   GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   GA4_PROPERTY_ID=123456789
   GA4_API_JSON_KEY_PATH=/path/to/key.json
   ```

5. **Test Integration:**
   ```python
   from integrations.analytics.ga4 import GA4Provider

   ga4 = GA4Provider({
       'measurement_id': 'G-XXXXXXXXXX',
       'property_id': '123456789',
       'json_key_path': '/path/to/key.json'
   })

   if ga4.connect():
       # Get page views
       report = ga4.get_report(
           start_date='7daysAgo',
           end_date='today',
           metrics=['pageviews', 'sessions']
       )
       print(f"✓ Page views: {report['pageviews']}")
   ```

**Features:**
- Track events and page views
- Get custom reports
- Query real-time data
- Conversion tracking

### Mixpanel Integration

**Location:** `apps/backend/integrations/analytics/mixpanel.py`

**Required Credentials:**
```bash
MIXPANEL_TOKEN=your-token
MIXPANEL_API_SECRET=your-secret
```

**Setup Steps:**

1. **Get Project Credentials:**
   - Go to https://mixpanel.com/settings/project
   - Copy Token
   - Go to Settings → Service Accounts
   - Copy API Secret

2. **Configure Marketing Hub:**
   ```bash
   MIXPANEL_TOKEN=your-token
   MIXPANEL_API_SECRET=your-secret
   ```

3. **Test Integration:**
   ```python
   from integrations.analytics.mixpanel import MixpanelProvider

   mixpanel = MixpanelProvider({
       'token': 'your-token',
       'api_secret': 'your-secret'
   })

   if mixpanel.connect():
       # Track event
       mixpanel.track_event(
           event_name="campaign_viewed",
           properties={"campaign_id": "123"}
       )

       # Get analytics
       data = mixpanel.get_event_counts(
           event_name="campaign_viewed",
           from_date="2024-01-01"
       )
       print(f"✓ Events: {data['total']}")
   ```

**Features:**
- Track events
- Create funnels
- Retention analysis
- Cohort analysis

### Amplitude Integration

**Location:** `apps/backend/integrations/analytics/amplitude.py`

**Required Credentials:**
```bash
AMPLITUDE_API_KEY=your-api-key
AMPLITUDE_SECRET_KEY=your-secret-key
```

**Setup Steps:**

1. **Get API Keys:**
   - Go to https://analytics.amplitude.com/settings/project
   - Copy API Key and Secret Key

2. **Configure Marketing Hub:**
   ```bash
   AMPLITUDE_API_KEY=your-key
   AMPLITUDE_SECRET_KEY=your-secret
   ```

3. **Test Integration:**
   ```python
   from integrations.analytics.amplitude import AmplitudeProvider

   amplitude = AmplitudeProvider({
       'api_key': 'your-key',
       'secret_key': 'your-secret'
   })

   if amplitude.connect():
       # Track event
       amplitude.track_event(
           event_type="campaign_viewed",
           user_id="user123",
           properties={"campaign_id": "123"}
       )

       # Get analytics
       data = amplitude.get_event_stats(
           event_type="campaign_viewed"
       )
       print(f"✓ Events: {data['total']}")
   ```

**Features:**
- Track events
- User segmentation
- Cohort analysis
- Custom dashboards

---

## 4. Advertising Platform Integrations

### Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| Google Ads | ✅ Complete | Campaigns, ads, keywords |
| Meta Ads | ✅ Complete | Facebook & Instagram ads |
| LinkedIn Ads | ✅ Complete | Sponsored content, message ads |

### Google Ads Integration

**Location:** `apps/backend/integrations/ads/google_ads.py`

**Required Credentials:**
```bash
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_CLIENT_ID=your-client-id
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
```

**Setup Steps:**

1. **Create Google Ads Manager Account:**
   - Go to https://ads.google.com/
   - Create manager account

2. **Create Google Cloud Project:**
   - Go to https://console.cloud.google.com/
   - Create project
   - Enable Google Ads API

3. **Get OAuth Credentials:**
   - Create OAuth 2.0 credentials
   - Set up consent screen
   - Copy Client ID and Secret

4. **Get Developer Token:**
   - Apply for Google Ads API access
   - Wait for approval (may take 1-2 days)

5. **Configure Marketing Hub:**
   ```bash
   GOOGLE_ADS_DEVELOPER_TOKEN=your-token
   GOOGLE_ADS_CLIENT_ID=your-id
   GOOGLE_ADS_CLIENT_SECRET=your-secret
   GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
   GOOGLE_ADS_CUSTOMER_ID=123-456-7890
   ```

6. **Test Integration:**
   ```python
   from integrations.ads.google_ads import GoogleAdsProvider

   google_ads = GoogleAdsProvider({
       'developer_token': 'your-token',
       'client_id': 'your-id',
       'client_secret': 'your-secret',
       'refresh_token': 'your-refresh-token',
       'customer_id': '123-456-7890'
   })

   if google_ads.connect():
       # Get campaigns
       campaigns = google_ads.get_campaigns()
       print(f"✓ Found {len(campaigns)} campaigns")
   ```

**Features:**
- Create and manage campaigns
- Create ad groups and ads
- Keyword research
- Get performance metrics

### Meta Ads Integration

**Location:** `apps/backend/integrations/ads/meta_ads.py`

**Required Credentials:**
```bash
META_ADS_APP_ID=your-app-id
META_ADS_APP_SECRET=your-app-secret
META_ADS_ACCESS_TOKEN=your-access-token
META_ADS_AD_ACCOUNT_ID=act_123456789
```

**Setup Steps:**

1. **Create Meta Business Account:**
   - Go to https://business.facebook.com/
   - Create business account

2. **Create Facebook App:**
   - Go to https://developers.facebook.com/
   - Create app
   - Add Marketing API product

3. **Get Access Token:**
   - Use Graph API Explorer
   - Generate long-lived access token

4. **Configure Marketing Hub:**
   ```bash
   META_ADS_APP_ID=your-id
   META_ADS_APP_SECRET=your-secret
   META_ADS_ACCESS_TOKEN=your-token
   META_ADS_AD_ACCOUNT_ID=act_123456789
   ```

5. **Test Integration:**
   ```python
   from integrations.ads.meta_ads import MetaAdsProvider

   meta_ads = MetaAdsProvider({
       'app_id': 'your-id',
       'app_secret': 'your-secret',
       'access_token': 'your-token',
       'ad_account_id': 'act_123456789'
   })

   if meta_ads.connect():
       # Get campaigns
       campaigns = meta_ads.get_campaigns()
       print(f"✓ Found {len(campaigns)} campaigns")
   ```

**Features:**
- Create and manage campaigns
- Create ad sets and ads
- Targeting options
- Get performance metrics
- Facebook and Instagram ads

### LinkedIn Ads Integration

**Location:** `apps/backend/integrations/ads/linkedin_ads.py`

**Required Credentials:**
```bash
LINKEDIN_ADS_CLIENT_ID=your-client-id
LINKEDIN_ADS_CLIENT_SECRET=your-client-secret
LINKEDIN_ADS_ACCESS_TOKEN=your-access-token
LINKEDIN_ADS_ACCOUNT_ID=123456789
```

**Setup Steps:**

1. **Create LinkedIn Campaign Manager Account:**
   - Go to https://www.linkedin.com/ad-account/create/
   - Create ad account

2. **Create LinkedIn Developer App:**
   - Go to https://www.linkedin.com/developers/
   - Create app
   - Add Marketing Developer API

3. **Get Access Token:**
   - Use OAuth 2.0 flow
   - Generate long-lived access token

4. **Configure Marketing Hub:**
   ```bash
   LINKEDIN_ADS_CLIENT_ID=your-id
   LINKEDIN_ADS_CLIENT_SECRET=your-secret
   LINKEDIN_ADS_ACCESS_TOKEN=your-token
   LINKEDIN_ADS_ACCOUNT_ID=123456789
   ```

5. **Test Integration:**
   ```python
   from integrations.ads.linkedin_ads import LinkedInAdsProvider

   linkedin_ads = LinkedInAdsProvider({
       'client_id': 'your-id',
       'client_secret': 'your-secret',
       'access_token': 'your-token',
       'account_id': '123456789'
   })

   if linkedin_ads.connect():
       # Get campaigns
       campaigns = linkedin_ads.get_campaigns()
       print(f"✓ Found {len(campaigns)} campaigns")
   ```

**Features:**
- Create and manage campaigns
- Create ad creatives
- Targeting options
- Get performance metrics

---

## 5. SEO Tools Integration

### Location: `apps/backend/integrations/seo/`

### Components

| Component | Purpose | File |
|-----------|---------|------|
| Keyword Research | Find search keywords | `keyword_research.py` |
| Competitor Analyzer | Analyze competitor SEO | `competitor_analyzer.py` |
| On-Page Analyzer | Analyze page SEO | `on_page_analyzer.py` |
| Rank Tracker | Track keyword rankings | `rank_tracker.py` |
| Backlink Tracker | Monitor backlinks | `backlink_tracker.py` |

### Setup

**Required Credentials (optional - depends on tools used):**
```bash
SEO_TOOLS_API_KEY=your-api-key
SEO_TOOLS_ENABLED=true
```

### Usage Example

```python
from integrations.seo.keyword_research import KeywordResearcher
from integrations.seo.competitor_analyzer import CompetitorAnalyzer

# Keyword research
researcher = KeywordResearcher()
keywords = researcher.find_keywords("marketing automation")
print(f"✓ Found {len(keywords)} keywords")

# Competitor analysis
analyzer = CompetitorAnalyzer()
analysis = analyzer.analyze("https://competitor.com")
print(f"✓ Analyzed competitor: {analysis['domain_authority']}")
```

---

## Testing All Integrations

### Automated Test Script

```python
#!/usr/bin/env python3
"""
Test all Marketing Hub platform integrations.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_social_platforms():
    """Test all social media platforms."""
    from integrations.social.factory import SocialPlatformFactory

    platforms = ['twitter', 'linkedin', 'instagram', 'facebook']
    results = {}

    for platform in platforms:
        try:
            client = SocialPlatformFactory.create_platform(platform)
            if client.connect():
                results[platform] = "✓ Connected"
            else:
                results[platform] = "✗ Failed to connect"
        except Exception as e:
            results[platform] = f"✗ Error: {e}"

    return results

def test_email_platforms():
    """Test all email platforms."""
    from integrations.email.factory import EmailPlatformFactory

    platforms = ['mailchimp', 'sendgrid', 'convertkit']
    results = {}

    for platform in platforms:
        try:
            client = EmailPlatformFactory.create_platform(platform)
            if client.connect():
                results[platform] = "✓ Connected"
            else:
                results[platform] = "✗ Failed to connect"
        except Exception as e:
            results[platform] = f"✗ Error: {e}"

    return results

def test_analytics_platforms():
    """Test all analytics platforms."""
    from integrations.analytics.factory import AnalyticsPlatformFactory

    platforms = ['ga4', 'mixpanel', 'amplitude']
    results = {}

    for platform in platforms:
        try:
            client = AnalyticsPlatformFactory.create_platform(platform)
            if client.connect():
                results[platform] = "✓ Connected"
            else:
                results[platform] = "✗ Failed to connect"
        except Exception as e:
            results[platform] = f"✗ Error: {e}"

    return results

def test_ads_platforms():
    """Test all advertising platforms."""
    from integrations.ads.factory import AdsPlatformFactory

    platforms = ['google_ads', 'meta_ads', 'linkedin_ads']
    results = {}

    for platform in platforms:
        try:
            client = AdsPlatformFactory.create_platform(platform)
            if client.connect():
                results[platform] = "✓ Connected"
            else:
                results[platform] = "✗ Failed to connect"
        except Exception as e:
            results[platform] = f"✗ Error: {e}"

    return results

if __name__ == '__main__':
    print("Testing Marketing Hub Platform Integrations\n")
    print("=" * 50)

    print("\n📱 Social Media Platforms:")
    social_results = test_social_platforms()
    for platform, result in social_results.items():
        print(f"  {platform}: {result}")

    print("\n📧 Email Platforms:")
    email_results = test_email_platforms()
    for platform, result in email_results.items():
        print(f"  {platform}: {result}")

    print("\n📊 Analytics Platforms:")
    analytics_results = test_analytics_platforms()
    for platform, result in analytics_results.items():
        print(f"  {platform}: {result}")

    print("\n📢 Advertising Platforms:")
    ads_results = test_ads_platforms()
    for platform, result in ads_results.items():
        print(f"  {platform}: {result}")

    print("\n" + "=" * 50)
    print("✓ Integration testing complete")
```

---

## Troubleshooting

### Common Issues

**Issue: "Authentication Failed"**
- Verify API keys are correct
- Check for whitespace in keys
- Ensure keys have proper permissions
- Regenerate keys if expired

**Issue: "Rate Limit Exceeded"**
- Implement request throttling
- Use caching for frequent requests
- Upgrade API tier if needed

**Issue: "Webhook Not Received"**
- Verify webhook URL is accessible
- Check firewall allows incoming requests
- Ensure webhook is registered with platform

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# apps/backend/.env
DEBUG=true
LOG_LEVEL=debug
VERBOSE_LOGGING=true
```

---

## Security Best Practices

1. **Never commit API keys to git**
   - Use `.env` files
   - Add to `.gitignore`
   - Use environment variables

2. **Rotate credentials regularly**
   - Set calendar reminders
   - Document rotation procedures

3. **Use read-only access when possible**
   - Limit permissions to minimum required
   - Use separate keys for dev/prod

4. **Monitor API usage**
   - Set up alerts for unusual activity
   - Track rate limit usage
   - Review access logs

---

## Summary

Marketing Hub v1.0.0 includes 15+ platform integrations:

- **Social Media:** Twitter, LinkedIn, Instagram, Facebook
- **Email:** Mailchimp, SendGrid, ConvertKit
- **Analytics:** Google Analytics 4, Mixpanel, Amplitude
- **Advertising:** Google Ads, Meta Ads, LinkedIn Ads
- **SEO Tools:** Keyword research, competitor analysis, rank tracking

All integrations follow consistent patterns and can be extended with additional platforms.

For additional help:
- [API Configuration Guide](API_CONFIGURATION.md)
- [Migration Guide](MIGRATION_GUIDE.md)
- [Validation Report](../MARKETING_HUB_VALIDATION_REPORT.md)

---

**Last Updated:** 2026-01-24
**Version:** 1.0.0
