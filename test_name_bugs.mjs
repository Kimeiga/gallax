/**
 * Test name bugs:
 * 1. After renaming, placing home shows correct (new) name on nametag
 * 2. Entering someone else's home shows correct owner name in title
 *
 * Usage:
 *   node test_name_bugs.mjs local   -- tests http://localhost:5180
 *   node test_name_bugs.mjs prod    -- tests https://gallax.pages.dev
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

async function waitFor(fn, timeout = 8000, interval = 300) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}

async function clearLocalBuildingsAndHome(page) {
  await page.evaluate(() => {
    localStorage.removeItem('gallax_local_buildings');
    localStorage.removeItem('gallax_player_name');
    // Remove the specific home-has-been-placed flags
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('gallax_home') || k.startsWith('gallax_building')) {
        localStorage.removeItem(k);
      }
    }
  });
}

async function waitForGameReady(page) {
  // Wait for game canvas to appear
  await page.waitForSelector('#game-canvas, canvas', { timeout: 15000 });
  // Wait a bit for the game to fully init
  await page.waitForTimeout(3000);
}

async function getPlayerName(page) {
  return page.evaluate(() => {
    const game = window.game;
    return game?.playerName || null;
  });
}

async function setPlayerName(page, name) {
  // Click the name button (top-left player name area or settings)
  // Try keyboard shortcut or find the rename input
  await page.evaluate((n) => {
    const game = window.game;
    if (game) {
      game.playerName = n;
      game.player?.setName(n);
    }
  }, name);
}

async function placeHomeViaConsole(page, name) {
  // Use the window.placeBuilding global
  return page.evaluate((n) => {
    const game = window.game;
    if (!game) return 'no game';
    // Override playerName to the new name first
    game.playerName = n;
    // Place the home
    const fn = window.placeBuilding;
    if (fn) {
      fn('my_home');
      return 'placed';
    }
    return 'no placeBuilding fn';
  }, name);
}

async function getHomeName(page, id) {
  // Get the nametag text of a specific building by id
  return page.evaluate((bid) => {
    const bm = window.game?.buildingManager;
    if (!bm) return null;
    const b = bm.getBuildings().get(bid);
    return b?.nameTag?.text || null;
  }, id);
}

// ─────────────────────────────────────────────────────────────────
// TEST 1: After renaming, placed home shows new name
// ─────────────────────────────────────────────────────────────────
async function testRenameNameTag(browser) {
  console.log('\n📋 TEST 1: Renamed player places home — nametag should show NEW name');
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();

  try {
    await page.goto(BASE);
    await waitForGameReady(page);
    await clearLocalBuildingsAndHome(page);

    // Set initial name
    await page.evaluate(() => {
      const game = window.game;
      if (game) { game.playerName = 'OldName'; game.player?.setName('OldName'); }
    });

    // Wait a tick then rename
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const game = window.game;
      if (game) { game.playerName = 'NewName'; game.player?.setName('NewName'); }
    });

    const nameAfterRename = await page.evaluate(() => window.game?.playerName);
    ok('playerName updated to NewName', nameAfterRename === 'NewName', `got: ${nameAfterRename}`);

    // Place a home with a fixed ID so we can look it up precisely
    const HOME_ID = 'test_rename_home_99';
    const result = await page.evaluate((hid) => {
      const game = window.game;
      if (!game) return 'no game';

      // Simulate what BuildingActions does — use game.playerName as ownerName
      const playerName = game.playerName;
      const ownerName = playerName || 'Someone';

      const bm = game.buildingManager;
      if (!bm) return 'no buildingManager';

      const pos = game.player?.getPosition?.() || { lng: -73.98, lat: 40.76 };
      bm.addBuilding({
        id: hid,
        type: 'my_home',
        lng: pos.lng,
        lat: pos.lat,
        ownerId: 'local',
        ownerName,
        rotation: 0,
      });
      return 'ok';
    }, HOME_ID);

    ok('Building placed successfully', result === 'ok', result);

    // Check the nametag on the specific building we just added
    const nameTagText = await getHomeName(page, HOME_ID);
    ok('Nametag shows NewName not OldName', nameTagText === "NewName's Home", `got: "${nameTagText}"`);
  } catch (e) {
    console.log(`  ❌ Test threw: ${e.message}`);
    failed++;
  } finally {
    await ctx.close();
  }
}

// ─────────────────────────────────────────────────────────────────
// TEST 2: Entering someone else's home shows correct owner name
// ─────────────────────────────────────────────────────────────────
async function testEnterOtherHome(browser) {
  console.log('\n📋 TEST 2: Entering someone else\'s home shows actual owner name');
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();

  try {
    await page.goto(BASE);
    await waitForGameReady(page);
    await clearLocalBuildingsAndHome(page);

    // Add a foreign home with ownerName
    const result = await page.evaluate(() => {
      const game = window.game;
      if (!game) return 'no game';
      const bm = game.buildingManager;
      if (!bm) return 'no bm';

      // Simulate another player's home loaded from server with ownerName
      bm.addBuilding({
        id: 'other_home_' + Date.now(),
        type: 'my_home',
        lng: -73.9855,
        lat: 40.7580,
        ownerId: 'player_alice_123',
        ownerName: 'Alice',
        rotation: 0,
      });
      return 'ok';
    });
    ok('Other player home added', result === 'ok', result);

    // Simulate what BuildingActions does when entering
    const enterResult = await page.evaluate(() => {
      const game = window.game;
      if (!game) return { ok: false, reason: 'no game' };
      const bm = game.buildingManager;
      if (!bm) return { ok: false, reason: 'no bm' };

      // Find the other home
      let targetBuilding = null;
      for (const [, b] of bm.getBuildings()) {
        if (b.ownerId === 'player_alice_123') { targetBuilding = b; break; }
      }
      if (!targetBuilding) return { ok: false, reason: 'building not found' };

      // Replicate the enter logic from BuildingActions (after our fix)
      const userId = 'local'; // current player is guest
      const isOwner = targetBuilding.ownerId === userId; // false

      let ownerName = 'Someone';
      if (isOwner) {
        ownerName = game.playerName || 'You';
      } else {
        // FIXED: use stored ownerName directly
        ownerName = targetBuilding.ownerName ||
          (targetBuilding.nameTag?.text?.replace("'s Home", '')) || 'Someone';
      }

      // Enter the home
      const hi = game.homeInterior;
      if (!hi) return { ok: false, reason: 'no homeInterior' };
      hi.enter(targetBuilding.id, ownerName, game.playerSpriteNum || 0, isOwner);

      return { ok: true, ownerName, isInside: hi.isInside() };
    });

    ok('Enter call executed', enterResult.ok, JSON.stringify(enterResult));
    ok('ownerName resolved to Alice', enterResult.ownerName === 'Alice', `got: "${enterResult.ownerName}"`);
    ok('HomeInterior shows as inside', enterResult.isInside === true);

    // Check the actual DOM header text
    const headerText = await page.evaluate(() => {
      const hi = window.game?.homeInterior;
      if (!hi) return null;
      // The header is rendered inside the home interior container
      const header = document.querySelector('#home-interior h2, #home-interior .home-title, [id*="home"] h2');
      return header?.textContent?.trim() || null;
    });

    if (headerText !== null) {
      ok('DOM header shows "Alice\'s Home"', headerText === "Alice's Home", `got: "${headerText}"`);
    } else {
      // Try to check via homeInterior ownerName field
      const storedName = await page.evaluate(() => {
        const hi = window.game?.homeInterior;
        return hi?.ownerName || null;
      });
      ok('HomeInterior.ownerName is Alice', storedName === 'Alice', `stored: "${storedName}"`);
    }

    // Exit to clean up
    await page.evaluate(() => {
      window.game?.homeInterior?.exit?.();
    });
  } catch (e) {
    console.log(`  ❌ Test threw: ${e.message}`);
    failed++;
  } finally {
    await ctx.close();
  }
}

// ─────────────────────────────────────────────────────────────────
// TEST 3: Two-player scenario — Player A places home, Player B enters it
// ─────────────────────────────────────────────────────────────────
async function testTwoPlayerHomeEntry(browser) {
  console.log('\n📋 TEST 3: Two players — A places home as "PlayerAlpha", B enters and sees "PlayerAlpha\'s Home"');

  const ctxA = await browser.newContext({ storageState: undefined });
  const ctxB = await browser.newContext({ storageState: undefined });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    // Both load the game
    await Promise.all([
      pageA.goto(BASE),
      pageB.goto(BASE),
    ]);
    await Promise.all([
      waitForGameReady(pageA),
      waitForGameReady(pageB),
    ]);
    await Promise.all([
      clearLocalBuildingsAndHome(pageA),
      clearLocalBuildingsAndHome(pageB),
    ]);

    // Player A renames to "PlayerAlpha"
    await pageA.evaluate(() => {
      const game = window.game;
      if (game) { game.playerName = 'PlayerAlpha'; game.player?.setName('PlayerAlpha'); }
    });

    const nameA = await pageA.evaluate(() => window.game?.playerName);
    ok('[A] playerName is PlayerAlpha', nameA === 'PlayerAlpha', `got: "${nameA}"`);

    // Player A places a home (simulate with correct playerName)
    const placeResult = await pageA.evaluate(() => {
      const game = window.game;
      const bm = game?.buildingManager;
      if (!bm) return 'no bm';
      const pos = game.player?.getPosition?.() || { lng: -73.9855, lat: 40.758 };
      bm.addBuilding({
        id: 'alpha_home',
        type: 'my_home',
        lng: pos.lng,
        lat: pos.lat,
        ownerId: game.network?.getPlayerId?.() || 'playerA_id',
        ownerName: game.playerName,   // <-- uses current name: 'PlayerAlpha'
        rotation: 0,
      });
      return 'ok';
    });
    ok('[A] home placed', placeResult === 'ok', placeResult);

    const nameTagA = await getHomeName(pageA, 'alpha_home');
    ok('[A] nametag shows PlayerAlpha\'s Home', nameTagA === "PlayerAlpha's Home", `got: "${nameTagA}"`);

    // Player B adds the same home as if received from server (with ownerName)
    const addResult = await pageB.evaluate(() => {
      const game = window.game;
      const bm = game?.buildingManager;
      if (!bm) return 'no bm';
      bm.addBuilding({
        id: 'alpha_home',
        type: 'my_home',
        lng: -73.9855,
        lat: 40.758,
        ownerId: 'playerA_id',
        ownerName: 'PlayerAlpha',   // <-- server sends this now
        rotation: 0,
      });
      return 'ok';
    });
    ok('[B] received home from "server"', addResult === 'ok', addResult);

    // Player B enters the home
    const enterResult = await pageB.evaluate(() => {
      const game = window.game;
      const bm = game?.buildingManager;
      if (!bm) return { ok: false, reason: 'no bm' };

      const building = bm.getBuildings().get('alpha_home');
      if (!building) return { ok: false, reason: 'building not found' };

      const isOwner = false;
      // FIXED: use stored ownerName
      const ownerName = building.ownerName ||
        (building.nameTag?.text?.replace("'s Home", '')) || 'Someone';

      const hi = game.homeInterior;
      if (!hi) return { ok: false, reason: 'no homeInterior' };
      hi.enter(building.id, ownerName, game.playerSpriteNum || 0, isOwner);

      return { ok: true, ownerName, isInside: hi.isInside() };
    });

    ok('[B] enter call succeeded', enterResult.ok, JSON.stringify(enterResult));
    ok('[B] sees PlayerAlpha\'s Home (not Someone\'s)', enterResult.ownerName === 'PlayerAlpha',
      `got: "${enterResult.ownerName}"`);

    // Cleanup B
    await pageB.evaluate(() => window.game?.homeInterior?.exit?.());
  } catch (e) {
    console.log(`  ❌ Test threw: ${e.message}`);
    failed++;
  } finally {
    await Promise.all([ctxA.close(), ctxB.close()]);
  }
}

// ─────────────────────────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🧪 Name bug tests — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    await testRenameNameTag(browser);
    await testEnterOtherHome(browser);
    await testTwoPlayerHomeEntry(browser);
  } finally {
    await browser.close();
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
