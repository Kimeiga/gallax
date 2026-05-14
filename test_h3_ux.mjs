/**
 * Tests the improved H3 territory UX:
 * 1. Hex grid outlines appear when entering territory mode
 * 2. Map can be dragged/pinched (quick taps select, drags move map)
 * 3. Select hexes by tapping
 * 4. Confirm to claim
 * 5. Budget enforcement
 * 6. Two-client networking
 *
 * Usage: node test_h3_ux.mjs [local|prod]
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5173';

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

async function waitForGame(page, label) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 25000 });
  await page.waitForFunction(() => !!window.game?.player, { timeout: 20000 });
  await page.waitForFunction(() => !!window.territory, { timeout: 15000 });
  await page.waitForFunction(() => !!window.game?.network?.getPlayerId?.(), { timeout: 30000 });
  console.log(`  ${label} loaded`);
}

(async () => {
  console.log(`\n⬡ H3 Territory UX Test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: false });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('📋 Step 1: Load both clients');
  await Promise.all([p1.goto(BASE), p2.goto(BASE)]);
  await Promise.all([waitForGame(p1, 'Player 1'), waitForGame(p2, 'Player 2')]);
  await p1.evaluate(() => localStorage.removeItem('gallax_territory_daily'));
  await p1.waitForTimeout(2000); // let map fully render

  // ── Step 2: Enter territory mode ───────────────────────────────────────
  console.log('\n📋 Step 2: Player 1 enters territory mode');
  await p1.evaluate(() => document.getElementById('territory-draw-btn')?.click());
  await p1.waitForTimeout(500);

  const modeState = await p1.evaluate(() => {
    const renderer = window.territoryRenderer;
    return {
      active: renderer?.isActive?.(),
      confirmBar: !!document.getElementById('territory-confirm-bar'),
    };
  });
  ok('Territory mode active', modeState?.active);
  ok('Confirm bar visible', modeState?.confirmBar);

  // ── Step 3: Check hex grid outlines are drawn ──────────────────────────
  console.log('\n📋 Step 3: Check hex grid outlines');
  // Force a render
  await p1.evaluate(() => {
    window.territoryRenderer?.markDirty();
    window.territoryRenderer?.flushRender();
  });
  await p1.waitForTimeout(200);

  const gridRendered = await p1.evaluate(() => {
    const canvas = document.getElementById('territory-canvas-overlay');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) nonTransparent++;
    }
    return nonTransparent > 50;
  });
  ok('Hex grid outlines rendered on canvas', gridRendered);

  // ── Step 4: Map drag still works ───────────────────────────────────────
  console.log('\n📋 Step 4: Verify map drag still works');
  const posBefore = await p1.evaluate(() => {
    const map = window.game?.mapManager?.getMap?.();
    const c = map?.getCenter();
    return c ? { lng: c.lng, lat: c.lat } : null;
  });

  // Drag: slow long drag to ensure map moves
  await p1.mouse.move(640, 400);
  await p1.mouse.down();
  for (let i = 0; i < 10; i++) {
    await p1.mouse.move(640 + (i + 1) * 15, 400);
    await p1.waitForTimeout(30);
  }
  await p1.mouse.up();
  await p1.waitForTimeout(500);

  const posAfter = await p1.evaluate(() => {
    const map = window.game?.mapManager?.getMap?.();
    const c = map?.getCenter();
    return c ? { lng: c.lng, lat: c.lat } : null;
  });

  const mapMoved = posBefore && posAfter &&
    (Math.abs(posAfter.lng - posBefore.lng) > 0.0001 || Math.abs(posAfter.lat - posBefore.lat) > 0.0001);
  ok('Map moved during drag (not blocked by territory mode)', mapMoved);

  // ── Step 5: Quick tap selects a hex ────────────────────────────────────
  console.log('\n📋 Step 5: Quick tap selects a hex');
  const cx = 640, cy = 400;

  // Quick taps at 3 spots
  await p1.mouse.click(cx - 60, cy);
  await p1.waitForTimeout(200);
  await p1.mouse.click(cx, cy);
  await p1.waitForTimeout(200);
  await p1.mouse.click(cx + 60, cy);
  await p1.waitForTimeout(300);

  const selectResult = await p1.evaluate(() => {
    const renderer = window.territoryRenderer;
    return {
      count: renderer?.getSelectedCells()?.length || 0,
      confirmText: document.getElementById('territory-confirm-count')?.textContent || '',
    };
  });
  console.log(`  Selected: ${selectResult?.count}, Bar: "${selectResult?.confirmText}"`);
  ok('Hexes selected by tapping', (selectResult?.count || 0) >= 1);
  ok('Confirm bar shows selection count', selectResult?.confirmText?.includes('selected'));

  // ── Step 6: Confirm claim ──────────────────────────────────────────────
  console.log('\n📋 Step 6: Confirm claim');
  await p1.evaluate(() => {
    const bar = document.getElementById('territory-confirm-bar');
    const btn = bar?.querySelector('button');
    btn?.click();
  });
  await p1.waitForTimeout(1000);

  const claimed = await p1.evaluate(() => ({
    cells: window.territory.getAllCells().length,
    modeExited: !window.territoryRenderer?.isActive(),
    barGone: !document.getElementById('territory-confirm-bar'),
  }));
  console.log(`  Claimed ${claimed?.cells} cells`);
  ok('Territory claimed', (claimed?.cells || 0) >= 1);
  ok('Mode auto-exited', claimed?.modeExited);
  ok('Confirm bar gone', claimed?.barGone);

  // ── Step 7: Player 2 sees claims ──────────────────────────────────────
  console.log('\n📋 Step 7: Player 2 sees claims via network');
  await p2.waitForFunction(
    () => window.territory?.getAllCells()?.length > 0,
    { timeout: 10000 },
  ).catch(() => {});

  const p2Count = await p2.evaluate(() => window.territory?.getAllCells()?.length || 0);
  console.log(`  Player 2 sees ${p2Count} cells`);
  ok('Claims propagated to Player 2', p2Count >= 1);

  // ── Step 8: Budget limit ──────────────────────────────────────────────
  console.log('\n📋 Step 8: Budget limit enforcement');
  await p1.evaluate(() => {
    localStorage.setItem('gallax_territory_daily', JSON.stringify({
      date: new Date().toISOString().slice(0, 10), used: 8,
    }));
  });
  await p1.evaluate(() => document.getElementById('territory-draw-btn')?.click());
  await p1.waitForTimeout(500);
  const blocked = await p1.evaluate(() => !window.territoryRenderer?.isActive());
  ok('Mode blocked at daily limit', blocked);

  // ── Step 9: Deselect hex by tapping again ─────────────────────────────
  console.log('\n📋 Step 9: Deselect test');
  await p1.evaluate(() => localStorage.removeItem('gallax_territory_daily'));
  await p1.evaluate(() => document.getElementById('territory-draw-btn')?.click());
  await p1.waitForTimeout(500);

  // Select a hex
  await p1.mouse.click(cx, cy - 100);
  await p1.waitForTimeout(200);
  const countAfterSelect = await p1.evaluate(() => window.territoryRenderer?.getSelectedCells()?.length || 0);

  // Tap same spot to deselect
  await p1.mouse.click(cx, cy - 100);
  await p1.waitForTimeout(200);
  const countAfterDeselect = await p1.evaluate(() => window.territoryRenderer?.getSelectedCells()?.length || 0);
  ok('Tapping same hex deselects it', countAfterDeselect < countAfterSelect);

  // Cancel
  await p1.evaluate(() => document.getElementById('territory-draw-btn')?.click());

  await p1.waitForTimeout(2000);

  await ctx1.close();
  await ctx2.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
