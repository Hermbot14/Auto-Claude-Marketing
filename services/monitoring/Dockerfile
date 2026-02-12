# Monitoring Stack Dockerfile
# Builds Prometheus and Grafana configuration

FROM alpine:latest

# Install dependencies
RUN apk add --no-cache curl

# Create directories
RUN mkdir -p /monitoring

# Copy configuration files
COPY prometheus/prometheus.yml /monitoring/prometheus.yml
COPY prometheus/alerts /monitoring/alerts

# Copy Grafana provisioning
COPY grafana/provisioning /monitoring/grafana-provisioning

# Expose volume for persistence
VOLUME ["/monitoring"]

CMD ["sh", "-c", "echo 'Monitoring configuration ready. Use docker-compose to run services.' && sleep 3600"]
