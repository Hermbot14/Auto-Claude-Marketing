# Service Boundaries - Domain-Driven Design

## Overview

This document defines the service boundaries for the Auto Claude Marketing Hub microservices architecture using Domain-Driven Design (DDD) principles.

## Domain Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Marketing Hub Bounded Context                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Campaign   │  │   Content    │  │  Analytics   │           │
│  │   Service    │  │   Service    │  │   Service    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                      │
│                            │                                         │
│                   ┌────────▼────────┐                              │
│                   │  API Gateway    │                              │
│                   └────────┬────────┘                              │
│                            │                                         │
│  ┌──────────────┐  ┌──────▼──────┐  ┌──────────────┐           │
│  │  Notificati  │  │ Integration  │  │   Service    │           │
│  │    on        │  │   Service    │  │  Discovery   │           │
│  └──────────────┘  └─────────────┘  └──────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Service Boundaries

### 1. Campaign Service
**Bounded Context:** Campaign Management

**Core Domain:** Campaign lifecycle, scheduling, targeting

**Responsibilities:**
- Campaign CRUD operations
- Campaign scheduling and execution
- Audience targeting and segmentation
- Campaign performance tracking
- A/B test management

**Entities:**
- Campaign
- CampaignSchedule
- AudienceSegment
- ABTest
- CampaignMetric

**Technology Stack:**
- Language: Python 3.12+
- Framework: FastAPI
- Database: PostgreSQL
- Cache: Redis

**API Endpoints:**
```
POST   /api/campaigns              # Create campaign
GET    /api/campaigns              # List campaigns
GET    /api/campaigns/{id}         # Get campaign details
PUT    /api/campaigns/{id}         # Update campaign
DELETE /api/campaigns/{id}         # Delete campaign
POST   /api/campaigns/{id}/launch  # Launch campaign
POST   /api/campaigns/{id}/pause   # Pause campaign
POST   /api/campaigns/{id}/resume  # Resume campaign
GET    /api/campaigns/{id}/metrics # Get campaign metrics
```

**Dependencies:**
- Content Service (for campaign content)
- Analytics Service (for performance data)
- Notification Service (for status updates)

---

### 2. Content Service
**Bounded Context:** Content Management

**Core Domain:** Content creation, storage, distribution

**Responsibilities:**
- Content template management
- Content generation and editing
- Media storage (images, videos)
- Content approval workflow
- Content versioning

**Entities:**
- ContentTemplate
- ContentItem
- MediaAsset
- ContentVersion
- ApprovalWorkflow

**Technology Stack:**
- Language: Node.js 20+
- Framework: Express
- Database: MongoDB
- Storage: S3-compatible

**API Endpoints:**
```
POST   /api/content/templates        # Create template
GET    /api/content/templates        # List templates
GET    /api/content/{id}            # Get content
PUT    /api/content/{id}            # Update content
DELETE /api/content/{id}            # Delete content
POST   /api/content/{id}/approve    # Approve content
POST   /api/content/{id}/reject     # Reject content
POST   /api/content/{id}/publish    # Publish content
GET    /api/content/{id}/versions   # Get content versions
```

**Dependencies:**
- S3 or MinIO (for media storage)
- Campaign Service (for content assignment)

---

### 3. Analytics Service
**Bounded Context:** Analytics and Reporting

**Core Domain:** Data collection, aggregation, visualization

**Responsibilities:**
- Event tracking and collection
- Metric aggregation and computation
- Report generation
- Dashboard data
- Export functionality

**Entities:**
- Event
- Metric
- Report
- Dashboard
- DataExport

**Technology Stack:**
- Language: Python 3.12+
- Framework: FastAPI
- Processing: Pandas, NumPy
- Database: TimescaleDB (PostgreSQL extension)
- Cache: Redis

**API Endpoints:**
```
POST   /api/analytics/events        # Track event
GET    /api/analytics/metrics       # Get metrics
GET    /api/analytics/reports       # List reports
POST   /api/analytics/reports       # Generate report
GET    /api/analytics/dashboards    # Get dashboard data
GET    /api/analytics/export       # Export data
GET    /api/analytics/trends       # Get trend analysis
```

**Dependencies:**
- Campaign Service (for campaign analytics)
- Content Service (for content analytics)

---

### 4. Notification Service
**Bounded Context:** Notification and Alerting

**Core Domain:** Multi-channel notifications

**Responsibilities:**
- Email notifications
- SMS notifications
- Push notifications
- In-app notifications
- Notification preferences
- Delivery tracking

**Entities:**
- Notification
- NotificationTemplate
- DeliveryReceipt
- NotificationPreference
- NotificationQueue

**Technology Stack:**
- Language: Go 1.21+
- Framework: Gorilla Mux
- Database: PostgreSQL
- Queue: Redis / RabbitMQ
- Email: SendGrid / AWS SES

**API Endpoints:**
```
POST   /api/notifications           # Send notification
GET    /api/notifications           # List notifications
GET    /api/notifications/{id}      # Get notification
PUT   /api/notifications/{id}/read   # Mark as read
POST   /api/notifications/templates # Create template
GET    /api/notifications/preferences # Get preferences
PUT    /api/notifications/preferences # Update preferences
```

**Dependencies:**
- External providers (SendGrid, Twilio, FCM)
- All services (for event-based notifications)

---

### 5. Integration Service
**Bounded Context:** Third-Party Integrations

**Core Domain:** External service connectors

**Responsibilities:**
- OAuth flow management
- API client management
- Webhook handling
- Rate limiting
- Error handling and retry logic

**Entities:**
- Integration
- OAuthToken
- Webhook
- ApiClient
- RateLimit

**Technology Stack:**
- Language: Python 3.12+
- Framework: FastAPI
- Database: PostgreSQL
- Cache: Redis

**API Endpoints:**
```
POST   /api/integrations/connect     # Connect integration
GET    /api/integrations            # List integrations
GET    /api/integrations/{id}       # Get integration
DELETE /api/integrations/{id}       # Disconnect integration
POST   /api/integrations/{id}/sync   # Sync data
POST   /api/integrations/webhooks   # Handle webhooks
GET    /api/integrations/{id}/status # Get integration status
```

**Supported Integrations:**
- GitHub
- Slack
- Discord
- HubSpot
- Mailchimp
- Google Analytics

**Dependencies:**
- All services (for integration triggers)

---

### 6. API Gateway
**Bounded Context:** Entry Point and Routing

**Core Domain:** Request routing, authentication, rate limiting

**Responsibilities:**
- Request routing
- Authentication and authorization
- Rate limiting
- Request/response transformation
- API versioning
- CORS handling

**Technology Stack:**
- Gateway: Nginx / Kong
- Auth: JWT
- Rate Limiting: Redis

**Routes:**
```
/campaign/*    → Campaign Service
/content/*     → Content Service
/analytics/*   → Analytics Service
/notifications/* → Notification Service
/integrations/*  → Integration Service
/health        → Health check endpoint
```

---

### 7. Service Discovery
**Bounded Context:** Service Registry

**Core Domain:** Service registration and discovery

**Responsibilities:**
- Service registration
- Health checking
- Load balancing
- Service metadata

**Technology Stack:**
- Registry: Consul
- Health Check: HTTP endpoints
- Load Balancing: Client-side

---

## Data Ownership

| Data Entity                 | Owner Service        | Access Pattern      |
|-----------------------------|----------------------|---------------------|
| Campaigns                   | Campaign Service     | Owner               |
| Campaign Schedules          | Campaign Service     | Owner               |
| Audience Segments           | Campaign Service     | Owner               |
| Content Templates           | Content Service      | Owner               |
| Content Items              | Content Service      | Owner               |
| Media Assets               | Content Service      | Owner               |
| Events                     | Analytics Service    | Owner               |
| Metrics                    | Analytics Service    | Owner               |
| Notifications              | Notification Service | Owner               |
| Notification Templates     | Notification Service | Owner               |
| Integrations               | Integration Service  | Owner               |
| OAuth Tokens               | Integration Service  | Owner               |

## Cross-Cutting Concerns

### Authentication
- Centralized authentication via API Gateway
- JWT tokens for service-to-service communication
- OAuth 2.0 for external integrations

### Observability
- Distributed tracing (OpenTelemetry)
- Centralized logging (ELK stack)
- Metrics collection (Prometheus)
- Dashboards (Grafana)

### Resilience
- Circuit breakers between services
- Retry logic with exponential backoff
- Bulkhead patterns for isolation
- Timeout policies

### Data Consistency
- Eventual consistency for cross-service operations
- Saga pattern for distributed transactions
- Event sourcing for audit trail

## Migration Strategy

1. **Phase 1**: Implement API Gateway
2. **Phase 2**: Extract Campaign Service (strangler pattern)
3. **Phase 3**: Extract Content Service
4. **Phase 4**: Extract Analytics Service
5. **Phase 5**: Extract Notification Service
6. **Phase 6**: Extract Integration Service
7. **Phase 7**: Implement service discovery
8. **Phase 8**: Add inter-service communication
9. **Phase 9**: Implement monitoring
10. **Phase 10**: Migrate databases per service

## Communication Patterns

### Synchronous Communication
- REST API for external clients
- gRPC for inter-service communication
- API Gateway for request routing

### Asynchronous Communication
- Message queue (RabbitMQ/Redis) for events
- Webhooks for external integrations
- Event bus for cross-service notifications

## Technology Justification

| Service        | Language | Framework | Reason                              |
|----------------|----------|------------|--------------------------------------|
| Campaign       | Python   | FastAPI    | Data processing, AI integration      |
| Content        | Node.js  | Express    | Real-time, media handling            |
| Analytics      | Python   | FastAPI    | Pandas, NumPy, data science stack    |
| Notification   | Go       | Gorilla    | High concurrency, low latency         |
| Integration    | Python   | FastAPI    | Rich ecosystem, OAuth libraries      |
| API Gateway    | N/A      | Nginx      | Proven, performant, feature-rich     |
