import { chromium } from 'playwright';
const URL = 'https://gallax.pages.dev';
const HOME_ID = 'bld_1774227799265_prh22a8md';
let passed=0,failed=0;
function log(t,ok,d){console.log(`  ${ok?'✅':'❌'} ${t}${d?' — '+d:''}`);ok?passed++:failed++;}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const p1 = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  await p1.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p2.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p1.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await p2.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Connected\n');

  // Use the existing home building that both players have from D1
  console.log('=== BUILDING MOVE ===');
  const origPos = await p2.evaluate(() => {
    const b = window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md');
    return b ? {lng:b.lng, lat:b.lat} : null;
  });
  log('P2 has building', !!origPos, origPos ? `${origPos.lng.toFixed(4)}, ${origPos.lat.toFixed(4)}` : 'null');

  // P1 moves it
  await p1.evaluate(() => {
    window.game.buildingManager?.moveBuilding('bld_1774227799265_prh22a8md', -73.968, 40.785);
    window.game.network.moveBuilding('bld_1774227799265_prh22a8md', -73.968, 40.785);
  });
  await new Promise(r => setTimeout(r, 2000));
  const newPos = await p2.evaluate(() => {
    const b = window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md');
    return b ? {lng:b.lng, lat:b.lat} : null;
  });
  log('P2 sees move', newPos && Math.abs(newPos.lng-(-73.968))<0.001, newPos ? `${newPos.lng.toFixed(4)}` : 'null');

  console.log('\n=== BUILDING ROTATE ===');
  await p1.evaluate(() => {
    window.game.buildingManager?.rotateBuilding('bld_1774227799265_prh22a8md', 2.0);
    window.game.network.rotateBuilding('bld_1774227799265_prh22a8md', 2.0);
  });
  await new Promise(r => setTimeout(r, 2000));
  const rot = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md')?.rotation);
  log('P2 sees rotation', Math.abs((rot||0)-2.0)<0.1, 'rot='+rot);

  // Restore original position
  if (origPos) {
    await p1.evaluate((pos) => {
      window.game.buildingManager?.moveBuilding('bld_1774227799265_prh22a8md', pos.lng, pos.lat);
      window.game.buildingManager?.rotateBuilding('bld_1774227799265_prh22a8md', 0);
      window.game.network.moveBuilding('bld_1774227799265_prh22a8md', pos.lng, pos.lat);
      window.game.network.rotateBuilding('bld_1774227799265_prh22a8md', 0);
    }, origPos);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`  ${passed+failed} TESTS | ${passed} PASSED | ${failed} FAILED`);
  console.log(`${'='.repeat(40)}`);
  await browser.close();
  process.exit(failed>0?1:0);
}
main().catch(e=>{console.error('FATAL:',e.message);process.exit(1);});
