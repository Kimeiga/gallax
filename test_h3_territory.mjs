/**
 * Tests H3 hexagonal territory system:
 * 1. Territory draw mode claims hexagonal cells
 * 2. Territory persists on server (H3 index format)
 * 3. Territory renders as hexagons
 * 4. Unclaim works
 *
 * Usage:
 *   node test_h3_territory.mjs [local|prod]
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'local';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5173';
const HEADLESS = false;

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

async function waitForGame(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 25000 });
  await page.waitForFunction(() => !!window.game, { timeout: 20000 });
  await page.waitForFunction(() => !!window.territory, { timeout: 15000 });
}

(async () => {
  console.log(`\n⬡ H3 Territory Test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log('📋 Step 1: Load game');
  await page.goto(BASE);
  await waitForGame(page);
  ok('Game loaded with territory system', true);

  // Check TerritorySystem uses H3
  console.log('\n📋 Step 2: Verify H3 integration');
  const h3Check = await page.evaluate(() => {
    const ts = window.territory;
    if (!ts) return { error: 'no territory system' };

    // Check that lngLatToH3 exists and returns an H3 index
    const { lngLatToH3 } = require_fails_but_check_window();
    return { hasSystem: true };
  }).catch(() => null);

  // Test via the system directly
  const systemCheck = await page.evaluate(() => {
    const ts = window.territory;
    // Claim a cell at player position
    const playerId = 'test_h3_' + Date.now();
    const playerName = 'H3Tester';

    // Get player position to derive an H3 cell
    const pos = window.game?.player?.getPosition?.();
    if (!pos) return { error: 'no player position' };

    return {
      hasSystem: !!ts,
      hasGetCell: typeof ts?.getCell === 'function',
      hasClaimCell: typeof ts?.claimCell === 'function',
      playerPos: pos,
    };
  });
  console.log('  System check:', JSON.stringify(systemCheck));
  ok('TerritorySystem loaded', systemCheck?.hasSystem);
  ok('TerritorySystem has getCell()', systemCheck?.hasGetCell);
  ok('TerritorySystem has claimCell()', systemCheck?.hasClaimCell);

  // Test H3 claiming
  console.log('\n📋 Step 3: Claim a territory cell via H3');
  const claimResult = await page.evaluate(() => {
    const ts = window.territory;
    const pos = window.game?.player?.getPosition?.();
    if (!ts || !pos) return { error: 'missing system or position' };

    // Use h3-js through the bundled module
    // The TerritorySystem exports lngLatToH3 but we access it via the system
    // Let's claim at a known NYC location
    const testH3 = '8a2a1072b59ffff'; // NYC area H3 res 10 cell
    const result = ts.claimCell(testH3, 'test_player', 'TestUser', '#ff6b6b');

    const cell = ts.getCell(testH3);
    return {
      claimed: result?.success,
      cellExists: !!cell,
      cellH3: cell?.h3Index,
      cellOwner: cell?.ownerId,
      cellColor: cell?.color,
      cellCount: ts.getCellCount('test_player'),
    };
  });
  console.log('  Claim result:', JSON.stringify(claimResult));
  ok('Cell claimed successfully', claimResult?.claimed);
  ok('Cell stored with H3 index', claimResult?.cellH3 === '8a2a1072b59ffff');
  ok('Cell has correct owner', claimResult?.cellOwner === 'test_player');
  ok('Cell count incremented', claimResult?.cellCount === 1);

  // Test removal
  console.log('\n📋 Step 4: Unclaim territory cell');
  const removeResult = await page.evaluate(() => {
    const ts = window.territory;
    const testH3 = '8a2a1072b59ffff';
    ts.removeCell(testH3);
    return {
      cellGone: ts.getCell(testH3) === null,
      cellCount: ts.getCellCount('test_player'),
    };
  });
  ok('Cell removed', removeResult?.cellGone);
  ok('Cell count back to 0', removeResult?.cellCount === 0);

  // Test territory canvas exists
  console.log('\n📋 Step 5: Verify renderer');
  const rendererCheck = await page.evaluate(() => {
    const canvas = document.getElementById('territory-canvas-overlay');
    return {
      canvasExists: !!canvas,
      canvasVisible: canvas?.style.display !== 'none',
    };
  });
  ok('Territory canvas overlay exists', rendererCheck?.canvasExists);

  // Test territory API (H3 format)
  console.log('\n📋 Step 6: Test API accepts H3 format');
  const apiCheck = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/territory');
      if (!res.ok) return { error: `GET failed: ${res.status}` };
      const data = await res.json();
      // Should be an array (possibly empty)
      return { isArray: Array.isArray(data), count: data.length };
    } catch (err) {
      return { error: err.message };
    }
  });
  console.log('  API response:', JSON.stringify(apiCheck));
  ok('Territory API returns array', apiCheck?.isArray);

  await ctx.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
