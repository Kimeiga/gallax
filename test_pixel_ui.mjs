/**
 * Full UI simulation test for pixel erase persistence
 * Actually clicks the draw mode button and uses pointer events
 */
import { chromium } from 'playwright';

const MODE = process.argv[2] || 'prod';
const BASE = MODE === 'local' ? 'http://localhost:5180' : 'https://gallax.pages.dev';

(async () => {
  console.log(`\n🎨 Full UI erase test — ${MODE.toUpperCase()} (${BASE})\n`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const networkLog = [];
  page.on('request', req => {
    if (req.url().includes('/api/pixels')) {
      networkLog.push({ type: 'req', method: req.method(), body: req.postData()?.slice(0, 150) });
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/pixels')) {
      let body = '';
      try { body = await res.text(); } catch {}
      networkLog.push({ type: 'res', status: res.status(), method: res.request().method(), body: body.slice(0, 150) });
    }
  });

  try {
    await page.goto(BASE);
    await page.waitForSelector('#game-canvas, canvas', { timeout: 15000 });
    await page.waitForTimeout(4000);

    // Get pixel canvas center
    const canvasInfo = await page.evaluate(() => {
      const c = document.getElementById('pixel-canvas-overlay');
      return c ? { w: c.offsetWidth, h: c.offsetHeight } : { w: 800, h: 600 };
    });
    const cx = Math.floor(canvasInfo.w / 2);
    const cy = Math.floor(canvasInfo.h / 2);
    console.log(`Canvas size: ${canvasInfo.w}x${canvasInfo.h}, center: ${cx},${cy}`);

    // Get the grid coordinate at center
    const targetGrid = await page.evaluate(({ x, y }) => {
      return window.game?.pixelCanvas?.screenToGrid(x, y) || null;
    }, { x: cx, y: cy });
    console.log(`Target grid: ${JSON.stringify(targetGrid)}`);

    // Activate draw mode (click the palette button)
    await page.evaluate(() => {
      const btn = document.querySelector('.pixel-draw-toggle');
      if (btn) btn.click();
      else console.warn('No .pixel-draw-toggle button found');
    });
    await page.waitForTimeout(500);

    const drawingEnabled = await page.evaluate(() => window.game?.pixelCanvas?.isDrawingEnabled());
    console.log(`Drawing enabled: ${drawingEnabled}`);
    if (!drawingEnabled) {
      console.log('⚠️ Draw mode not activated');
    }

    // Switch to pencil and draw a pixel
    const toolBtns = await page.$$('.pixel-draw-tool-btn');
    console.log(`Found ${toolBtns.length} tool buttons`);
    for (const btn of toolBtns) {
      const text = await btn.textContent();
      console.log(`  Tool btn: "${text?.trim()}"`);
    }

    // Click pencil first (if needed)
    for (const btn of toolBtns) {
      const text = await btn.textContent();
      if (text?.includes('✏️')) {
        await btn.click();
        console.log('Clicked pencil');
        break;
      }
    }
    await page.waitForTimeout(200);

    // Draw a pixel with pointer event
    const pixelBeforeDraw = await page.evaluate(({ x, y }) => {
      const pc = window.game?.pixelCanvas;
      const g = pc?.screenToGrid(x, y);
      return g ? !!pc?.getPixel(g.x, g.y) : false;
    }, { x: cx, y: cy });
    console.log(`\nPixel at center before draw: ${pixelBeforeDraw}`);

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const pixelAfterDraw = await page.evaluate(({ x, y }) => {
      const pc = window.game?.pixelCanvas;
      const g = pc?.screenToGrid(x, y);
      return { exists: g ? !!pc?.getPixel(g.x, g.y) : false, grid: g };
    }, { x: cx, y: cy });
    console.log(`Pixel after draw: ${JSON.stringify(pixelAfterDraw)}`);

    // Switch to eraser
    for (const btn of toolBtns) {
      const text = await btn.textContent();
      if (text?.includes('🧽')) {
        await btn.click();
        console.log('Clicked eraser');
        break;
      }
    }
    await page.waitForTimeout(200);

    const currentTool = await page.evaluate(() => (window.game?.pixelCanvas)?.currentTool);
    console.log(`Current tool: ${currentTool}`);

    // Clear network log for erase test
    networkLog.length = 0;

    // Erase the pixel
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const pixelAfterErase = await page.evaluate(({ x, y }) => {
      const pc = window.game?.pixelCanvas;
      const g = pc?.screenToGrid(x, y);
      return { exists: g ? !!pc?.getPixel(g.x, g.y) : false, grid: g };
    }, { x: cx, y: cy });
    console.log(`Pixel after local erase: ${JSON.stringify(pixelAfterErase)}`);

    // Wait for debounced server save
    console.log('\nWaiting for debounced save (1.5s)...');
    await page.waitForTimeout(1500);

    // Check network
    console.log('\n📡 Network requests during erase:');
    for (const log of networkLog) {
      const icon = log.type === 'res' ? `→ HTTP ${log.status}` : '←';
      console.log(`  ${icon} ${log.method} ${log.body}`);
    }

    const hasDeleteReq = networkLog.some(n => n.type === 'req' && n.method === 'DELETE');
    const deleteRes = networkLog.find(n => n.type === 'res' && n.method === 'DELETE');

    console.log(`\n✅ DELETE sent: ${hasDeleteReq}`);
    if (deleteRes) {
      console.log(`✅ DELETE response: HTTP ${deleteRes.status} — ${deleteRes.body}`);
    } else {
      console.log('❌ No DELETE response received');
    }

    // Verify from API
    if (pixelAfterDraw.grid) {
      const { x, y } = pixelAfterDraw.grid;
      const apiCheck = await page.evaluate(async ({ x, y }) => {
        const res = await fetch(`/api/pixels?minX=${x}&maxX=${x}&minY=${y}&maxY=${y}`);
        return { status: res.status, pixels: await res.json() };
      }, { x, y });
      console.log(`\nDB check at (${x},${y}): ${JSON.stringify(apiCheck)}`);
    }

    // Reload and verify
    console.log('\nReloading page...');
    await page.reload();
    await page.waitForSelector('#game-canvas, canvas', { timeout: 15000 });
    await page.waitForTimeout(4000);

    if (pixelAfterDraw.grid) {
      const { x, y } = pixelAfterDraw.grid;
      const afterReload = await page.evaluate(({ x, y }) => {
        return !!window.game?.pixelCanvas?.getPixel(x, y);
      }, { x, y });
      console.log(`Pixel after reload: ${afterReload ? '❌ REAPPEARED (bug!)' : '✅ Still gone (correct)'}`);
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
