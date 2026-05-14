/**
 * Tests that renaming propagates everywhere:
 * 1. Other player's name tag inside a shared home updates
 * 2. Building name tag on the map updates when owner renames
 *
 * Usage:
 *   node test_rename_propagation.mjs prod
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5180';
const HOME_ID = 'rename_prop_test_7';
const HEADLESS = false;

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

async function waitForGame(page) {
  await page.waitForSelector('#game-canvas, canvas', { timeout: 25000 });
  await page.waitForFunction(() => !!window.game?.homeInterior, { timeout: 20000 });
  await page.waitForFunction(() => !!window.game?.network?.getPlayerId?.(), { timeout: 30000 });
}

(async () => {
  console.log(`\n📛  Rename propagation test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  console.log('📋 Step 1: Both players load the game');
  await Promise.all([page1.goto(BASE), page2.goto(BASE)]);
  await Promise.all([waitForGame(page1), waitForGame(page2)]);
  ok('Both pages loaded', true);

  const NAME_A1 = 'PlayerA_' + Date.now().toString(36);
  const NAME_A2 = 'PlayerA_renamed_' + Date.now().toString(36);
  const NAME_B  = 'PlayerB_' + Date.now().toString(36);

  // Set initial names
  await page1.evaluate((n) => { window.game.playerName = n; window.game.player?.setName(n); window.game.network.setName(n); }, NAME_A1);
  await page2.evaluate((n) => { window.game.playerName = n; window.game.player?.setName(n); window.game.network.setName(n); }, NAME_B);
  await page1.waitForTimeout(800);

  // ── Test 1: Other player name tag inside home ──────────────────
  console.log('\n📋 Test 1: Both enter same home, Player A renames, Player B sees update');

  await page1.evaluate(({ homeId, name }) => {
    const hi = window.game.homeInterior;
    hi.enter(homeId, name, 1, true);
    window.game.network.enterHome(homeId, 1, name);
  }, { homeId: HOME_ID, name: NAME_A1 });

  await page2.evaluate(({ homeId, name }) => {
    const hi = window.game.homeInterior;
    hi.enter(homeId, name, 2, false);
    window.game.network.enterHome(homeId, 2, name);
  }, { homeId: HOME_ID, name: NAME_B });

  await page1.waitForTimeout(1000);

  // Verify player B sees player A in the home
  const aInB_before = await page2.evaluate((n) => {
    const hi = window.game.homeInterior;
    for (const [, p] of hi.otherPlayers) {
      if (p.name === n) return true;
    }
    return false;
  }, NAME_A1);
  ok('Player B sees Player A (initial name) in home', aInB_before);

  // Player A renames
  await page1.evaluate(({ oldName, newName }) => {
    window.game.playerName = newName;
    window.game.player?.setName(newName);
    window.game.network.setName(newName);
    window.game.homeInterior?.updateLocalPlayerName(newName);
  }, { oldName: NAME_A1, newName: NAME_A2 });

  // Wait for network delivery
  await page2.waitForFunction(
    (n) => {
      const hi = window.game.homeInterior;
      for (const [, p] of hi.otherPlayers) {
        if (p.name === n) return true;
      }
      return false;
    },
    { timeout: 8000 },
    NAME_A2
  ).catch(() => {});

  const aInB_after = await page2.evaluate(({ newName, oldName }) => {
    const hi = window.game.homeInterior;
    let found = { newName: false, oldName: false };
    for (const [, p] of hi.otherPlayers) {
      if (p.name === newName) found.newName = true;
      if (p.name === oldName) found.oldName = true;
    }
    // Also check DOM name tags
    const nameTags = Array.from(hi.otherPlayers.values())
      .map(p => p.el?.firstElementChild?.textContent ?? '');
    return { ...found, nameTags };
  }, { newName: NAME_A2, oldName: NAME_A1 });

  console.log('  Player B sees after rename:', JSON.stringify(aInB_after));
  ok('Player B sees Player A\'s new name (data)', aInB_after.newName, `found=${JSON.stringify(aInB_after)}`);
  ok('Player B no longer sees old name (data)', !aInB_after.oldName);
  ok('DOM name tag updated', aInB_after.nameTags.includes(NAME_A2), `tags=${JSON.stringify(aInB_after.nameTags)}`);

  // Exit home
  await page1.evaluate(() => { window.game?.homeInterior?.exit(); window.game?.network?.exitHome?.(); });
  await page2.evaluate(() => { window.game?.homeInterior?.exit(); window.game?.network?.exitHome?.(); });

  // ── Test 2: Building name tag on map ──────────────────────────
  console.log('\n📋 Test 2: Player A places a building, renames — building tag updates');

  const BLD_ID = `bld_nametest_${Date.now()}`;
  const BLD_LNG = -73.985 + Math.random() * 0.01;
  const BLD_LAT = 40.748 + Math.random() * 0.01;

  // Inject a building owned by player A's auth/local ID
  await page1.evaluate(({ bldId, lng, lat, ownerName }) => {
    window.game.buildingManager?.addBuilding({
      id: bldId,
      type: 'my_home',
      lng, lat,
      ownerId: 'local', // same as authService.getUser()?.id || 'local' for guest
      ownerName,
      rotation: 0,
    });
  }, { bldId: BLD_ID, lng: BLD_LNG, lat: BLD_LAT, ownerName: NAME_A2 });

  await page1.waitForTimeout(200);

  const tagBefore = await page1.evaluate(({ bldId }) => {
    const b = window.game.buildingManager?.getBuildings().get(bldId);
    return b?.nameTag?.text ?? null;
  }, { bldId: BLD_ID });
  console.log('  Building name tag before rename:', tagBefore);
  ok('Building name tag set initially', tagBefore?.includes(NAME_A2), `tag="${tagBefore}"`);

  const NAME_A3 = 'PlayerA_final_' + Date.now().toString(36);
  await page1.evaluate((name) => {
    window.game.playerName = name;
    window.game.player?.setName(name);
    window.game.network.setName(name);
    window.game.homeInterior?.updateLocalPlayerName(name);
    // Same logic as setName() in Game.ts
    const ownBuildingId = 'local'; // authService.getUser()?.id || 'local' for guest
    window.game.buildingManager?.updateOwnerName(ownBuildingId, name);
  }, NAME_A3);

  await page1.waitForTimeout(300);

  const tagAfter = await page1.evaluate(({ bldId, name }) => {
    const b = window.game.buildingManager?.getBuildings().get(bldId);
    return { tag: b?.nameTag?.text ?? null, ownerName: b?.ownerName };
  }, { bldId: BLD_ID, name: NAME_A3 });
  console.log('  Building name tag after rename:', tagAfter);
  ok('Building name tag updated on map', tagAfter.tag?.includes(NAME_A3), `tag="${tagAfter.tag}"`);
  ok('Building ownerName field updated', tagAfter.ownerName === NAME_A3, `ownerName="${tagAfter.ownerName}"`);

  await ctx1.close();
  await ctx2.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
