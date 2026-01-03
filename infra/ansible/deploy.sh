#!/bin/bash
# Quick Start Script untuk Deploy NoteForge dengan Ansible

set -e

echo "=========================================="
echo "NoteForge Infrastructure Deployment"
echo "=========================================="
echo ""

# Check if ansible is installed
if ! command -v ansible &> /dev/null; then
    echo "Ansible not found. Installing..."
    sudo apt update
    sudo apt install -y ansible python3-pip
    pip3 install docker
    echo "Ansible installed"
else
    echo "Ansible already installed"
fi

# Change to ansible directory
cd "$(dirname "$0")"

# Check inventory file
if [ ! -f "inventory.ini" ]; then
    echo "inventory.ini not found!"
    exit 1
fi

# Test connection
echo ""
echo "Testing connection to hosts..."
if ansible all -m ping; then
    echo "All hosts reachable"
else
    echo "Cannot reach some hosts. Please check:"
    echo "   1. IP addresses in inventory.ini"
    echo "   2. SSH keys are set up"
    echo "   3. Hosts are online"
    exit 1
fi

# Confirm deployment
echo ""
echo "Ready to deploy:"
echo "  - NoteForge Application"
echo "  - Node Exporter"
echo "  - Prometheus"
echo "  - Grafana"
echo ""
read -p "Continue with deployment? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Run playbook
echo ""
echo "Starting deployment..."
ansible-playbook site.yml

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Access your services:"
echo ""
echo "NoteForge App:"
echo "   http://$(grep -A1 '\[app_servers\]' inventory.ini | tail -1 | awk '{print $2}' | cut -d'=' -f2):4173"
echo ""
echo "Prometheus:"
echo "   http://$(grep -A1 '\[monitoring_servers\]' inventory.ini | tail -1 | awk '{print $2}' | cut -d'=' -f2):9090"
echo ""
echo "Grafana:"
echo "   http://$(grep -A1 '\[monitoring_servers\]' inventory.ini | tail -1 | awk '{print $2}' | cut -d'=' -f2):3000"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "=========================================="
