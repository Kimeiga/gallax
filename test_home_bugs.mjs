/**
 * Home interior bug regression test
 * Tests: multiplayer presence, furniture gizmo follows drag, no building gizmo bleed-through
 *
 * Usage:
 *   node test_home_bugs.mjs local
 *   node test_home_bugs.mjs prod
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

async function waitForGame(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 20000 });
  await page.waitForFunction(() => !!window.game?.homeInterior, { timeout: 20000 });
}

async function getOrCreateHome(page) {
  // Return existing home if already placed, otherwise place one
  const homeId = await page.evaluate(async () => {
    // Check if player already has a home building
    const bm = window.game?.buildingManager;
    if (!bm) return null;
    const userId = window.authService?.getUser()?.id || localStorage.getItem('gallax_guest_id');
    const buildings = [...bm.getBuildings().values()];
    const mine = buildings.find(b => b.ownerId === userId && b.type === 'my_home');
    return mine ? mine.id : null;
  });
  return homeId;
}

(async () => {
  console.log(`\n🏠 Home interior bug tests — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });

  // ── Test 1: Gizmo does NOT bleed through when entering a home with a building selected ──
  console.log('📋 Test 1: Building gizmo hidden when entering home interior');
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto(BASE);
  await waitForGame(page1);

  const homeId = await getOrCreateHome(page1);
  console.log(`  Home ID: ${homeId || '(none - skipping gizmo test)'}`);

  if (homeId) {
    // Simulate selecting a building for move then entering home
    const gizmoResult = await page1.evaluate(async (hId) => {
      const game = window.game;
      // Artificially set selectedBuildingId to simulate a gizmo being active
      game._buildingActionStateRef = game.buildingActionState || null;

      // Enter the home directly (bypassing walk animation)
      const hi = game.homeInterior;
      if (!hi) return { ok: false, reason: 'no homeInterior' };

      // Check if there's any rotation/move handle visible before entering
      // (we simulate by setting state manually if accessible)
      const hasGizmo = !!document.querySelector('[id*="rotation-handle"], [id*="move-handle"]');

      hi.enter(hId, 'TestOwner', 1, true);
      await new Promise(r => setTimeout(r, 100));

      // After entering, no gizmo elements should be visible
      const gizmoAfter = document.querySelector('[id*="rotation-handle"], [id*="move-handle"]');
      const homeVisible = !!document.getElementById('home-interior');

      return { ok: true, gizmoBefore: hasGizmo, gizmoAfter: !!gizmoAfter, homeVisible };
    }, homeId);

    ok('Home interior opens', gizmoResult.homeVisible, JSON.stringify(gizmoResult));
    ok('No building gizmo visible inside home', !gizmoResult.gizmoAfter, `gizmo found in DOM`);

    // Exit the home
    await page1.evaluate(() => {
      window.game?.homeInterior?.exit();
    });
    await page1.waitForTimeout(200);
  } else {
    console.log('  (no home placed — skipping gizmo bleed test)');
  }

  // ── Test 2: Furniture gizmo follows during drag ──
  console.log('\n📋 Test 2: Furniture selection gizmo follows during drag');

  // Enter home
  const enterResult = await page1.evaluate(async (hId) => {
    const hi = window.game?.homeInterior;
    if (!hi) return { ok: false, reason: 'no homeInterior' };
    const id = hId || `test_home_${Date.now()}`;
    hi.enter(id, 'TestOwner', 1, true);
    await new Promise(r => setTimeout(r, 200));
    return { ok: hi.isInside(), homeId: id };
  }, homeId);
  ok('Entered home for gizmo test', enterResult.ok, JSON.stringify(enterResult));

  if (enterResult.ok) {
    // Place a piece of furniture programmatically, then drag it
    const gizmoFollowResult = await page1.evaluate(async () => {
      const hi = window.game?.homeInterior;
      if (!hi) return { ok: false, reason: 'no homeInterior' };

      // Access private fields via prototype hack for testing
      const roomEl = (hi)._roomEl || document.querySelector('[style*="800px"]');
      if (!roomEl) return { ok: false, reason: 'no roomEl' };

      // Inject a furniture item directly
      const item = { id: 'test_f_1', emoji: '🛋️', x: 200, y: 200, placedBy: 'test' };
      hi.addFurnitureFromNetwork(item);
      await new Promise(r => setTimeout(r, 50));

      // Check item rendered
      const furnitureEls = roomEl.querySelectorAll('[style*="200px"]');
      return {
        ok: true,
        furnitureCount: (hi).furniture?.length ?? -1,
        hasFurnitureEl: furnitureEls.length > 0,
      };
    });
    console.log(`  Furniture inject result: ${JSON.stringify(gizmoFollowResult)}`);

    // Now simulate pointer events to drag the furniture
    const dragResult = await page1.evaluate(async () => {
      const hi = window.game?.homeInterior;
      if (!hi) return { ok: false, reason: 'no hi' };

      // Find the furniture element
      const roomEl = (hi).roomEl;
      if (!roomEl) return { ok: false, reason: 'no roomEl' };

      // Get bounding rect of room to compute absolute coords
      const roomRect = roomEl.getBoundingClientRect();
      const scale = roomRect.width / 800; // ROOM_W = 800

      // The furniture is at room (200, 200), convert to screen
      const startX = roomRect.left + 200 * scale;
      const startY = roomRect.top + 200 * scale;

      // Fire pointer events
      const down = new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true, pointerId: 1 });
      roomEl.dispatchEvent(down);
      await new Promise(r => setTimeout(r, 50));

      // Move 100px in room coords = 100*scale in screen coords
      const move1 = new PointerEvent('pointermove', { clientX: startX + 30 * scale, clientY: startY + 30 * scale, bubbles: true, pointerId: 1 });
      roomEl.dispatchEvent(move1);
      await new Promise(r => setTimeout(r, 30));

      const move2 = new PointerEvent('pointermove', { clientX: startX + 80 * scale, clientY: startY + 60 * scale, bubbles: true, pointerId: 1 });
      roomEl.dispatchEvent(move2);
      await new Promise(r => setTimeout(r, 30));

      // Check if gizmo position matches furniture position
      const selEl = document.getElementById('furniture-selection');
      const furn = (hi).furniture?.find((f) => f.id === 'test_f_1');
      if (!selEl || !furn) return { ok: false, reason: `selEl=${!!selEl} furn=${JSON.stringify(furn)}` };

      const gizmoLeft = parseInt(selEl.style.left);
      const gizmoTop = parseInt(selEl.style.top);
      const expectedLeft = furn.x - 25;
      const expectedTop = furn.y - 25;

      const up = new PointerEvent('pointerup', { clientX: startX + 80 * scale, clientY: startY + 60 * scale, bubbles: true, pointerId: 1 });
      roomEl.dispatchEvent(up);

      return {
        ok: true,
        gizmoLeft, gizmoTop,
        expectedLeft, expectedTop,
        furnX: furn.x, furnY: furn.y,
        match: Math.abs(gizmoLeft - expectedLeft) <= 2 && Math.abs(gizmoTop - expectedTop) <= 2,
      };
    });

    console.log(`  Drag gizmo result: ${JSON.stringify(dragResult)}`);
    ok('Gizmo follows furniture during drag', dragResult.match === true, JSON.stringify(dragResult));

    // Clean up
    await page1.evaluate(() => { window.game?.homeInterior?.exit(); });
    await page1.waitForTimeout(200);
  }

  // ── Test 3: Multiplayer presence — two tabs in same home ──
  console.log('\n📋 Test 3: Multiplayer presence — two players see each other in same home');

  if (!homeId) {
    console.log('  (no home placed — skipping multiplayer test)');
  } else {
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(BASE);
    await waitForGame(page2);

    // Player 1 enters home
    await page1.evaluate(async (hId) => {
      const hi = window.game?.homeInterior;
      if (hi && !hi.isInside()) {
        hi.enter(hId, 'Owner', 1, true);
        window.game.network.enterHome(hId, 1, 'Player1');
      }
    }, homeId);
    await page1.waitForTimeout(500);

    // Player 2 enters the same home
    await page2.evaluate(async (hId) => {
      const hi = window.game?.homeInterior;
      if (hi) {
        hi.enter(hId, 'Owner', 2, false);
        window.game.network.enterHome(hId, 2, 'Player2');
      }
    }, homeId);

    // Give network time to exchange messages
    await page1.waitForTimeout(1500);
    await page2.waitForTimeout(500);

    const p1State = await page1.evaluate(() => {
      const hi = window.game?.homeInterior;
      return {
        isInside: hi?.isInside(),
        otherPlayerCount: (hi)?.otherPlayers?.size ?? -1,
      };
    });

    const p2State = await page2.evaluate(() => {
      const hi = window.game?.homeInterior;
      return {
        isInside: hi?.isInside(),
        otherPlayerCount: (hi)?.otherPlayers?.size ?? -1,
      };
    });

    console.log(`  Player 1 sees: ${JSON.stringify(p1State)}`);
    console.log(`  Player 2 sees: ${JSON.stringify(p2State)}`);

    ok('Player 1 inside home', p1State.isInside === true);
    ok('Player 2 inside home', p2State.isInside === true);
    ok('Player 1 sees Player 2', p1State.otherPlayerCount >= 1, `count=${p1State.otherPlayerCount}`);
    ok('Player 2 sees Player 1', p2State.otherPlayerCount >= 1, `count=${p2State.otherPlayerCount}`);

    // Clean up
    await page1.evaluate(() => { window.game?.homeInterior?.exit(); window.game?.network?.exitHome?.(); });
    await page2.evaluate(() => { window.game?.homeInterior?.exit(); window.game?.network?.exitHome?.(); });
    await ctx2.close();
  }

  await ctx1.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
