# gRPC Protocol Buffers for Inter-Service Communication

This directory contains the Protocol Buffer definitions for gRPC communication between microservices.

## Overview

Each service exposes both REST (for external clients) and gRPC (for inter-service communication) interfaces. gRPC provides:

- **Better performance**: Binary serialization (Protocol Buffers) is faster than JSON
- **Type safety**: Strongly-typed message definitions catch errors at compile time
- **Code generation**: Client/server code auto-generated from .proto files
- **Streaming**: Support for bidirectional streaming for real-time updates

## Services

### Campaign Service (`campaign.proto`)
- Campaign CRUD operations
- Campaign lifecycle management (launch, pause, resume)
- Campaign metrics retrieval

### Content Service (`content.proto`)
- Content CRUD operations
- Version management
- Publishing workflow
- Template-based content creation

### Notification Service (`notification.proto`)
- Multi-channel notification sending
- Template management
- User preferences
- Delivery tracking

## Generating Code

### Python (for Campaign, Analytics, Integration services)

```bash
pip install grpcio grpcio-tools
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. *.proto
```

### Node.js (for Content service)

```bash
npm install grpc-tools
./node_modules/.bin/grpc_tools_node_protoc -I. --js_out=import_style=commonjs,binary:. --grpc_out=grpc:. *.proto
```

### Go (for Notification service)

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
protoc -I. --go_out=. --go-grpc_out=. *.proto
```

## Service Discovery

Services register with Consul and discover each other using the service name:

```
campaign-service:8001
content-service:8002
analytics-service:8003
notification-service:8004
integration-service:8005
```

## Communication Patterns

### Synchronous (gRPC)
Used for:
- Query operations (Get, List)
- Command operations requiring immediate response
- Inter-service coordination

### Asynchronous (Message Queue)
Used for:
- Event notifications
- Long-running operations
- Fan-out scenarios (notify multiple services)

## Example Usage

### Python Client

```python
import grpc
from campaign.v1 import campaign_pb2, campaign_pb2_grpc

# Discover service from Consul
channel = grpc.insecure_channel('campaign-service:8001')
stub = campaign_pb2_grpc.CampaignServiceStub(channel)

# Get campaign
request = campaign_pb2.GetCampaignRequest(
    id=campaign_id,
    user_id=user_id
)
response = stub.GetCampaign(request)
print(response.campaign.name)
```

### Go Client

```go
import (
    "context"
    "google.golang.org/grpc"
    campaignv1 "path/to/proto/campaign/v1"
)

conn, err := grpc.Dial("campaign-service:8001", grpc.WithInsecure())
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

client := campaignv1.NewCampaignServiceClient(conn)

ctx := context.Background()
resp, err := client.GetCampaign(ctx, &campaignv1.GetCampaignRequest{
    Id:     campaignID,
    UserId: userID,
})
```

### Node.js Client

```javascript
const grpc = require('@grpc/grpc-js');
const {CampaignServiceClient} = require('./proto/campaign_pb_grpc');

const client = new CampaignServiceClient(
    'campaign-service:8001',
    grpc.credentials.createInsecure()
);

const request = new GetCampaignRequest();
request.setId(campaignId);
request.setUserId(userId);

client.getCampaign(request, (error, response) => {
    if (error) throw error;
    console.log(response.getCampaign().getName());
});
```

## Best Practices

1. **Always use context**: Set appropriate timeouts and cancellation
2. **Handle connection errors**: Implement retry logic with exponential backoff
3. **Use metadata**: Pass correlation IDs for distributed tracing
4. **Streaming for large datasets**: Use server-side streaming for pagination
5. **Error handling**: Map gRPC status codes to appropriate HTTP codes in API gateway

## Migration Path

Phase 1: REST-only (current)
Phase 2: Add gRPC for inter-service communication
Phase 3: Gradual migration of external clients to gRPC Gateway
Phase 4: Deprecate REST for inter-service calls
