/**
 * Ghost-player test: player disconnects while inside a home.
 * The remaining player should see the avatar disappear.
 *
 * Usage:
 *   node test_ghost_player.mjs prod
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5180';
const HOME_ID = 'ghost_test_home_1';
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

async function enterHome(page, homeId) {
  await page.evaluate((hId) => {
    const hi = window.game.homeInterior;
    if (!hi.isInside()) hi.enter(hId, 'TestHome', 1, false);
    window.game.network.enterHome(hId, 1, 'TestPlayer');
  }, homeId);
}

(async () => {
  console.log(`\n👻  Ghost-player disconnect test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  console.log('📋 Step 1: Both players load the game');
  await Promise.all([page1.goto(BASE), page2.goto(BASE)]);
  await Promise.all([waitForGame(page1), waitForGame(page2)]);
  ok('Both pages loaded', true);

  console.log('\n📋 Step 2: Both enter home ' + HOME_ID);
  await enterHome(page1, HOME_ID);
  await page1.waitForTimeout(500);
  await enterHome(page2, HOME_ID);
  await page1.waitForTimeout(1000);

  const p1sees = await page1.evaluate(() =>
    window.game.homeInterior?.otherPlayers?.size ?? -1
  );
  ok('Player 1 sees Player 2 in home', p1sees >= 1, `otherPlayers=${p1sees}`);

  console.log('\n📋 Step 3: Player 2 disconnects (close browser context)');
  await ctx2.close(); // hard disconnect, no clean exit_home
  // WebRTC ICE failure detection typically takes 5–15s; wait up to 20s for cleanup
  await page1.waitForFunction(
    () => (window.game?.homeInterior?.otherPlayers?.size ?? 1) === 0,
    { timeout: 20000 }
  ).catch(() => {}); // don't throw — let ok() report the failure

  const p1seesAfter = await page1.evaluate(() =>
    window.game.homeInterior?.otherPlayers?.size ?? -1
  );
  ok('Player 1 no longer sees Player 2 after disconnect', p1seesAfter === 0,
     `otherPlayers=${p1seesAfter}`);

  // Cleanup
  await page1.evaluate(() => {
    window.game?.homeInterior?.exit();
    window.game?.network?.exitHome?.();
  });
  await ctx1.close();
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
