/**
 * Verify all three bottom-left toggle buttons are in zone-bottom-left
 * and share the action-btn class.
 *
 * Usage:
 *   node test_bottom_left_buttons.mjs local
 *   node test_bottom_left_buttons.mjs prod
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'local';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5180';
const HEADLESS = false;

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

(async () => {
  console.log(`\n🗂️  Bottom-left button layout test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  await page.goto(BASE);
  // Wait for the canvas (game initialized)
  await page.waitForSelector('#game-canvas, canvas', { timeout: 25000 });
  // Give the game a moment to append all HUD buttons
  await page.waitForFunction(() => !!document.getElementById('craft-toggle-btn'), { timeout: 15000 });
  await page.waitForFunction(() => !!document.getElementById('territory-draw-btn'), { timeout: 10000 });
  await page.waitForFunction(() => !!document.querySelector('.pixel-draw-toggle'), { timeout: 10000 });

  const result = await page.evaluate(() => {
    const zone = document.getElementById('zone-bottom-left');
    if (!zone) return { zoneExists: false };

    const craft     = document.getElementById('craft-toggle-btn');
    const territory = document.getElementById('territory-draw-btn');
    const draw      = document.querySelector('.pixel-draw-toggle');

    const inZone = (el) => el ? zone.contains(el) : false;
    const hasActionBtn = (el) => el?.classList.contains('action-btn') ?? false;

    // All three should be direct or descendant children of zone
    // Measure their bounding rects — they should all have similar left positions
    const rects = [craft, territory, draw].map(el =>
      el ? el.getBoundingClientRect() : null
    );

    return {
      zoneExists: true,
      craftInZone:     inZone(craft),
      territoryInZone: inZone(territory),
      drawInZone:      inZone(draw),
      craftHasClass:     hasActionBtn(craft),
      territoryHasClass: hasActionBtn(territory),
      drawHasClass:      hasActionBtn(draw),
      // All should share roughly the same left edge (within 10px)
      leftPositions: rects.map(r => r ? Math.round(r.left) : -1),
      // No two buttons should overlap vertically
      tops: rects.map(r => r ? Math.round(r.top) : -1),
    };
  });

  console.log('  Layout data:', JSON.stringify(result, null, 2));

  ok('zone-bottom-left exists', result.zoneExists);
  ok('🔨 craft button inside zone',     result.craftInZone,     'not in zone-bottom-left');
  ok('🎨 draw button inside zone',      result.drawInZone,      'not in zone-bottom-left');
  ok('🏴 territory button inside zone', result.territoryInZone, 'not in zone-bottom-left');
  ok('🔨 craft has action-btn class',     result.craftHasClass);
  ok('🎨 draw has action-btn class',      result.drawHasClass);
  ok('🏴 territory has action-btn class', result.territoryHasClass);

  // Left positions should all be close (same column)
  if (result.leftPositions) {
    const lefts = result.leftPositions.filter((l) => l >= 0);
    const spread = Math.max(...lefts) - Math.min(...lefts);
    ok('All buttons share same left column (spread ≤ 10px)', spread <= 10, `spread=${spread}px`);
  }

  // Tops should all be distinct (no overlap)
  if (result.tops) {
    const tops = result.tops.filter((t) => t >= 0);
    const uniqueTops = new Set(tops);
    ok('All buttons have distinct vertical positions', uniqueTops.size === tops.length,
       `tops=${JSON.stringify(tops)}`);
  }

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
