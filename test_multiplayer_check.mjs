/**
 * Multiplayer visibility check — two players must see each other.
 * Usage: node test_multiplayer_check.mjs [local|prod]
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5173';

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

(async () => {
  console.log(`\n👥 Multiplayer Visibility Check — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: false });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage({ viewport: { width: 1280, height: 800 } });

  // ── Step 1: Load and wait for FULL connection ──────────────────────────
  console.log('📋 Step 1: Load both clients and wait for network');
  await Promise.all([p1.goto(BASE), p2.goto(BASE)]);

  // Wait for game + player + network connected + player ID assigned
  for (const [page, label] of [[p1, 'P1'], [p2, 'P2']]) {
    await page.waitForSelector('canvas', { timeout: 25000 });
    await page.waitForFunction(() => !!window.game?.player, { timeout: 20000 });
    await page.waitForFunction(
      () => window.game?.network?.connected && window.game?.network?.getPlayerId?.(),
      { timeout: 30000 }
    );
    const id = await page.evaluate(() => window.game.network.getPlayerId());
    console.log(`  ${label} connected: ${id}`);
  }

  const id1 = await p1.evaluate(() => window.game.network.getPlayerId());
  const id2 = await p2.evaluate(() => window.game.network.getPlayerId());
  ok('Both connected with IDs', !!id1 && !!id2);
  ok('Different IDs', id1 !== id2);

  // ── Step 2: Move both to same spot and broadcast ──────────────────────
  console.log('\n📋 Step 2: Move both players to same location');
  const lng = -73.985, lat = 40.748;

  await p1.evaluate(({ lng, lat }) => {
    window.game.player.setPosition(lng, lat);
    window.game.mapManager.getMap().jumpTo({ center: [lng, lat], zoom: 16 });
    window.game.network.move(lng, lat);
  }, { lng, lat });

  await p2.evaluate(({ lng, lat }) => {
    window.game.player.setPosition(lng, lat + 0.0002);
    window.game.mapManager.getMap().jumpTo({ center: [lng, lat], zoom: 16 });
    window.game.network.move(lng, lat + 0.0002);
  }, { lng, lat });

  // Send a few position updates to make sure server relays them
  for (let i = 0; i < 5; i++) {
    await p1.evaluate(({ lng, lat }) => window.game.network.move(lng, lat), { lng, lat: lat + 0.00001 * i });
    await p2.evaluate(({ lng, lat }) => window.game.network.move(lng, lat + 0.0002), { lng, lat: lat + 0.00001 * i });
    await p1.waitForTimeout(200);
  }

  await p1.waitForTimeout(2000);

  // ── Step 3: Check visibility ──────────────────────────────────────────
  console.log('\n📋 Step 3: Check if players see each other');

  // Access the private `players` map via bracket notation
  const p1Count = await p1.evaluate(() => {
    const op = window.game?.otherPlayers;
    if (!op) return -1;
    // Access private field via key (works at runtime)
    for (const key of Object.keys(op)) {
      const val = op[key];
      if (val instanceof Map) return val.size;
    }
    return -2;
  });

  const p2Count = await p2.evaluate(() => {
    const op = window.game?.otherPlayers;
    if (!op) return -1;
    for (const key of Object.keys(op)) {
      const val = op[key];
      if (val instanceof Map) return val.size;
    }
    return -2;
  });

  console.log(`  P1 sees ${p1Count} other players`);
  console.log(`  P2 sees ${p2Count} other players`);
  ok('P1 sees P2', p1Count >= 1);
  ok('P2 sees P1', p2Count >= 1);

  // ── Step 4: Detailed debug if failed ──────────────────────────────────
  if (p1Count < 1 || p2Count < 1) {
    console.log('\n📋 Step 4: Debug info');

    // Check what network handlers received
    const debug1 = await p1.evaluate(() => {
      const n = window.game?.network;
      return {
        connected: n?.connected,
        playerId: n?.getPlayerId?.(),
        channelId: n?.channel?.id,
        // Check if init was received (players list from server)
        hasHandlers: !!n?.handlers,
      };
    });
    const debug2 = await p2.evaluate(() => {
      const n = window.game?.network;
      return {
        connected: n?.connected,
        playerId: n?.getPlayerId?.(),
        channelId: n?.channel?.id,
        hasHandlers: !!n?.handlers,
      };
    });
    console.log(`  P1 debug: ${JSON.stringify(debug1)}`);
    console.log(`  P2 debug: ${JSON.stringify(debug2)}`);

    // Check console errors
    const errors1 = await p1.evaluate(() => {
      return (window.__consoleErrors || []).slice(-5);
    });
    console.log(`  P1 console errors: ${JSON.stringify(errors1)}`);
  }

  await p1.waitForTimeout(3000);
  await ctx1.close();
  await ctx2.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
