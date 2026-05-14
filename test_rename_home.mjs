/**
 * Rename-while-in-home test:
 * Enter your home, rename yourself, verify header + name tag update live.
 *
 * Usage:
 *   node test_rename_home.mjs prod
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'prod' ? 'https://gallax.pages.dev' : 'http://localhost:5180';
const HOME_ID = 'rename_test_home_99';
const HEADLESS = false;

let passed = 0, failed = 0;
function ok(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

(async () => {
  console.log(`\n✏️  Rename-while-in-home test — ${MODE.toUpperCase()} (${BASE})\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  await page.goto(BASE);
  await page.waitForSelector('#game-canvas, canvas', { timeout: 25000 });
  await page.waitForFunction(() => !!window.game?.homeInterior, { timeout: 20000 });
  await page.waitForFunction(() => !!window.game?.network?.getPlayerId?.(), { timeout: 30000 });

  // Give game a moment to set up player name
  await page.waitForTimeout(500);

  // Enter a home as owner
  const INITIAL_NAME = 'OldName_' + Date.now().toString(36);
  const NEW_NAME     = 'NewName_' + Date.now().toString(36);

  await page.evaluate(({ homeId, name }) => {
    window.game.playerName = name;
    window.game.player?.setName(name);
    const hi = window.game.homeInterior;
    hi.enter(homeId, name, 1, true); // isOwner = true
    window.game.network.enterHome(homeId, 1, name);
  }, { homeId: HOME_ID, name: INITIAL_NAME });

  await page.waitForTimeout(300);

  const before = await page.evaluate(({ initialName }) => {
    const hi = window.game.homeInterior;
    const header = document.querySelector('#home-interior div')?.textContent ?? '';
    const nameTag = hi?.playerNameTagEl?.textContent ?? hi?._playerNameTagEl?.textContent ?? null;
    return { header, ownerName: hi?.ownerName, nameTagEl: nameTag };
  }, { initialName: INITIAL_NAME });

  console.log('  Before rename:', JSON.stringify(before));
  ok('Header shows initial name before rename',
     before.header.includes(INITIAL_NAME), `header="${before.header}"`);

  // Trigger rename via the game's internal mechanism (same as setName in createNameInputUI)
  await page.evaluate((newName) => {
    const game = window.game;
    game.playerName = newName;
    game.player?.setName(newName);
    game.network?.setName(newName);
    game.homeInterior?.updateLocalPlayerName(newName);
    const el = document.getElementById('user-name');
    if (el) el.textContent = newName;
  }, NEW_NAME);

  await page.waitForTimeout(200);

  const after = await page.evaluate(({ newName }) => {
    const hi = window.game.homeInterior;
    // Find header element (first child div of #home-interior)
    const headerEl = document.querySelector('#home-interior [style*="font-size:18px"], #home-interior [style*="font-size: 18px"]');
    const header = headerEl?.textContent ?? '';
    return {
      header,
      ownerName: hi?.ownerName,
    };
  }, { newName: NEW_NAME });

  console.log('  After rename:', JSON.stringify(after));
  ok('ownerName updated on HomeInterior',
     after.ownerName === NEW_NAME, `ownerName="${after.ownerName}"`);
  ok('Header updated to new name',
     after.header.includes(NEW_NAME), `header="${after.header}"`);
  ok('Header no longer shows old name',
     !after.header.includes(INITIAL_NAME), `header="${after.header}"`);

  // Exit home
  await page.evaluate(() => {
    window.game?.homeInterior?.exit();
    window.game?.network?.exitHome?.();
  });

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
