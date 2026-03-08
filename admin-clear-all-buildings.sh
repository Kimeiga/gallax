#!/bin/bash
# Complete admin script to clear all buildings from everywhere

echo "🗑️  Step 1: Clearing buildings from D1 database..."
npx wrangler d1 execute gallax-db --remote --file=admin-clear-buildings.sql

echo ""
echo "🔄 Step 2: Restarting Geckos.io server to clear memory..."
cd geckos-server && flyctl apps restart gallax-server
cd ..

echo ""
echo "✅ Buildings cleared from database and server!"
echo ""
echo "⚠️  IMPORTANT: Users need to clear their browser cache:"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to Application/Storage tab"
echo "   3. Clear localStorage for gallax.pages.dev"
echo "   4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)"
echo ""
echo "Or run this in the browser console:"
echo "   localStorage.removeItem('gallax_production_buildings')"
echo "   location.reload(true)"

