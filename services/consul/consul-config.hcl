# Consul Configuration for Service Discovery
#
# This configuration enables service discovery, health checking,
# and KV storage for the microservices architecture.

datacenter = "dc1"
data_dir = "/consul/data"
client_addr = "0.0.0.0"

# Server mode
server = true
bootstrap_expect = 1
ui = true

# Ports
ports {
  http = 8500
  https = -1
  dns = 8600
}

# Connect (for service mesh)
connect {
  enabled = true
  ca_provider = "consul"
}

# ACLs (Access Control Lists)
acl = {
  enabled = true
  default_policy = "deny"
  enable_token_persistence = true
}

# Telemetry
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = true
}

# Services auto-discovery
enable_debug = true
log_level = "INFO"
