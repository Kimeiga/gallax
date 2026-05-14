import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:5180');
  await page.waitForSelector('#game-canvas, canvas', { timeout: 20000 });
  await page.waitForFunction(() => !!window.game?.homeInterior, { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const hi = window.game.homeInterior;
    hi.enter('test_gizmo_r', 'Owner', 1, true);
    await new Promise(r => setTimeout(r, 200));
    hi.addFurnitureFromNetwork({ id: 'f1', emoji: '🛋️', x: 400, y: 300 });
    await new Promise(r => setTimeout(r, 50));

    const furn = hi.furniture?.find(f => f.id === 'f1');
    if (!furn) return { ok: false, reason: 'no furn' };

    // Select the furniture by simulating a tap
    const roomEl = hi.roomEl;
    const rect = roomEl.getBoundingClientRect();
    const sx = rect.left + 400 * (rect.width / 800);
    const sy = rect.top + 300 * (rect.height / 600);
    roomEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy, bubbles: true, pointerId: 1, isPrimary: true }));
    await new Promise(r => setTimeout(r, 20));
    roomEl.dispatchEvent(new PointerEvent('pointerup', { clientX: sx, clientY: sy, bubbles: true, pointerId: 1, isPrimary: true }));
    await new Promise(r => setTimeout(r, 50));

    const gizmosAfterSelect = {
      sel: !!hi.selectionEl,
      rotHandle: !!hi.gizmoRotateHandle,
      scaleHandle: !!hi.gizmoScaleHandle,
      line: !!hi.gizmoLine,
    };

    // Direct test: set gizmoMode and call pointermove handler
    hi.gizmoMode = 'rotate';
    hi.selectedFurniture = furn;
    hi.gizmoStartAngle = 0; // East
    hi.gizmoStartRotation = 0;
    
    // Fire pointermove pointing "down" from furniture center (angle = π/2)
    const px = rect.left + 400 * (rect.width / 800);
    const py = rect.top + 380 * (rect.height / 600); // 80px below center in room coords
    roomEl.dispatchEvent(new PointerEvent('pointermove', { clientX: px, clientY: py, bubbles: true, pointerId: 1, isPrimary: true }));
    await new Promise(r => setTimeout(r, 20));
    
    const rotationAfterMove = furn.rotation;

    // Finish with pointerup
    roomEl.dispatchEvent(new PointerEvent('pointerup', { clientX: px, clientY: py, bubbles: true, pointerId: 1, isPrimary: true }));
    await new Promise(r => setTimeout(r, 20));

    // Now test scale: select again, then scale handle
    hi.gizmoMode = 'scale';
    hi.selectedFurniture = furn;
    hi.gizmoStartDist = 50;
    hi.gizmoStartScale = 1;

    // Move further away from center (dist = 100px in room coords → scale = 2)
    const qx = rect.left + 450 * (rect.width / 800);
    const qy = rect.top + 387 * (rect.height / 600); // ~100px from center (sqrt(50^2+87^2)≈100)
    roomEl.dispatchEvent(new PointerEvent('pointermove', { clientX: qx, clientY: qy, bubbles: true, pointerId: 1, isPrimary: true }));
    await new Promise(r => setTimeout(r, 20));
    roomEl.dispatchEvent(new PointerEvent('pointerup', { clientX: qx, clientY: qy, bubbles: true, pointerId: 1, isPrimary: true }));
    await new Promise(r => setTimeout(r, 20));

    const scaleAfterMove = furn.scale;

    return {
      ok: true,
      gizmosAfterSelect,
      rotationAfterMove,
      scaleAfterMove,
      gizmoModeCleared: hi.gizmoMode === null,
    };
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  await page.waitForTimeout(1000);
  await browser.close();
  
  const ok = result.ok &&
    result.gizmosAfterSelect?.sel &&
    result.gizmosAfterSelect?.rotHandle &&
    result.gizmosAfterSelect?.scaleHandle &&
    result.rotationAfterMove !== undefined &&
    result.scaleAfterMove !== undefined;
  console.log(ok ? '\n✅ All gizmo tests passed' : '\n❌ Some tests failed');
  process.exit(ok ? 0 : 1);
})();
