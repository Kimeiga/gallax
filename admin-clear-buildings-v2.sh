#!/bin/bash
# Production-ready admin script to clear all buildings
# This uses the new version-based cache invalidation system

echo "🔐 Admin Building Cleanup Script"
echo "================================"
echo ""

# Check if ADMIN_SECRET is set
if [ -z "$ADMIN_SECRET" ]; then
  echo "⚠️  ADMIN_SECRET not set. Please enter it:"
  read -s ADMIN_SECRET
  echo ""
fi

echo "🗑️  Step 1: Clearing buildings via API (with cache invalidation)..."
RESPONSE=$(curl -s -X POST https://gallax.pages.dev/api/admin/clear-buildings \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  NEW_VERSION=$(echo "$RESPONSE" | jq -r '.new_version')
  echo "✅ Buildings cleared! New version: $NEW_VERSION"
else
  echo "❌ Failed to clear buildings. Check your ADMIN_SECRET."
  exit 1
fi

echo ""
echo "🔄 Step 2: Restarting Geckos.io server..."
cd geckos-server && flyctl apps restart gallax-server
cd ..

echo ""
echo "✅ Complete! All buildings cleared."
echo ""
echo "📱 Client Behavior:"
echo "   - All clients will automatically detect version change"
echo "   - Their localStorage cache will be cleared on next load"
echo "   - No manual browser cache clearing needed!"
echo ""

