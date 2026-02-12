FROM consul:1.18

# Copy configuration
COPY consul-config.hcl /consul/config/consul.hcl
COPY services.json /consul/config/services.json

# Create data directory
RUN mkdir -p /consul/data

# Expose ports
# 8500: HTTP API
# 8600: DNS
EXPOSE 8500 8600

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD consul version || exit 1

# Run Consul
CMD ["agent", "-server", "-ui", "-bootstrap-expect=1", "-config-dir=/consul/config"]
