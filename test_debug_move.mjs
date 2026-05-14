import { chromium } from 'playwright';
const URL = 'https://gallax.pages.dev';
async function main() {
  const browser = await chromium.launch({ headless: false });
  const p1 = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  await p1.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p2.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p1.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await p2.waitForFunction(() => window.game?.network?.getPlayerId(), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Patch P2's handler to log
  await p2.evaluate(() => {
    const orig = window.game.network.handlers.onBuildingMoved;
    window._moveLog = [];
    window.game.network.handlers.onBuildingMoved = (id,lng,lat) => {
      window._moveLog.push({id,lng,lat});
      if(orig) orig(id,lng,lat);
    };
  });

  // P1 moves building
  await p1.evaluate(() => {
    window.game.network.moveBuilding('bld_1774227799265_prh22a8md', -73.555, 40.555);
  });
  await new Promise(r => setTimeout(r, 3000));

  const logs = await p2.evaluate(() => window._moveLog);
  console.log('P2 received move events:', JSON.stringify(logs));
  
  await browser.close();
}
main().catch(e=>{console.error(e.message);process.exit(1);});
