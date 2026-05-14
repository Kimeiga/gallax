/**
 * Territory system end-to-end test
 * Tests: table exists, claim flow, API persist, reload, multiplayer visibility
 *
 * Usage:
 *   node test_territory.mjs prod
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5180';
const HEADLESS = false;

let passed = 0;
let failed = 0;

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function waitForGame(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 15000 });
  await page.waitForFunction(() => !!window.game?.territorySystem, { timeout: 15000 });
}

(async () => {
  console.log(`\n🏴 Territory system test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });

  // ── Step 1: API GET returns empty array (table exists) ─────────────────────
  console.log('📋 Step 1: Verify territory API is reachable');
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto(BASE);
  await waitForGame(page1);

  const apiResult = await page1.evaluate(async () => {
    const res = await fetch('/api/territory');
    const body = await res.json();
    return { status: res.status, isArray: Array.isArray(body) };
  });
  ok('GET /api/territory returns 200', apiResult.status === 200, `status=${apiResult.status}`);
  ok('Response is an array', apiResult.isArray);

  // ── Step 2: TerritorySystem initialised ───────────────────────────────────
  console.log('\n📋 Step 2: Game initialises territory system');
  const state = await page1.evaluate(() => {
    const ts = window.game?.territorySystem;
    const tr = window.game?.territoryRenderer;
    return {
      territorySystemExists: !!ts,
      territoryRendererExists: !!tr,
      cellCount: ts?.getAllCells?.()?.length ?? -1,
    };
  });
  ok('TerritorySystem exists', state.territorySystemExists);
  ok('TerritoryRenderer exists', state.territoryRendererExists);
  console.log(`  Loaded ${state.cellCount} cells from server`);

  // ── Step 3: Claim a cell ──────────────────────────────────────────────────
  console.log('\n📋 Step 3: Claim a cell (direct API flow)');

  const claimResult = await page1.evaluate(() => {
    const game = window.game;
    if (!game?.territorySystem || !game?.player) return { ok: false, reason: 'missing game/ts' };

    const pos = game.player.getPosition();
    const ORIGIN_LNG = -74.02, ORIGIN_LAT = 40.82;
    const PIXEL_SIZE_LAT = 0.00002;
    const PIXEL_SIZE_LNG = PIXEL_SIZE_LAT / Math.cos(40.78 * Math.PI / 180);
    const gx = Math.floor((pos.lng - ORIGIN_LNG) / PIXEL_SIZE_LNG);
    const gy = Math.floor((pos.lat - ORIGIN_LAT) / PIXEL_SIZE_LAT);

    const user = window.authService?.getUser?.() || {};
    const playerId = user.id || 'test_player';
    const level = 1;

    const check = game.territorySystem.canClaim(gx, gy, playerId, level, gx, gy);
    if (!check.canClaim && check.reason !== 'Already yours') {
      return { ok: false, reason: `canClaim: ${check.reason}`, gx, gy };
    }

    // Unclaim first in case already ours from a previous test run
    game.territorySystem.removeCell?.(gx, gy, false);

    const check2 = game.territorySystem.canClaim(gx, gy, playerId, level, gx, gy);
    const color = '#FF6B6B';
    const result = game.territorySystem.claimCell(gx, gy, playerId, 'TestPlayer', color);
    return { ok: result.success, gx, gy, playerId, claimTime: check2.claimTime };
  });

  ok('Cell claimed locally', claimResult.ok, claimResult.reason || JSON.stringify(claimResult));
  console.log(`  Grid: (${claimResult.gx}, ${claimResult.gy}), claimTime=${claimResult.claimTime}ms`);

  // ── Step 4: Save to server ────────────────────────────────────────────────
  console.log('\n📋 Step 4: Save claimed cell to server');

  const networkLog = [];
  page1.on('request', req => {
    if (req.url().includes('/api/territory')) {
      networkLog.push({ type: 'req', method: req.method(), body: req.postData()?.slice(0, 200) });
    }
  });
  page1.on('response', async res => {
    if (res.url().includes('/api/territory')) {
      let body = '';
      try { body = await res.text(); } catch {}
      networkLog.push({ type: 'res', status: res.status(), method: res.request().method(), body: body.slice(0, 200) });
    }
  });

  const { gx, gy } = claimResult;

  await page1.evaluate(({ gx, gy }) => {
    // saveTerritoryToServer reads authService internally, this is fine
    window.game?.saveTerritoryToServer?.([{ x: gx, y: gy }], '#FF6B6B');
  }, { gx, gy });

  await page1.waitForTimeout(1000); // wait for 200ms debounce + network

  for (const r of networkLog) {
    const icon = r.type === 'res' ? `→ HTTP ${r.status}` : '←';
    console.log(`  ${icon} ${r.method} ${r.body || ''}`);
  }

  const postReqs = networkLog.filter(n => n.method === 'POST');
  const postRes = networkLog.find(n => n.type === 'res' && n.method === 'POST');
  ok('POST sent to /api/territory', postReqs.length > 0);
  if (postRes) {
    ok('POST returned 2xx', postRes.status >= 200 && postRes.status < 300,
      `status=${postRes.status} body=${postRes.body}`);
  } else {
    ok('POST returned 2xx', false, 'No response captured');
  }

  // ── Step 5: Verify in DB ──────────────────────────────────────────────────
  console.log('\n📋 Step 5: Verify cell persisted in DB');
  await page1.waitForTimeout(300);

  const dbCheck = await page1.evaluate(async ({ gx, gy }) => {
    const res = await fetch(`/api/territory?minX=${gx}&maxX=${gx}&minY=${gy}&maxY=${gy}`);
    return { status: res.status, cells: await res.json() };
  }, { gx, gy });

  const cell = dbCheck.cells.find(c => c.x === gx && c.y === gy);
  console.log(`  DB at (${gx},${gy}): ${JSON.stringify(cell || null)}`);
  ok('Cell exists in DB after claim', !!cell, 'Not found in DB');

  // ── Step 6: Reload — cell should still be there ───────────────────────────
  console.log('\n📋 Step 6: Reload page — cell should persist');
  await page1.reload();
  await waitForGame(page1);

  const afterReload = await page1.evaluate(({ gx, gy }) => {
    return window.game?.territorySystem?.getCell?.(gx, gy) || null;
  }, { gx, gy });

  ok('Cell persists after reload', !!afterReload);
  if (afterReload) {
    console.log(`  After reload: owner=${afterReload.ownerId}, color=${afterReload.color}`);
  }

  // ── Step 7: Second browser sees the cell ──────────────────────────────────
  console.log('\n📋 Step 7: Second browser can see the claimed cell');
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(BASE);
  await waitForGame(page2);

  const seenByOther = await page2.evaluate(({ gx, gy }) => {
    return window.game?.territorySystem?.getCell?.(gx, gy) || null;
  }, { gx, gy });

  ok('Other player sees claimed cell', !!seenByOther);
  if (seenByOther) {
    console.log(`  Visible to other: color=${seenByOther.color}, owner=${seenByOther.ownerId}`);
  }
  await ctx2.close();

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log('\n📋 Cleanup: Delete test cell');
  const deleteRes = await page1.evaluate(async ({ gx, gy }) => {
    const guestId = localStorage.getItem('gallax_guest_id');
    const headers = { 'Content-Type': 'application/json' };
    if (guestId) headers['X-Guest-ID'] = guestId;
    const res = await fetch('/api/territory', {
      method: 'DELETE',
      headers,
      body: JSON.stringify([{ x: gx, y: gy }]),
    });
    return { status: res.status, body: await res.json() };
  }, { gx, gy });
  console.log(`  DELETE: HTTP ${deleteRes.status} — ${JSON.stringify(deleteRes.body)}`);
  ok('Test cell cleaned up', deleteRes.status >= 200 && deleteRes.status < 300);

  await ctx1.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
