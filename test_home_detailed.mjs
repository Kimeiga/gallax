import { chromium } from 'playwright';
const URL = 'https://gallax.pages.dev';
const HOME_ID = 'bld_1774227799265_prh22a8md';
let passed = 0, failed = 0;
function log(t, ok, d) { console.log(`  ${ok?'✅':'❌'} ${t}${d?' — '+d:''}`); ok?passed++:failed++; }

async function main() {
  const browser = await chromium.launch({ headless: false });
  const p1 = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();

  console.log('Loading...');
  await p1.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p2.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p1.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await p2.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log('Connected!\n');

  console.log('=== 1. EMOJI CHANGE ===');
  await p1.evaluate(() => { const b=window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md'); if(b){b.text.text='🏰'; window.game.network.updateHomeStyle('bld_1774227799265_prh22a8md','🏰',undefined);} });
  await new Promise(r => setTimeout(r, 2000));
  const e2 = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md')?.text?.text);
  log('P2 sees emoji 🏰', e2==='🏰', 'got: '+e2);
  // Restore
  await p1.evaluate(() => { const b=window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md'); if(b){b.text.text='🏡'; window.game.network.updateHomeStyle('bld_1774227799265_prh22a8md','🏡',undefined);} });
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n=== 2. TINT CHANGE ===');
  await p1.evaluate(() => { const b=window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md'); if(b){b.text.tint=0xff0000; window.game.network.updateHomeStyle('bld_1774227799265_prh22a8md',undefined,'#ff0000');} });
  await new Promise(r => setTimeout(r, 2000));
  const t2 = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md')?.text?.tint);
  log('P2 sees red tint', t2===0xff0000||t2===16711680, 'got: '+t2);
  await p1.evaluate(() => { const b=window.game.buildingManager?.getBuildings()?.get('bld_1774227799265_prh22a8md'); if(b){b.text.tint=0xffffff; window.game.network.updateHomeStyle('bld_1774227799265_prh22a8md',undefined,'#ffffff');} });
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n=== 3. FURNITURE LIVE SYNC ===');
  await p1.evaluate(() => { window.game.homeInterior.enter('bld_1774227799265_prh22a8md','Test',1,true); window.game.network.enterHome('bld_1774227799265_prh22a8md',1,'P1'); });
  await new Promise(r => setTimeout(r, 2000));
  await p2.evaluate(() => { window.game.homeInterior.enter('bld_1774227799265_prh22a8md','Test',10,false); window.game.network.enterHome('bld_1774227799265_prh22a8md',10,'P2'); });
  await new Promise(r => setTimeout(r, 3000));
  log('Both in home', await p1.evaluate(() => window.game.homeInterior.isInside()) && await p2.evaluate(() => window.game.homeInterior.isInside()));

  const before = await p2.evaluate(() => window.game.homeInterior.furniture?.length||0);
  // P1 places furniture via the normal code path
  const fid = await p1.evaluate(() => {
    const id = 'test_f_' + Date.now();
    const item = { id, emoji: '🛋️', x: 350, y: 250, placedBy: 'P1' };
    window.game.homeInterior.furniture.push(item);
    window.game.homeInterior.renderFurniture();
    window.game.homeInterior.saveFurniture();
    if (window.game.homeInterior.networkCallbacks?.onFurniturePlaced) {
      window.game.homeInterior.networkCallbacks.onFurniturePlaced('bld_1774227799265_prh22a8md', { id, emoji:'🛋️', x:350, y:250 });
    }
    return id;
  });
  await new Promise(r => setTimeout(r, 3000));
  const after = await p2.evaluate(() => window.game.homeInterior.furniture?.length||0);
  log('P2 sees furniture placed live', after > before, before+' -> '+after);

  await p1.screenshot({ path: '/tmp/furn_p1.png' });
  await p2.screenshot({ path: '/tmp/furn_p2.png' });

  console.log('\n=== 4. FURNITURE PERSISTS AFTER EXIT+RE-ENTER ===');
  const countBefore = await p1.evaluate(() => window.game.homeInterior.furniture?.length||0);
  await p1.evaluate(() => window.game.homeInterior.exit());
  await p2.evaluate(() => window.game.homeInterior.exit());
  await new Promise(r => setTimeout(r, 2000));

  // P1 re-enters
  await p1.evaluate(() => { window.game.homeInterior.enter('bld_1774227799265_prh22a8md','Test',1,true); window.game.network.enterHome('bld_1774227799265_prh22a8md',1,'P1'); });
  await new Promise(r => setTimeout(r, 3000));
  const countP1 = await p1.evaluate(() => window.game.homeInterior.furniture?.length||0);
  log('P1 furniture persists', countP1 >= countBefore, countBefore+' before exit, '+countP1+' after re-enter');

  // P2 re-enters
  await p2.evaluate(() => { window.game.homeInterior.enter('bld_1774227799265_prh22a8md','Test',10,false); window.game.network.enterHome('bld_1774227799265_prh22a8md',10,'P2'); });
  await new Promise(r => setTimeout(r, 3000));
  const countP2 = await p2.evaluate(() => window.game.homeInterior.furniture?.length||0);
  log('P2 furniture persists', countP2 >= countBefore, countP2+' items');

  await p1.screenshot({ path: '/tmp/reenter_p1.png' });
  await p2.screenshot({ path: '/tmp/reenter_p2.png' });

  // Cleanup
  await p1.evaluate(() => window.game.homeInterior.exit());
  await p2.evaluate(() => window.game.homeInterior.exit());

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${passed+failed} TESTS | ${passed} PASSED | ${failed} FAILED`);
  console.log(`${'='.repeat(50)}`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
