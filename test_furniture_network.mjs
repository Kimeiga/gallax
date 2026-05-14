/**
 * Furniture rotation+scale network test
 * Two players in the same home — one rotates/scales furniture, the other sees it.
 *
 * Usage:
 *   node test_furniture_network.mjs local
 *   node test_furniture_network.mjs prod
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'local';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5180';
const HOME_ID = 'net_test_home_42';
const FURN_ID  = 'net_test_furn_1';
const HEADLESS = false;

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

async function waitForGame(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 20000 });
  await page.waitForFunction(() => !!window.game?.homeInterior, { timeout: 20000 });
  // Wait for geckos connection (playerId is set once connected)
  await page.waitForFunction(() => !!window.game?.network?.getPlayerId?.(), { timeout: 30000 });
}

async function enterHome(page, homeId) {
  await page.evaluate((hId) => {
    const hi = window.game.homeInterior;
    if (!hi.isInside()) hi.enter(hId, 'TestHome', 1, false);
    window.game.network.enterHome(hId, 1, 'TestPlayer');
  }, homeId);
}

(async () => {
  console.log(`\n🛋️  Furniture rotation+scale network test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });

  // ── Open two browser contexts (different guest IDs) ────────────
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  console.log('📋 Step 1: Both players load the game');
  await Promise.all([
    page1.goto(BASE),
    page2.goto(BASE),
  ]);
  await Promise.all([
    waitForGame(page1),
    waitForGame(page2),
  ]);
  ok('Both pages loaded', true);

  // ── Step 2: Both players enter the same home ───────────────────
  console.log('\n📋 Step 2: Both enter home ' + HOME_ID);
  await enterHome(page1, HOME_ID);
  await page1.waitForTimeout(300);
  await enterHome(page2, HOME_ID);
  await page1.waitForTimeout(800); // wait for presence exchange

  const presence1 = await page1.evaluate((hId) => ({
    inside: window.game.homeInterior?.isInside(),
    homeId: window.game.homeInterior?.getCurrentHomeId(),
    otherPlayers: window.game.homeInterior?.otherPlayers?.size ?? -1,
  }), HOME_ID);
  const presence2 = await page2.evaluate((hId) => ({
    inside: window.game.homeInterior?.isInside(),
    homeId: window.game.homeInterior?.getCurrentHomeId(),
    otherPlayers: window.game.homeInterior?.otherPlayers?.size ?? -1,
  }), HOME_ID);

  console.log('  Player 1:', JSON.stringify(presence1));
  console.log('  Player 2:', JSON.stringify(presence2));
  ok('Player 1 inside home', presence1.inside === true);
  ok('Player 2 inside home', presence2.inside === true);
  ok('Player 2 sees Player 1', presence2.otherPlayers >= 1, `count=${presence2.otherPlayers}`);

  // ── Step 3: Inject a shared furniture item into both ──────────
  console.log('\n📋 Step 3: Inject test furniture into both players');
  const FURN = { id: FURN_ID, emoji: '🛋️', x: 400, y: 300 };
  await page1.evaluate((f) => window.game.homeInterior?.addFurnitureFromNetwork(f), FURN);
  await page2.evaluate((f) => window.game.homeInterior?.addFurnitureFromNetwork(f), FURN);
  await page1.waitForTimeout(200);

  const furn1 = await page1.evaluate((id) => window.game.homeInterior?.furniture?.find(f => f.id === id), FURN_ID);
  const furn2 = await page2.evaluate((id) => window.game.homeInterior?.furniture?.find(f => f.id === id), FURN_ID);
  ok('Furniture injected into Player 1', !!furn1, JSON.stringify(furn1));
  ok('Furniture injected into Player 2', !!furn2, JSON.stringify(furn2));

  // ── Step 4: Player 1 moves furniture with rotation + scale ────
  console.log('\n📋 Step 4: Player 1 broadcasts furniture_moved with rotation + scale');
  const TARGET_ROTATION = 1.047; // 60°
  const TARGET_SCALE = 1.5;

  await page1.evaluate(({ homeId, furnId, r, s }) => {
    // Update furniture locally first
    const hi = window.game.homeInterior;
    const f = hi?.furniture?.find(f => f.id === furnId);
    if (f) { f.rotation = r; f.scale = s; f.x = 420; f.y = 310; }
    // Broadcast via network
    window.game.network.moveFurniture(homeId, furnId, 420, 310, r, s);
  }, { homeId: HOME_ID, furnId: FURN_ID, r: TARGET_ROTATION, s: TARGET_SCALE });

  // Wait for the reliable network message to arrive
  await page2.waitForTimeout(1500);

  // ── Step 5: Player 2 checks the furniture ─────────────────────
  console.log('\n📋 Step 5: Player 2 checks updated furniture');
  const furn2After = await page2.evaluate((id) => {
    const f = window.game.homeInterior?.furniture?.find(f => f.id === id);
    return f ? { x: f.x, y: f.y, rotation: f.rotation, scale: f.scale } : null;
  }, FURN_ID);

  console.log('  Player 2 furniture after broadcast:', JSON.stringify(furn2After));
  ok('Player 2 received furniture_moved', !!furn2After);
  ok('Position updated (x)',     Math.abs((furn2After?.x ?? 0) - 420) < 1,   `x=${furn2After?.x}`);
  ok('Rotation propagated',      Math.abs((furn2After?.rotation ?? 0) - TARGET_ROTATION) < 0.01, `rotation=${furn2After?.rotation}`);
  ok('Scale propagated',         Math.abs((furn2After?.scale ?? 0) - TARGET_SCALE) < 0.01, `scale=${furn2After?.scale}`);

  // ── Step 6: CSS transform applied on Player 2's render ────────
  console.log('\n📋 Step 6: Verify CSS transform applied on Player 2');
  const cssCheck = await page2.evaluate((id) => {
    const hi = window.game.homeInterior;
    // Re-render to make sure CSS is up to date
    hi?.renderFurniture?.();
    const furnitureEls = hi?.furnitureLayer?.querySelectorAll('span');
    if (!furnitureEls) return { ok: false };
    let match = false;
    for (const el of furnitureEls) {
      if (el.style.transform.includes('rotate') && el.style.transform.includes('scale')) {
        match = true;
        return { ok: true, transform: el.style.transform };
      }
    }
    return { ok: false, reason: 'no element with rotate+scale transform' };
  }, FURN_ID);

  console.log('  CSS transform:', JSON.stringify(cssCheck));
  ok('CSS rotate+scale applied on Player 2', cssCheck.ok, JSON.stringify(cssCheck));

  // ── Cleanup ────────────────────────────────────────────────────
  await page1.evaluate(() => { window.game?.homeInterior?.exit(); window.game?.network?.exitHome?.(); });
  await page2.evaluate(() => { window.game?.homeInterior?.exit(); window.game?.network?.exitHome?.(); });
  await ctx1.close();
  await ctx2.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
