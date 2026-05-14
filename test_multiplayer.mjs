import { chromium } from 'playwright';

const URL = 'https://gallax.pages.dev';
const HOME_ID = 'bld_1774227799265_prh22a8md';

async function main() {
  // HEADED mode so WebGL works for Mapbox
  const browser = await chromium.launch({ headless: false });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  console.log('Opening Player 1...');
  await page1.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  console.log('Opening Player 2...');
  await page2.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });

  console.log('Waiting for games (up to 60s)...');
  await page1.waitForFunction(() => window.game, { timeout: 60000 });
  await page2.waitForFunction(() => window.game, { timeout: 60000 });
  console.log('Both games loaded!');

  // Wait for geckos connection
  console.log('Waiting for geckos connections...');
  await page1.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 30000 });
  await page2.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 30000 });

  const id1 = await page1.evaluate(() => localStorage.getItem('gallax_guest_id'));
  const id2 = await page2.evaluate(() => localStorage.getItem('gallax_guest_id'));
  console.log('Guest IDs different:', id1 !== id2, '(' + id1?.slice(-8) + ' vs ' + id2?.slice(-8) + ')');

  const pid1 = await page1.evaluate(() => window.game.network.getPlayerId());
  const pid2 = await page2.evaluate(() => window.game.network.getPlayerId());
  console.log('Geckos IDs:', pid1?.slice(0,8) + '...', 'vs', pid2?.slice(0,8) + '...');

  // Both enter the same home
  console.log('\n=== HOME INTERIOR TEST ===');
  await page1.evaluate((h) => { window.game.homeInterior.enter(h, 'Test', 1, true); window.game.network.enterHome(h, 1, 'Player One'); }, HOME_ID);
  console.log('P1 entered home');
  await new Promise(r => setTimeout(r, 2000));

  await page2.evaluate((h) => { window.game.homeInterior.enter(h, 'Test', 10, false); window.game.network.enterHome(h, 10, 'Player Two'); }, HOME_ID);
  console.log('P2 entered home');
  await new Promise(r => setTimeout(r, 3000));

  const p1Others = await page1.evaluate(() => window.game.homeInterior.otherPlayers?.size ?? -1);
  const p2Others = await page2.evaluate(() => window.game.homeInterior.otherPlayers?.size ?? -1);
  console.log('P1 sees', p1Others, 'other(s)', p1Others > 0 ? '✅' : '❌');
  console.log('P2 sees', p2Others, 'other(s)', p2Others > 0 ? '✅' : '❌');

  await page1.screenshot({ path: '/tmp/pw_p1.png' });
  await page2.screenshot({ path: '/tmp/pw_p2.png' });
  console.log('Screenshots: /tmp/pw_p1.png, /tmp/pw_p2.png');

  // Chat test
  console.log('\n=== CHAT TEST ===');
  await page1.evaluate(() => window.game.network.sendChat('hello_from_p1'));
  await new Promise(r => setTimeout(r, 2000));
  const chatOk = await page2.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('hello_from_p1'));
  console.log('Chat sync:', chatOk ? '✅' : '❌');

  // Pixel test
  console.log('\n=== PIXEL TEST ===');
  await page1.evaluate(() => { window.game.pixelCanvas?.placePixel(5555, 5555, '#ff0000', 'x', 'P1'); window.game.network.placePixel(5555, 5555, '#ff0000', 'P1'); });
  await new Promise(r => setTimeout(r, 2000));
  const pixelOk = await page2.evaluate(() => window.game.pixelCanvas?.getPixel(5555, 5555)?.color === '#ff0000');
  console.log('Pixel sync:', pixelOk ? '✅' : '❌');

  await browser.close();
  console.log('\n=== TESTS COMPLETE ===');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
