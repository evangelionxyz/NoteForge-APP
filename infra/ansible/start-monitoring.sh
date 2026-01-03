#!/bin/bash

# NoteForge Monitoring Stack - Complete Setup Script
# This script deploys the entire monitoring infrastructure

set -e  # Exit on error

echo "=========================================="
echo "NoteForge Monitoring Stack Deployment"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Run Ansible Playbook
echo "[Step 1] Running Ansible playbook..."
echo "--------------------------------------"
if ansible-playbook -i inventory.ini site.yml --ask-become-pass; then
    print_status "Ansible deployment completed"
else
    print_error "Ansible deployment failed"
    exit 1
fi
echo ""

# Step 2: Start Prometheus Container
echo "[Step 2] Starting Prometheus..."
echo "--------------------------------------"
# Stop existing container if running
docker rm -f prometheus 2>/dev/null || true

# Start Prometheus with host networking
docker run -d \
    --name prometheus \
    --network host \
    -v /opt/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro \
    -v prometheus-data:/prometheus \
    --restart unless-stopped \
    prom/prometheus \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus \
    --web.console.libraries=/usr/share/prometheus/console_libraries \
    --web.console.templates=/usr/share/prometheus/consoles

if [ $? -eq 0 ]; then
    print_status "Prometheus started on http://localhost:9090"
else
    print_error "Failed to start Prometheus"
    exit 1
fi
echo ""

# Step 3: Start Grafana Container
echo "[Step 3] Starting Grafana..."
echo "--------------------------------------"
# Stop existing container if running
docker rm -f grafana 2>/dev/null || true

# Start Grafana with host networking
docker run -d \
    --name grafana \
    --network host \
    -v /opt/grafana/provisioning:/etc/grafana/provisioning:ro \
    -v grafana-data:/var/lib/grafana \
    -e GF_SECURITY_ADMIN_USER=admin \
    -e GF_SECURITY_ADMIN_PASSWORD=admin123 \
    -e GF_USERS_ALLOW_SIGN_UP=false \
    --restart unless-stopped \
    grafana/grafana:latest

if [ $? -eq 0 ]; then
    print_status "Grafana started on http://localhost:3000"
else
    print_error "Failed to start Grafana"
    exit 1
fi
echo ""

# Step 4: Wait for services to be ready
echo "[Step 4] Waiting for services to be ready..."
echo "--------------------------------------"
sleep 5

# Check Prometheus
if curl -s http://localhost:9090/-/ready > /dev/null 2>&1; then
    print_status "Prometheus is ready"
else
    print_warning "Prometheus is starting... (may take a few seconds)"
fi

# Check Grafana
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    print_status "Grafana is ready"
else
    print_warning "Grafana is starting... (may take a few seconds)"
fi

# Check Node Exporter
if curl -s http://localhost:9100/metrics > /dev/null 2>&1; then
    print_status "Node Exporter is ready"
else
    print_warning "Node Exporter may not be running"
fi

# Check NoteForge App
if curl -s http://localhost:4173 > /dev/null 2>&1; then
    print_status "NoteForge App is ready"
else
    print_warning "NoteForge App may not be running"
fi
echo ""

# Step 5: Verify Prometheus Targets
echo "[Step 5] Checking Prometheus targets..."
echo "--------------------------------------"
sleep 3
curl -s http://localhost:9090/api/v1/targets 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for target in data['data']['activeTargets']:
        job = target['labels']['job']
        health = target['health'].upper()
        url = target['scrapeUrl']
        status = '[OK]' if health == 'UP' else '[DOWN]'
        print(f'  {status} {job}: {health} - {url}')
except:
    print('  [WARN] Targets not available yet, check in a few seconds')
"
echo ""

# Final Summary
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Access Points:"
echo "  - NoteForge App:  http://localhost:4173"
echo "  - Node Exporter:  http://localhost:9100/metrics"
echo "  - Prometheus:     http://localhost:9090"
echo "  - Grafana:        http://localhost:3000"
echo ""
echo "Grafana Credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Pre-configured Dashboards:"
echo "  1. Node Exporter - System Monitoring"
echo "  2. Application Overview"
echo ""
echo "Useful Commands:"
echo "  - Check services:     systemctl status noteforge node_exporter"
echo "  - View Prometheus:    docker logs prometheus"
echo "  - View Grafana:       docker logs grafana"
echo "  - Restart Prometheus: docker restart prometheus"
echo "  - Restart Grafana:    docker restart grafana"
echo ""
echo "Your monitoring stack is ready!"
echo "=========================================="
