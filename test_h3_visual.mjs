/**
 * Visual test: actually claim territory by drawing on the map and verify hexagons render.
 * Opens the game, clicks the territory button, drags to claim cells, checks results.
 *
 * Usage: node test_h3_visual.mjs [local|prod]
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5173';

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

async function waitForGame(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 25000 });
  await page.waitForFunction(() => !!window.game?.player, { timeout: 20000 });
  await page.waitForFunction(() => !!window.territory, { timeout: 15000 });
}

(async () => {
  console.log(`\n⬡ H3 Visual Territory Test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('📋 Step 1: Load game and wait for player');
  await page.goto(BASE);
  await waitForGame(page);
  await page.waitForTimeout(2000); // let map fully render
  ok('Game loaded', true);

  // Step 2: Click the territory draw button (🏴)
  console.log('\n📋 Step 2: Enter territory draw mode');
  const btnClicked = await page.evaluate(() => {
    const btn = document.getElementById('territory-draw-btn');
    if (!btn) return false;
    btn.click();
    return true;
  });
  ok('Territory button found and clicked', btnClicked);
  await page.waitForTimeout(500);

  // Verify draw mode is active
  const drawModeActive = await page.evaluate(() => {
    const canvas = document.getElementById('territory-canvas-overlay');
    return canvas?.style.pointerEvents === 'auto' && canvas?.style.cursor === 'crosshair';
  });
  ok('Draw mode active (canvas accepts pointer events)', drawModeActive);

  // Step 3: Draw territory by dragging across the center of the screen
  console.log('\n📋 Step 3: Draw territory by dragging');
  const cx = 640, cy = 400;

  // Drag a line across the center
  await page.mouse.move(cx - 100, cy);
  await page.mouse.down();
  for (let x = cx - 100; x <= cx + 100; x += 20) {
    await page.mouse.move(x, cy);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Check how many cells were claimed
  const afterDraw = await page.evaluate(() => {
    const ts = window.territory;
    const allCells = ts.getAllCells();
    return {
      totalCells: allCells.length,
      sampleH3: allCells[0]?.h3Index || null,
      sampleOwner: allCells[0]?.ownerId || null,
    };
  });
  console.log(`  Cells after drawing: ${afterDraw.totalCells}, sample H3: ${afterDraw.sampleH3}`);
  ok('Territory cells were claimed', afterDraw.totalCells > 0);
  ok('Cells use H3 index format (15+ hex chars)', afterDraw.sampleH3?.length >= 15);

  // Step 4: Check that hexagons are rendered on the canvas
  console.log('\n📋 Step 4: Verify hexagons are rendered');
  // Force a render and check pixel data on the territory canvas
  const hexRendered = await page.evaluate(() => {
    const canvas = document.getElementById('territory-canvas-overlay');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // Check if any non-transparent pixels exist (meaning something was drawn)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let nonTransparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) nonTransparent++;
    }
    return nonTransparent > 100; // should have many colored pixels
  });
  ok('Hexagonal territory rendered on canvas', hexRendered);

  // Step 5: Drag over claimed cells to unclaim them
  console.log('\n📋 Step 5: Unclaim by dragging over own cells');
  const beforeUnclaim = afterDraw.totalCells;
  await page.mouse.move(cx - 50, cy);
  await page.mouse.down();
  for (let x = cx - 50; x <= cx + 50; x += 20) {
    await page.mouse.move(x, cy);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const afterUnclaim = await page.evaluate(() => {
    return window.territory.getAllCells().length;
  });
  console.log(`  Cells before unclaim: ${beforeUnclaim}, after: ${afterUnclaim}`);
  ok('Some cells were unclaimed', afterUnclaim < beforeUnclaim);

  // Step 6: Exit draw mode
  console.log('\n📋 Step 6: Exit draw mode');
  await page.evaluate(() => {
    document.getElementById('territory-draw-btn')?.click();
  });
  await page.waitForTimeout(300);
  const drawModeOff = await page.evaluate(() => {
    const canvas = document.getElementById('territory-canvas-overlay');
    return canvas?.style.pointerEvents === 'none';
  });
  ok('Draw mode deactivated', drawModeOff);

  // Keep browser open for 3 seconds to visually inspect
  console.log('\n👀 Visual inspection window (3s)...');
  await page.waitForTimeout(3000);

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
