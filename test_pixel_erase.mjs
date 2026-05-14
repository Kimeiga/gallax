/**
 * Diagnostic test for pixel erase persistence
 * Captures network requests to see exactly what's happening with DELETE calls
 *
 * Usage:
 *   node test_pixel_erase.mjs local
 *   node test_pixel_erase.mjs prod
 */

import { chromium } from 'playwright';

const MODE = process.argv[2] || 'local';
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

async function waitForGameReady(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 15000 });
  // Poll until the game and pixelCanvas are fully initialized (faster + reliable)
  await page.waitForFunction(() => !!window.game?.pixelCanvas, { timeout: 15000 });
}

(async () => {
  console.log(`\n🎨 Pixel erase persistence diagnostic — ${MODE.toUpperCase()} (${BASE})\n`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();

  // ── Intercept network requests ────────────────────────────────────
  const networkLog = [];
  page.on('request', req => {
    if (req.url().includes('/api/pixels')) {
      networkLog.push({ type: 'request', method: req.method(), url: req.url(), postData: req.postData() });
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/pixels')) {
      let body = '';
      try { body = await res.text(); } catch {}
      networkLog.push({ type: 'response', method: res.request().method(), status: res.status(), url: res.url(), body: body.slice(0, 200) });
    }
  });

  try {
    await page.goto(BASE);
    await waitForGameReady(page);

    // ── Check initial state ────────────────────────────────────────
    console.log('📋 Step 1: Check pixel canvas and auth state');
    const state = await page.evaluate(() => {
      const pc = window.game?.pixelCanvas;
      const userId = window.authService?.getUser?.()?.id || 'none';
      const guestId = localStorage.getItem('gallax_guest_id');
      return {
        pixelCanvasExists: !!pc,
        pixelCount: pc?.getPixelCount() || 0,
        userId,
        guestId,
        hasSession: document.cookie.includes('session'),
      };
    });
    console.log('  State:', JSON.stringify(state, null, 2));
    ok('PixelCanvas exists', state.pixelCanvasExists);
    ok('User has an ID (guest or auth)', state.userId !== 'none' || !!state.guestId, `userId=${state.userId}`);

    // ── Draw a test pixel directly ─────────────────────────────────
    console.log('\n📋 Step 2: Draw a test pixel');
    const TEST_X = 500;
    const TEST_Y = 500;

    const drawResult = await page.evaluate(({ x, y }) => {
      const pc = window.game?.pixelCanvas;
      if (!pc) return 'no pixelCanvas';
      pc.placePixel(x, y, '#ff0000', 'test_user', 'TestUser');
      return 'drawn';
    }, { x: TEST_X, y: TEST_Y });
    ok('Drew test pixel in canvas', drawResult === 'drawn', drawResult);

    // Manually trigger server save
    const saveResult = await page.evaluate(({ x, y }) => {
      const game = window.game;
      if (!game) return 'no game';
      game.savePixelToServer?.({ x, y, color: '#ff0000' });
      return 'save queued';
    }, { x: TEST_X, y: TEST_Y });
    console.log(`  Save queued: ${saveResult}`);

    // Wait for the 500ms debounce + network
    await page.waitForTimeout(1500);

    // Check if POST went through
    const postLogs = networkLog.filter(n => n.method === 'POST');
    console.log(`\n  POST requests: ${postLogs.length}`);
    for (const log of postLogs) {
      console.log(`    [${log.type}] ${log.method} ${log.status || ''} body=${log.body || log.postData || ''}`);
    }

    // Verify pixel is in server
    const getAfterDraw = await page.evaluate(async () => {
      const res = await fetch('/api/pixels', { credentials: 'include' });
      const pixels = await res.json();
      return { count: pixels.length, status: res.status };
    });
    console.log(`  Server has ${getAfterDraw.count} pixels after draw`);

    // ── Now erase the pixel ────────────────────────────────────────
    console.log('\n📋 Step 3: Erase the test pixel and observe DELETE request');
    networkLog.length = 0; // Clear log

    const eraseResult = await page.evaluate(({ x, y }) => {
      const game = window.game;
      const pc = game?.pixelCanvas;
      if (!pc) return 'no pixelCanvas';

      pc.erasePixel(x, y);

      // Manually trigger server save with empty color (simulates erase callback)
      game.savePixelToServer?.({ x, y, color: '' });

      const pixelAfterErase = pc.getPixel(x, y);
      return { erased: !pixelAfterErase, pixelCount: pc.getPixelCount() };
    }, { x: TEST_X, y: TEST_Y });
    console.log(`  Local erase result: ${JSON.stringify(eraseResult)}`);
    ok('Pixel removed from local canvas', eraseResult.erased === true);

    // Wait for debounced save
    await page.waitForTimeout(1500);

    // Check DELETE request
    const deleteLogs = networkLog.filter(n => n.method === 'DELETE');
    console.log(`\n  DELETE requests: ${deleteLogs.length}`);
    for (const log of deleteLogs) {
      console.log(`    [${log.type}] ${log.method} ${log.status !== undefined ? 'HTTP ' + log.status : ''} ${log.body || log.postData || ''}`);
    }

    ok('DELETE request was sent', deleteLogs.some(n => n.type === 'request'), 'No DELETE request found!');

    const deleteResponse = deleteLogs.find(n => n.type === 'response');
    if (deleteResponse) {
      ok('DELETE returned 2xx', deleteResponse.status >= 200 && deleteResponse.status < 300,
        `Status: ${deleteResponse.status}, body: ${deleteResponse.body}`);
    } else {
      console.log('  ⚠️  No DELETE response captured yet (might still be pending)');
      failed++;
    }

    // ── Verify pixel is gone from server ──────────────────────────
    console.log('\n📋 Step 4: Verify pixel deleted from server');
    await page.waitForTimeout(500);

    // Direct API call
    const getAfterErase = await page.evaluate(async ({ x, y }) => {
      const res = await fetch(`/api/pixels?minX=${x}&maxX=${x}&minY=${y}&maxY=${y}`, { credentials: 'include' });
      const pixels = await res.json();
      return { pixels, status: res.status };
    }, { x: TEST_X, y: TEST_Y });

    const pixelInDb = getAfterErase.pixels.find((p) => p.x === TEST_X && p.y === TEST_Y);
    console.log(`  DB pixels at test location: ${JSON.stringify(getAfterErase.pixels)}`);
    ok('Pixel deleted from server DB', !pixelInDb, `Still in DB: ${JSON.stringify(pixelInDb)}`);

    // ── Reload and verify it stays gone ──────────────────────────
    console.log('\n📋 Step 5: Reload page and verify pixel stays erased');
    networkLog.length = 0;

    await page.reload();
    await waitForGameReady(page);

    const pixelAfterReload = await page.evaluate(({ x, y }) => {
      const pc = window.game?.pixelCanvas;
      return pc?.getPixel(x, y) || null;
    }, { x: TEST_X, y: TEST_Y });

    ok('Pixel stays erased after reload', !pixelAfterReload, `Pixel reappeared: ${JSON.stringify(pixelAfterReload)}`);

    // ── Check if erasePixel fires savePixelToServer ───────────────
    console.log('\n📋 Step 6: Verify erase callback chain works end-to-end');
    networkLog.length = 0;

    // Draw + erase while in draw mode
    const chainResult = await page.evaluate(({ x, y }) => {
      const game = window.game;
      const pc = game?.pixelCanvas;
      const pdu = game?.pixelDrawUI;
      if (!pc || !pdu) return { ok: false, reason: 'missing components' };

      // Check if savePixelToServer is accessible (it's private, so we check via prototype)
      const hasSave = typeof game.savePixelToServer === 'function';

      // Put down a pixel
      pc.placePixel(x, y, '#0000ff', 'test', 'Test');
      const before = !!pc.getPixel(x, y);

      // Erase it
      pc.erasePixel(x, y);
      const after = !!pc.getPixel(x, y);

      return { ok: true, before, after, hasSave };
    }, { x: TEST_X + 1, y: TEST_Y + 1 });

    console.log(`  Chain result: ${JSON.stringify(chainResult)}`);
    ok('savePixelToServer is accessible', chainResult.hasSave === true, `hasSave=${chainResult.hasSave}`);

    // ── Summary ──────────────────────────────────────────────────
    console.log('\n📋 All captured network logs:');
    for (const log of networkLog) {
      console.log(`  [${log.type}] ${log.method} ${log.status !== undefined ? 'HTTP ' + log.status : ''} ${log.url || ''} ${log.body || log.postData || ''}`);
    }

  } catch (e) {
    console.log(`\n❌ Test threw: ${e.message}`);
    console.log(e.stack);
    failed++;
  } finally {
    await browser.close();
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
