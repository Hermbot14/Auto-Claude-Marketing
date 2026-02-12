# Microservices Architecture Documentation

## Overview

The Auto Claude Marketing Hub has been migrated from a monolithic architecture to a microservices architecture using Domain-Driven Design (DDD) principles.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                    │
│                    Web App / Mobile App / API                            │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY                                   │
│                     (Nginx / Kong)                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  • Request Routing       • Rate Limiting                            │ │
│  │  • Authentication        • CORS Handling                            │ │
│  │  • Request/Response Transform                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────┬───────────────────────────────────────────────────────────────────┘
          │
          ├──────────────┬──────────────┬──────────────┬──────────────┐
          │              │              │              │              │
          ▼              ▼              ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Campaign │   │ Content │   │Analytics│   │Notifica. │   │Integrat. │
    │ Service │   │ Service │   │ Service │   │ Service │   │ Service │
    │Python   │   │Node.js  │   │ Python  │   │   Go    │   │ Python  │
    │FastAPI  │   │Express  │   │FastAPI  │   │  Gin    │   │FastAPI  │
    │  :8001  │   │  :8002  │   │  :8003  │   │  :8004  │   │  :8005  │
    └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
         │              │              │              │              │
         └──────────────┴──────────────┴──────────────┴──────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Service Mesh     │
                    │     (Consul)      │
                    │  • Discovery      │
                    │  • Health Check   │
                    │  • KV Store      │
                    └─────────────────────┘
                               │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
   ┌──────────┐          ┌──────────┐          ┌──────────┐
   │PostgreSQL │          │ MongoDB  │          │ Redis    │
   │Campaigns │          │ Content  │          │ Cache    │
   │Analytics │          │          │          │ Queue    │
   │Integrat. │          │          │          │          │
   └──────────┘          └──────────┘          └──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Monitoring       │
                    │  • Prometheus     │
                    │  • Grafana        │
                    │  • AlertManager   │
                    └─────────────────────┘
```

## Service Boundaries

### API Gateway (Port 8080)
- **Technology**: Nginx
- **Responsibilities**:
  - Request routing to backend services
  - Authentication (JWT validation)
  - Rate limiting per endpoint
  - CORS handling
  - Request/response transformation

### Campaign Service (Port 8001)
- **Technology**: Python + FastAPI
- **Database**: PostgreSQL
- **Responsibilities**:
  - Campaign CRUD operations
  - Campaign scheduling and execution
  - Audience targeting and segmentation
  - A/B testing management
  - Campaign performance metrics

### Content Service (Port 8002)
- **Technology**: Node.js + Express
- **Database**: MongoDB
- **Storage**: S3-compatible (MinIO for dev)
- **Responsibilities**:
  - Content template management
  - Content generation and editing
  - Media asset management
  - Content approval workflow
  - Content versioning

### Analytics Service (Port 8003)
- **Technology**: Python + FastAPI + Pandas
- **Database**: TimescaleDB (PostgreSQL extension)
- **Responsibilities**:
  - Event tracking and collection
  - Metric aggregation and computation
  - Report generation
  - Dashboard data
  - Data export (CSV, Excel, JSON)

### Notification Service (Port 8004)
- **Technology**: Go + Gin
- **Database**: PostgreSQL
- **Queue**: Redis / RabbitMQ
- **Responsibilities**:
  - Multi-channel notifications (email, SMS, push)
  - Notification template management
  - User preferences
  - Delivery tracking
  - WebSocket for real-time updates

### Integration Service (Port 8005)
- **Technology**: Python + FastAPI
- **Database**: PostgreSQL
- **Responsibilities**:
  - OAuth flow management
  - API client management
  - Webhook handling
  - Rate limiting
  - Third-party integrations (GitHub, Slack, Discord, HubSpot, Mailchimp)

## Data Flows

### 1. Campaign Creation Flow

```
User                    API Gateway          Campaign Service      Content Service
 │                           │                      │                    │
 ├─ POST /api/campaigns ────┤                      │                    │
 │                           ├──────────────────────>│                    │
 │                           │                      ├─ Validate Content ──>│
 │                           │                      │<─────────────────────┤
 │                           │                      ├─ Create Campaign    │
 │<──────────────────────────┤<─────────────────────┤                    │
 │                           │                      │                    │
```

### 2. Campaign Launch Flow

```
User                    API Gateway          Campaign Service      Notification Service    Content Service
 │                           │                      │                         │                  │
 ├─ POST /launch ───────────>│                      │                         │                  │
 │                           ├──────────────────────>│                         │                  │
 │                           │                      ├─ Schedule Publish       │                  │
 │                           │                      ├────────────────────────>│                  │
 │                           │                      │                         ├─ Queue Email     │
 │<──────────────────────────┤<─────────────────────┤                         │                  │
 │                           │                      │                         │                  │
```

### 3. Event Tracking Flow

```
Client                  API Gateway          Analytics Service      Campaign Service
 │                           │                      │                     │
 ├─ POST /events ──────────>│                      │                     │
 │                           ├──────────────────────>│                     │
 │                           │                      ├─ Store Event        │
 │                           │                      ├─ Update Metrics ────>│
 │<──────────────────────────┤<─────────────────────┤                     │
 │                           │                      │                     │
```

### 4. Notification Flow

```
Campaign Service          Notification Service      External Providers
 │                               │                     │
 ├─ gRPC: SendNotification ─────>│                     │
 │                               ├─ Check Preferences  │
 │                               ├─ Load Template      │
 │                               ├─ Render Message    │
 │                               ├─ SendEmail ───────>│ (SendGrid)
 │                               ├─ SendSMS ─────────>│ (Twilio)
 │                               ├─ SendPush ────────>│ (FCM/APNs)
 │<───────────────────────────────┤                     │
 │                               │                     │
```

## Communication Patterns

### Synchronous Communication

**REST API** (External clients)
- Client → API Gateway → Services
- JSON over HTTP/HTTPS
- Used for: CRUD operations, queries

**gRPC** (Inter-service)
- Service → Service communication
- Protocol Buffers over HTTP/2
- Used for: High-performance inter-service calls

### Asynchronous Communication

**Message Queue** (Redis / RabbitMQ)
- Event-driven communication
- Pub/Sub pattern
- Used for: Notifications, events, long-running tasks

**Webhooks**
- Service → External integration
- POST requests with signatures
- Used for: Third-party event notifications

## Database per Service Pattern

| Service        | Database        | Purpose                          |
|----------------|-----------------|----------------------------------|
| Campaign       | PostgreSQL      | Relational data, transactions     |
| Content        | MongoDB        | Document storage, flexibility      |
| Analytics      | TimescaleDB     | Time-series data                  |
| Notification   | PostgreSQL      | Relational data, delivery tracking |
| Integration    | PostgreSQL      | OAuth tokens, integration config   |

## Service Discovery

**Consul** provides:
- Service registration (services register on startup)
- Health checking (HTTP checks every 10s)
- DNS-based discovery (service-name.service.consul)
- Load balancing (client-side)
- KV storage for configuration

## Monitoring & Observability

### Metrics (Prometheus)
- Service health status
- Request rate, latency, error rate
- Resource usage (CPU, memory, disk)
- Business metrics (campaigns, notifications)

### Logs (ELK Stack)
- Centralized logging
- Structured JSON logs
- Distributed tracing (OpenTelemetry)

### Tracing (OpenTelemetry)
- Request traces across services
- Performance analysis
- Error root cause analysis

### Dashboards (Grafana)
- Service health dashboard
- Performance metrics
- Business KPIs
- Alert status

## Deployment

### Container Strategy
- Each service runs in its own container
- Containers are stateless
- Configuration via environment variables
- Secrets via Docker secrets or Vault

### Orchestration
- Docker Compose (development)
- Kubernetes (production)
- Rolling updates with zero downtime
- Auto-scaling based on metrics

## Security

### Authentication
- JWT tokens issued by Integration Service
- Token validation at API Gateway
- Service-to-service communication via mTLS (optional)

### Authorization
- Role-based access control (RBAC)
- User permissions per resource
- API key authentication for external clients

### Network Security
- Service-to-service encryption (mTLS)
- API Gateway as only public entry point
- Network policies (Kubernetes NetworkPolicy)

## Scaling

### Horizontal Scaling
- Stateless services can scale horizontally
- Load balancing via Consul DNS
- Database connection pooling

### Vertical Scaling
- Database servers
- Analytics processing
- Background workers

## Fault Tolerance

### Circuit Breakers
- Prevent cascading failures
- Automatic recovery
- Fallback responses

### Retries
- Exponential backoff
- Configurable max retries
- Dead letter queue for failed messages

### Timeouts
- Request timeout per service
- Circuit breaker timeout
- Database query timeout

## Migration Strategy

### Strangler Pattern
1. Implement API Gateway
2. Extract one service at a time
3. Route traffic through gateway
4. Migrate database per service
5. Decommission monolith

### Data Migration
1. Read from monolith database
2. Write to service database
3. Verify data consistency
4. Switch reads to service database
5. Migrate remaining data
6. Remove old data

## Future Enhancements

- [ ] GraphQL Gateway (schema stitching)
- [ ] Event Sourcing for audit trail
- [ ] CQRS for read/write separation
- [ ] Service Mesh (Istio/Linkerd)
- [ ] Multi-region deployment
- [ ] Automated canary deployments
