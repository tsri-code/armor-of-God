#!/bin/bash

# Armor of God Worker Deployment Script
set -e  # Exit on any error

echo "🛡️  Armor of God - Worker Deployment"
echo "==================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler is not installed"
    echo "📦 Installing wrangler..."
    npm install -g wrangler@latest
fi

echo "📋 Current Wrangler version:"
wrangler --version
echo ""

# Check if user is logged in
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged into Cloudflare"
    echo "🌐 Opening browser for authentication..."
    wrangler login
else
    echo "✅ Already authenticated with Cloudflare"
    wrangler whoami
fi
echo ""

# Set the API key secret
echo "🔑 Setting Scripture API Key..."
echo "6055788494a08b719cedf58bca0878e8" | wrangler secret put SCRIPTURE_API_KEY
echo "✅ API Key secret set successfully"
echo ""

# Optional: Create KV namespace for caching
read -p "🗄️  Create KV namespace for verse caching? (recommended) [y/N]: " create_kv
if [[ $create_kv =~ ^[Yy]$ ]]; then
    echo "📦 Creating KV namespace..."
    KV_ID=$(wrangler kv:namespace create "VERSE_CACHE" --preview false | grep -o '"[^"]*"' | tail -1 | tr -d '"')
    KV_PREVIEW_ID=$(wrangler kv:namespace create "VERSE_CACHE" --preview | grep -o '"[^"]*"' | tail -1 | tr -d '"')

    echo "✅ KV namespace created:"
    echo "   Production ID: $KV_ID"
    echo "   Preview ID: $KV_PREVIEW_ID"

    # Update wrangler.toml
    sed -i.bak 's/# \[\[kv_namespaces\]\]/[[kv_namespaces]]/' wrangler.toml
    sed -i.bak 's/# binding = "VERSE_CACHE"/binding = "VERSE_CACHE"/' wrangler.toml
    sed -i.bak "s/# id = \"your-kv-namespace-id\"/id = \"$KV_ID\"/" wrangler.toml
    sed -i.bak "s/# preview_id = \"your-kv-preview-id\"/preview_id = \"$KV_PREVIEW_ID\"/" wrangler.toml

    echo "📝 Updated wrangler.toml with KV namespace IDs"
else
    echo "⏭️  Skipping KV namespace creation"
    echo "   (Worker will still work without caching)"
fi
echo ""

# Deploy the worker
echo "🚀 Deploying worker..."
wrangler deploy

echo ""
echo "🎉 Deployment Complete!"
echo "========================"
echo ""
echo "📋 Your worker endpoints:"
echo "   Health Check: https://armor-of-god-worker.YOUR-SUBDOMAIN.workers.dev/health"
echo "   Daily Verse:  https://armor-of-god-worker.YOUR-SUBDOMAIN.workers.dev/votd"
echo "   Passage:      https://armor-of-god-worker.YOUR-SUBDOMAIN.workers.dev/passage?ref=John+3:16"
echo ""
echo "🔗 Copy your worker URL and run:"
echo "   cd ../extension"
echo "   node update-config.cjs https://armor-of-god-worker.YOUR-SUBDOMAIN.workers.dev"
echo "   npm run build"
echo ""
echo "✅ Your extension now has live Bible verses!"
