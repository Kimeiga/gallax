import { chromium } from 'playwright';

const URL = 'http://localhost:8788';
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

  const p1Errors = [], p2Errors = [];
  p1.on('console', m => { if (m.type() === 'error') p1Errors.push(m.text()); });
  p2.on('console', m => { if (m.type() === 'error') p2Errors.push(m.text()); });

  console.log('Loading both players on localhost...');
  await p1.goto(URL, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await p2.goto(URL, { timeout: 30000, waitUntil: 'domcontentloaded' });

  // Wait for game + geckos (game connects to game.kimu.nyc even from localhost)
  await p1.waitForFunction(() => window.game, { timeout: 60000 });
  await p2.waitForFunction(() => window.game, { timeout: 60000 });
  console.log('Both games loaded');

  // Wait for guest registration + geckos
  await new Promise(r => setTimeout(r, 5000));
  
  const pid1 = await p1.evaluate(() => window.game?.network?.getPlayerId() || null);
  const pid2 = await p2.evaluate(() => window.game?.network?.getPlayerId() || null);
  const gid1 = await p1.evaluate(() => localStorage.getItem('gallax_guest_id'));
  const gid2 = await p2.evaluate(() => localStorage.getItem('gallax_guest_id'));

  console.log('\n=== CONNECTION ===');
  log('Different guest IDs', gid1 !== gid2, (gid1?.slice(-8) || 'null') + ' vs ' + (gid2?.slice(-8) || 'null'));
  log('P1 geckos connected', !!pid1, pid1?.slice(0,10) || 'null');
  log('P2 geckos connected', !!pid2, pid2?.slice(0,10) || 'null');

  // Check guest is registered in D1
  const p1Registered = await p1.evaluate(async () => {
    try {
      const gid = localStorage.getItem('gallax_guest_id');
      const r = await fetch('/api/auth/me');
      return r.status !== 401 ? 'authenticated' : 'guest_' + gid?.slice(-6);
    } catch { return 'error'; }
  });
  log('P1 auth status', p1Registered !== 'error', p1Registered);

  await new Promise(r => setTimeout(r, 2000));

  // ---------- CHAT ----------
  console.log('\n=== CHAT ===');
  if (pid1 && pid2) {
    await p1.evaluate(() => window.game.network.sendChat('hello_p1'));
    await new Promise(r => setTimeout(r, 2000));
    const c1 = await p2.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('hello_p1'));
    log('P2 sees P1 chat', !!c1);

    await p2.evaluate(() => window.game.network.sendChat('hello_p2'));
    await new Promise(r => setTimeout(r, 2000));
    const c2 = await p1.evaluate(() => document.getElementById('chat-messages')?.textContent?.includes('hello_p2'));
    log('P1 sees P2 chat', !!c2);
  } else {
    log('Chat (skipped - no geckos)', false, 'geckos not connected');
    log('Chat (skipped - no geckos)', false);
  }

  // ---------- PIXELS ----------
  console.log('\n=== PIXELS ===');
  if (pid1 && pid2) {
    await p1.evaluate(() => {
      window.game.pixelCanvas?.placePixel(8001, 8001, '#00ff00', 'x', 'P1');
      window.game.network.placePixel(8001, 8001, '#00ff00', 'P1');
    });
    await new Promise(r => setTimeout(r, 2000));
    const px1 = await p2.evaluate(() => window.game.pixelCanvas?.getPixel(8001, 8001)?.color);
    log('P2 sees P1 pixel', px1 === '#00ff00', px1);

    await p2.evaluate(() => {
      window.game.pixelCanvas?.erasePixel(8001, 8001);
      window.game.network.erasePixel(8001, 8001);
    });
    await new Promise(r => setTimeout(r, 2000));
    const px2 = await p1.evaluate(() => window.game.pixelCanvas?.getPixel(8001, 8001));
    log('P1 sees P2 erase', !px2);
  } else {
    log('Pixel draw (skipped)', false); log('Pixel erase (skipped)', false);
  }

  // ---------- PIXEL PERSISTENCE (D1) ----------
  console.log('\n=== PIXEL D1 PERSISTENCE ===');
  // Place a pixel via P1, save to D1, then check API
  await p1.evaluate(() => {
    window.game.pixelCanvas?.placePixel(9999, 9999, '#0000ff', 'x', 'P1');
    window.game.savePixelToServer({ x: 9999, y: 9999, color: '#0000ff' });
  });
  await new Promise(r => setTimeout(r, 2000));
  const d1Pixel = await p1.evaluate(async () => {
    const r = await fetch('/api/pixels?minX=9999&maxX=9999&minY=9999&maxY=9999');
    const d = await r.json();
    return d.length;
  });
  log('Pixel saved to D1', d1Pixel > 0, d1Pixel + ' pixel(s)');

  // Erase and verify D1
  await p1.evaluate(async () => {
    window.game.pixelCanvas?.erasePixel(9999, 9999);
    window.game.savePixelToServer({ x: 9999, y: 9999, color: '' });
  });
  await new Promise(r => setTimeout(r, 2000));
  const d1After = await p1.evaluate(async () => {
    const r = await fetch('/api/pixels?minX=9999&maxX=9999&minY=9999&maxY=9999');
    const d = await r.json();
    return d.length;
  });
  log('Pixel erased from D1', d1After === 0, d1After + ' pixel(s)');

  // ---------- BUILDINGS ----------
  console.log('\n=== BUILDINGS ===');
  if (pid1 && pid2) {
    const before = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.size || 0);
    await p1.evaluate(() => {
      window.game.buildingManager?.addBuilding({ id: 'test_sync', type: 'flag', lng: -73.960, lat: 40.780, ownerId: 'test', rotation: 0 });
      window.game.network.placeBuilding('flag', -73.960, 40.780);
    });
    await new Promise(r => setTimeout(r, 2000));
    const after = await p2.evaluate(() => window.game.buildingManager?.getBuildings()?.size || 0);
    log('P2 sees P1 building', after > before, before + ' -> ' + after);

    await p1.evaluate(() => {
      window.game.buildingManager?.removeBuilding('test_sync');
      window.game.network.deleteBuilding('test_sync');
    });
    await new Promise(r => setTimeout(r, 2000));
    const gone = await p2.evaluate(() => !window.game.buildingManager?.getBuildings()?.has('test_sync'));
    log('P2 sees P1 delete', !!gone);
  } else {
    log('Building place (skipped)', false); log('Building delete (skipped)', false);
  }

  // ---------- HOME ----------
  console.log('\n=== HOME INTERIOR ===');
  if (pid1 && pid2) {
    await p1.evaluate((h) => { window.game.homeInterior.enter(h, 'Test', 1, true); window.game.network.enterHome(h, 1, 'P1'); }, HOME_ID);
    await new Promise(r => setTimeout(r, 2000));
    await p2.evaluate((h) => { window.game.homeInterior.enter(h, 'Test', 10, false); window.game.network.enterHome(h, 10, 'P2'); }, HOME_ID);
    await new Promise(r => setTimeout(r, 3000));

    const h1 = await p1.evaluate(() => window.game.homeInterior.otherPlayers?.size > 0);
    const h2 = await p2.evaluate(() => window.game.homeInterior.otherPlayers?.size > 0);
    log('P1 sees P2 in home', !!h1);
    log('P2 sees P1 in home', !!h2);

    await p1.screenshot({ path: '/tmp/local_p1_home.png' });
    await p2.screenshot({ path: '/tmp/local_p2_home.png' });

    await p1.evaluate(() => window.game.homeInterior.exit());
    await p2.evaluate(() => window.game.homeInterior.exit());
    await new Promise(r => setTimeout(r, 1000));
  } else {
    log('Home P1 sees P2 (skipped)', false); log('Home P2 sees P1 (skipped)', false);
  }

  // ---------- MOVEMENT ----------
  console.log('\n=== PLAYER VISIBILITY ===');
  if (pid1 && pid2) {
    const sees1 = await p2.evaluate((pid) => {
      const p = window.game.otherPlayers;
      return p?.players?.has(pid) || false;
    }, pid1);
    log('P2 sees P1 on map', !!sees1);

    const sees2 = await p1.evaluate((pid) => {
      const p = window.game.otherPlayers;
      return p?.players?.has(pid) || false;
    }, pid2);
    log('P1 sees P2 on map', !!sees2);
  } else {
    log('Map visibility (skipped)', false); log('Map visibility (skipped)', false);
  }

  // ---------- ERRORS ----------
  console.log('\n=== CONSOLE ERRORS ===');
  // Filter out expected network errors
  const filter = e => !e.includes('401') && !e.includes('404') && !e.includes('net::') && !e.includes('Failed to fetch') && !e.includes('Failed to load resource');
  const crit1 = p1Errors.filter(filter);
  const crit2 = p2Errors.filter(filter);
  log('P1 no critical JS errors', crit1.length === 0, crit1.length > 0 ? crit1[0]?.slice(0, 80) : 'clean');
  log('P2 no critical JS errors', crit2.length === 0, crit2.length > 0 ? crit2[0]?.slice(0, 80) : 'clean');

  // ---------- SUMMARY ----------
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  TOTAL: ${passed + failed} tests | ${passed} passed | ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
