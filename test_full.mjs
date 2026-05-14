import { chromium } from 'playwright';

const URL = 'https://gallax.pages.dev';
const HOME_ID = 'bld_1774227799265_prh22a8md';
let passed = 0, failed = 0;

function log(test, ok, detail) {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${test}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++; else failed++;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  // Capture console errors
  const p1Errors = [], p2Errors = [];
  p1.on('console', m => { if (m.type() === 'error') p1Errors.push(m.text()); });
  p2.on('console', m => { if (m.type() === 'error') p2Errors.push(m.text()); });

  console.log('Loading both players...');
  await p1.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p2.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p1.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await p2.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });

  const gid1 = await p1.evaluate(() => localStorage.getItem('gallax_guest_id'));
  const gid2 = await p2.evaluate(() => localStorage.getItem('gallax_guest_id'));
  const pid1 = await p1.evaluate(() => window.game.network.getPlayerId());
  const pid2 = await p2.evaluate(() => window.game.network.getPlayerId());

  console.log('\n=== CONNECTION ===');
  log('Different guest IDs', gid1 !== gid2, gid1?.slice(-8) + ' vs ' + gid2?.slice(-8));
  log('Different geckos IDs', pid1 !== pid2);
  log('P1 connected', !!pid1);
  log('P2 connected', !!pid2);

  // Wait for geckos to stabilize
  await new Promise(r => setTimeout(r, 2000));

  // ---------- CHAT ----------
  console.log('\n=== CHAT SYNC ===');
  await p1.evaluate(() => window.game.network.sendChat('msg_from_p1'));
  await new Promise(r => setTimeout(r, 2000));
  const p2SeesChat = await p2.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('msg_from_p1'));
  log('P2 sees P1 chat message', !!p2SeesChat);

  await p2.evaluate(() => window.game.network.sendChat('msg_from_p2'));
  await new Promise(r => setTimeout(r, 2000));
  const p1SeesChat = await p1.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('msg_from_p2'));
  log('P1 sees P2 chat message', !!p1SeesChat);

  // ---------- PIXEL DRAWING ----------
  console.log('\n=== PIXEL DRAWING SYNC ===');
  await p1.evaluate(() => {
    window.game.pixelCanvas?.placePixel(7001, 7001, '#ff0000', 'x', 'P1');
    window.game.network.placePixel(7001, 7001, '#ff0000', 'P1');
  });
  await new Promise(r => setTimeout(r, 2000));
  const p2SeesPixel = await p2.evaluate(() => window.game.pixelCanvas?.getPixel(7001, 7001)?.color === '#ff0000');
  log('P2 sees P1 drawn pixel', !!p2SeesPixel);

  // Erase test
  await p2.evaluate(() => {
    window.game.pixelCanvas?.erasePixel(7001, 7001);
    window.game.network.erasePixel(7001, 7001);
  });
  await new Promise(r => setTimeout(r, 2000));
  const p1SeesErase = await p1.evaluate(() => !window.game.pixelCanvas?.getPixel(7001, 7001));
  log('P1 sees P2 erase pixel', !!p1SeesErase);

  // ---------- BUILDING PLACEMENT ----------
  console.log('\n=== BUILDING SYNC ===');
  const beforeCount = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.size || 0);
  await p1.evaluate(() => {
    window.game.buildingManager?.addBuilding({
      id: 'test_bld_sync', type: 'flag', lng: -73.960, lat: 40.780, ownerId: 'test', rotation: 0
    });
    window.game.network.placeBuilding('flag', -73.960, 40.780);
  });
  await new Promise(r => setTimeout(r, 2000));
  const afterCount = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.size || 0);
  log('P2 sees P1 building placement', afterCount > beforeCount, `${beforeCount} -> ${afterCount}`);

  // Building delete
  await p1.evaluate(() => {
    window.game.buildingManager?.removeBuilding('test_bld_sync');
    window.game.network.deleteBuilding('test_bld_sync');
  });
  await new Promise(r => setTimeout(r, 2000));
  const p2Deleted = await p2.evaluate(() => !window.game.buildingManager?.getBuildings()?.has('test_bld_sync'));
  log('P2 sees P1 building delete', !!p2Deleted);

  // ---------- NAME CHANGE ----------
  console.log('\n=== NAME SYNC ===');
  await p1.evaluate(() => window.game.network.setName('TestName123'));
  await new Promise(r => setTimeout(r, 2000));
  const p2SeesName = await p2.evaluate((pid) => {
    const players = window.game.otherPlayers;
    if (!players) return false;
    const allPlayers = players.getPlayers ? players.getPlayers() : players.players;
    if (!allPlayers) return false;
    for (const [id, p] of allPlayers) {
      if (p.nameTag?.text === 'TestName123') return true;
    }
    return false;
  }, pid1);
  log('P2 sees P1 name change', !!p2SeesName);

  // ---------- HOME INTERIOR ----------
  console.log('\n=== HOME INTERIOR MULTIPLAYER ===');
  await p1.evaluate((h) => {
    window.game.homeInterior.enter(h, 'Owner', 1, true);
    window.game.network.enterHome(h, 1, 'Player One');
  }, HOME_ID);
  await new Promise(r => setTimeout(r, 2000));

  await p2.evaluate((h) => {
    window.game.homeInterior.enter(h, 'Owner', 10, false);
    window.game.network.enterHome(h, 10, 'Player Two');
  }, HOME_ID);
  await new Promise(r => setTimeout(r, 3000));

  const p1SeesP2Home = await p1.evaluate(() => window.game.homeInterior.otherPlayers?.size > 0);
  const p2SeesP1Home = await p2.evaluate(() => window.game.homeInterior.otherPlayers?.size > 0);
  log('P1 sees P2 in home', !!p1SeesP2Home);
  log('P2 sees P1 in home', !!p2SeesP1Home);

  // Screenshots
  await p1.screenshot({ path: '/tmp/test_p1_home.png' });
  await p2.screenshot({ path: '/tmp/test_p2_home.png' });

  // Exit home
  await p1.evaluate(() => window.game.homeInterior.exit());
  await p2.evaluate(() => window.game.homeInterior.exit());
  await new Promise(r => setTimeout(r, 1000));

  // ---------- PLAYER MOVEMENT ----------
  console.log('\n=== PLAYER MOVEMENT ===');
  const p2SeesP1 = await p2.evaluate((pid) => {
    const players = window.game.otherPlayers;
    if (!players) return false;
    const allPlayers = players.getPlayers ? players.getPlayers() : players.players;
    return allPlayers ? allPlayers.has(pid) : false;
  }, pid1);
  log('P2 sees P1 as other player', !!p2SeesP1);

  const p1SeesP2 = await p1.evaluate((pid) => {
    const players = window.game.otherPlayers;
    if (!players) return false;
    const allPlayers = players.getPlayers ? players.getPlayers() : players.players;
    return allPlayers ? allPlayers.has(pid) : false;
  }, pid2);
  log('P1 sees P2 as other player', !!p1SeesP2);

  // ---------- RESOURCE COLLECTION ----------
  console.log('\n=== RESOURCE COLLECTION ===');
  await p1.evaluate(() => window.game.network.collectResource('test_resource_123'));
  await new Promise(r => setTimeout(r, 1000));
  const p2ResourceGone = await p2.evaluate(() => window.game.collectedResourceIds?.has('test_resource_123'));
  log('P2 sees P1 resource collection', !!p2ResourceGone);

  // ---------- CONSOLE ERRORS ----------
  console.log('\n=== CONSOLE ERRORS ===');
  const criticalP1 = p1Errors.filter(e => !e.includes('Failed to fetch') && !e.includes('net::'));
  const criticalP2 = p2Errors.filter(e => !e.includes('Failed to fetch') && !e.includes('net::'));
  log('P1 no critical errors', criticalP1.length === 0, criticalP1.length > 0 ? criticalP1[0]?.slice(0,80) : 'clean');
  log('P2 no critical errors', criticalP2.length === 0, criticalP2.length > 0 ? criticalP2[0]?.slice(0,80) : 'clean');

  // ---------- SUMMARY ----------
  console.log(`\n${'='.repeat(40)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);

  await browser.close();

  // Cleanup test pixel
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
