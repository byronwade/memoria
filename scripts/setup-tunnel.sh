#!/bin/bash
# Setup Cloudflare Tunnel for Memoria

set -e

TUNNEL_NAME="memoria"
HOSTNAME="memoria-dev.byronwade.com"  # Change to your domain

echo "=== Cloudflare Tunnel Setup for Memoria ==="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    brew install cloudflared
fi

# Check if logged in
if ! cloudflared tunnel list &> /dev/null; then
    echo "Please login to Cloudflare..."
    cloudflared tunnel login
fi

# Check if tunnel already exists
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "Tunnel '$TUNNEL_NAME' already exists"
else
    echo "Creating tunnel '$TUNNEL_NAME'..."
    cloudflared tunnel create "$TUNNEL_NAME"
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "Tunnel ID: $TUNNEL_ID"

# Create config file
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  # Web app (Next.js)
  - hostname: $HOSTNAME
    service: http://localhost:3000

  # API webhooks subdomain (optional)
  - hostname: api.$HOSTNAME
    service: http://localhost:3000

  # Catch-all (required)
  - service: http_status:404
EOF

echo ""
echo "Config created at: $CONFIG_DIR/config.yml"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Add DNS record in Cloudflare dashboard:"
echo "   cloudflared tunnel route dns $TUNNEL_NAME $HOSTNAME"
echo ""
echo "2. Start the tunnel:"
echo "   cloudflared tunnel run $TUNNEL_NAME"
echo ""
echo "3. Or add to package.json scripts:"
echo '   "tunnel": "cloudflared tunnel run memoria"'
echo ""
