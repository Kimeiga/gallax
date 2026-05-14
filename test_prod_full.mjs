import { chromium } from 'playwright';

const URL = 'https://gallax.pages.dev';
const HOME_ID = 'bld_1774227799265_prh22a8md';
let passed = 0, failed = 0;

function log(test, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${test}${detail ? ' — ' + detail : ''}`);
  if (ok) passed++; else failed++;
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  const p1Errors = [], p2Errors = [];
  p1.on('console', m => { if (m.type() === 'error') p1Errors.push(m.text()); });
  p2.on('console', m => { if (m.type() === 'error') p2Errors.push(m.text()); });

  console.log('Loading players on production...');
  await p1.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p2.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p1.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await p2.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  
  // Wait for guest auto-registration
  await new Promise(r => setTimeout(r, 3000));

  const gid1 = await p1.evaluate(() => localStorage.getItem('gallax_guest_id'));
  const gid2 = await p2.evaluate(() => localStorage.getItem('gallax_guest_id'));
  const pid1 = await p1.evaluate(() => window.game.network.getPlayerId());
  const pid2 = await p2.evaluate(() => window.game.network.getPlayerId());

  console.log('\n=== 1. CONNECTION ===');
  log('Different guest IDs', gid1 !== gid2);
  log('P1 geckos connected', !!pid1);
  log('P2 geckos connected', !!pid2);

  console.log('\n=== 2. CHAT ===');
  await p1.evaluate(() => window.game.network.sendChat('test_p1_msg'));
  await new Promise(r => setTimeout(r, 2000));
  log('P2 sees P1 chat', await p2.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('test_p1_msg')));
  await p2.evaluate(() => window.game.network.sendChat('test_p2_msg'));
  await new Promise(r => setTimeout(r, 2000));
  log('P1 sees P2 chat', await p1.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('test_p2_msg')));

  console.log('\n=== 3. PIXEL REAL-TIME ===');
  await p1.evaluate(() => { window.game.pixelCanvas?.placePixel(8888, 8888, '#ff00ff', 'x', 'P1'); window.game.network.placePixel(8888, 8888, '#ff00ff', 'P1'); });
  await new Promise(r => setTimeout(r, 2000));
  log('P2 sees P1 pixel', await p2.evaluate(() => window.game.pixelCanvas?.getPixel(8888, 8888)?.color === '#ff00ff'));
  await p2.evaluate(() => { window.game.pixelCanvas?.erasePixel(8888, 8888); window.game.network.erasePixel(8888, 8888); });
  await new Promise(r => setTimeout(r, 2000));
  log('P1 sees P2 erase', await p1.evaluate(() => !window.game.pixelCanvas?.getPixel(8888, 8888)));

  console.log('\n=== 4. PIXEL D1 PERSISTENCE ===');
  await p1.evaluate(() => { window.game.pixelCanvas?.placePixel(7777, 7777, '#abcdef', 'x', 'P1'); });
  // Manually trigger save
  await p1.evaluate(async () => {
    const gid = localStorage.getItem('gallax_guest_id');
    await fetch('/api/pixels', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Guest-ID': gid }, body: JSON.stringify([{x:7777,y:7777,color:'#abcdef'}]), credentials: 'include' });
  });
  await new Promise(r => setTimeout(r, 1000));
  const saved = await p1.evaluate(async () => { const r = await fetch('/api/pixels?minX=7777&maxX=7777&minY=7777&maxY=7777'); return (await r.json()).length; });
  log('Pixel saved to D1', saved > 0);
  // Erase
  await p1.evaluate(async () => {
    const gid = localStorage.getItem('gallax_guest_id');
    await fetch('/api/pixels', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Guest-ID': gid }, body: JSON.stringify([{x:7777,y:7777}]), credentials: 'include' });
  });
  await new Promise(r => setTimeout(r, 1000));
  const erased = await p1.evaluate(async () => { const r = await fetch('/api/pixels?minX=7777&maxX=7777&minY=7777&maxY=7777'); return (await r.json()).length; });
  log('Pixel erased from D1', erased === 0);

  console.log('\n=== 5. BUILDINGS ===');
  const bBefore = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.size || 0);
  await p1.evaluate(() => { window.game.buildingManager?.addBuilding({id:'tsync',type:'flag',lng:-73.960,lat:40.780,ownerId:'t',rotation:0}); window.game.network.placeBuilding('flag',-73.960,40.780); });
  await new Promise(r => setTimeout(r, 2000));
  log('P2 sees P1 building', (await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.size || 0)) > bBefore);
  await p1.evaluate(() => { window.game.buildingManager?.removeBuilding('tsync'); window.game.network.deleteBuilding('tsync'); });
  await new Promise(r => setTimeout(r, 2000));
  log('P2 sees P1 delete', await p2.evaluate(() => !window.game.buildingManager?.getBuildings()?.has('tsync')));

  console.log('\n=== 6. NAME CHANGE ===');
  await p1.evaluate(() => window.game.network.setName('TESTNAME'));
  await new Promise(r => setTimeout(r, 2000));
  const nameOk = await p2.evaluate((pid) => { const p = window.game.otherPlayers?.players; if (!p) return false; for (const [,v] of p) { if (v.nameTag?.text === 'TESTNAME') return true; } return false; }, pid1);
  log('P2 sees P1 name change', !!nameOk);

  console.log('\n=== 7. HOME INTERIOR ===');
  await p1.evaluate((h) => { window.game.homeInterior.enter(h,'Test',1,true); window.game.network.enterHome(h,1,'P1'); }, HOME_ID);
  await new Promise(r => setTimeout(r, 2000));
  await p2.evaluate((h) => { window.game.homeInterior.enter(h,'Test',10,false); window.game.network.enterHome(h,10,'P2'); }, HOME_ID);
  await new Promise(r => setTimeout(r, 3000));
  log('P1 sees P2 in home', await p1.evaluate(() => (window.game.homeInterior.otherPlayers?.size || 0) > 0));
  log('P2 sees P1 in home', await p2.evaluate(() => (window.game.homeInterior.otherPlayers?.size || 0) > 0));
  await p1.screenshot({ path: '/tmp/final_p1.png' }); await p2.screenshot({ path: '/tmp/final_p2.png' });
  await p1.evaluate(() => window.game.homeInterior.exit()); await p2.evaluate(() => window.game.homeInterior.exit());
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n=== 8. PLAYER MAP VISIBILITY ===');
  log('P2 sees P1 on map', await p2.evaluate((pid) => window.game.otherPlayers?.players?.has(pid) || false, pid1));
  log('P1 sees P2 on map', await p1.evaluate((pid) => window.game.otherPlayers?.players?.has(pid) || false, pid2));

  console.log('\n=== 9. RESOURCE COLLECTION ===');
  await p1.evaluate(() => window.game.network.collectResource('test_res'));
  await new Promise(r => setTimeout(r, 1000));
  log('P2 sees P1 collect', await p2.evaluate(() => window.game.collectedResourceIds?.has('test_res')));

  console.log('\n=== 10. CONSOLE ERRORS ===');
  const f = e => !e.includes('401') && !e.includes('404') && !e.includes('net::') && !e.includes('Failed to') && !e.includes('wrtc');
  log('P1 no JS errors', p1Errors.filter(f).length === 0, p1Errors.filter(f)[0]?.slice(0,60) || 'clean');
  log('P2 no JS errors', p2Errors.filter(f).length === 0, p2Errors.filter(f)[0]?.slice(0,60) || 'clean');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${passed + failed} TESTS | ${passed} PASSED | ${failed} FAILED`);
  console.log(`${'='.repeat(50)}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
