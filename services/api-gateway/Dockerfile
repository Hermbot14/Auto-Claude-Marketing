FROM nginx:1.25-alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy SSL certificates (if using HTTPS)
# COPY ssl/cert.pem /etc/nginx/ssl/cert.pem
# COPY ssl/key.pem /etc/nginx/ssl/key.pem

# Create log directory
RUN mkdir -p /var/log/nginx

# Expose ports
EXPOSE 8080 8443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
