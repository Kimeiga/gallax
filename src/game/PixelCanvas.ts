import { MapManager } from '../map/MapManager';

export interface Pixel {
  x: number;
  y: number;
  color: string;
  authorId: string;
  authorName: string;
  timestamp: number;
}

// Chunk size for spatial indexing (grid cells per chunk)
const CHUNK_SIZE = 100;
const STORAGE_KEY = 'gallax_pixel_canvas';
const MIN_RENDER_ZOOM = 14;
const GRID_LINE_ZOOM = 17;

// Grid origin and pixel size in degrees
const ORIGIN_LNG = -74.02;
const ORIGIN_LAT = 40.82;
// Use separate sizes for lng/lat to get square pixels on screen
// At 40.78° lat, 1° lng = cos(40.78°) × 111km ≈ 84km, while 1° lat = 111km
// So we need more lng degrees per pixel to make them equal screen width
const PIXEL_SIZE_LAT = 0.00002; // base size in lat degrees
const PIXEL_SIZE_LNG = PIXEL_SIZE_LAT / Math.cos(40.78 * Math.PI / 180); // wider in lng to compensate

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function pixelKey(x: number, y: number): string {
  return `${x},${y}`;
}

export class PixelCanvas {
  private mapManager: MapManager;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pixels: Map<string, Pixel> = new Map();
  private chunks: Map<string, Set<string>> = new Map(); // chunkKey -> set of pixelKeys

  // Drawing state
  private isDrawing = false;

  // Undo support: each stroke records what pixels were changed
  private undoStack: { x: number; y: number; prevColor: string | null; prevAuthorId: string; prevAuthorName: string }[][] = [];
  private currentStroke: { x: number; y: number; prevColor: string | null; prevAuthorId: string; prevAuthorName: string }[] = [];
  private drawingEnabled = false;
  private currentColor = '#ff0000';
  private currentTool: 'pencil' | 'eraser' = 'pencil';
  private brushSize: number = 1;
  private onPixelPlaced: ((pixel: Pixel) => void) | null = null;
  private drawAuthorId = '';
  private drawAuthorName = '';

  // Grid overlay
  private showGrid = true;

  // Bound event handlers (for removal)
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundRender: () => void;

  // Rendering throttle
  private renderRequested = false;
  private lastRenderTime = 0;
  private readonly MIN_RENDER_INTERVAL = 16; // ~60fps cap

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;

    // Create the overlay canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pixel-canvas-overlay';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '1'; // Below game-canvas (z-index: 2) so resources/mobs cover drawings
    this.canvas.style.pointerEvents = 'none';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context for PixelCanvas');
    }
    this.ctx = ctx;

    // Bind event handlers
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundRender = this.requestRender.bind(this);

    // Allow wheel/scroll events to pass through for map zooming
    this.canvas.style.touchAction = 'pinch-zoom';
    this.canvas.addEventListener('wheel', (e) => {
      // Let wheel events pass through to the map for zooming
      this.canvas.style.pointerEvents = 'none';
      requestAnimationFrame(() => {
        if (this.drawingEnabled) this.canvas.style.pointerEvents = 'auto';
      });
    }, { passive: true });

    // Attach drawing events to canvas
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
    this.canvas.addEventListener('pointercancel', this.boundPointerUp);

    // Listen for map render events
    this.mapManager.on('onRender', this.boundRender);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.render();
    });

    // Don't auto-load from localStorage — Game.ts loads from server first (authoritative)
    // this.loadFromStorage() is called as fallback only if server is unavailable
  }

  // --- Grid coordinate conversion ---

  gridToLngLat(gridX: number, gridY: number): { lng: number; lat: number } {
    return {
      lng: ORIGIN_LNG + gridX * PIXEL_SIZE_LNG,
      lat: ORIGIN_LAT + gridY * PIXEL_SIZE_LAT,
    };
  }

  screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const lngLat = this.mapManager.unproject({ x: screenX, y: screenY });
    return {
      x: Math.floor((lngLat.lng - ORIGIN_LNG) / PIXEL_SIZE_LNG),
      y: Math.floor((lngLat.lat - ORIGIN_LAT) / PIXEL_SIZE_LAT),
    };
  }

  // --- Spatial index helpers ---

  private addToChunk(pixel: Pixel): void {
    const cx = Math.floor(pixel.x / CHUNK_SIZE);
    const cy = Math.floor(pixel.y / CHUNK_SIZE);
    const ck = chunkKey(cx, cy);
    let chunk = this.chunks.get(ck);
    if (!chunk) {
      chunk = new Set();
      this.chunks.set(ck, chunk);
    }
    chunk.add(pixelKey(pixel.x, pixel.y));
  }

  private removeFromChunk(x: number, y: number): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const ck = chunkKey(cx, cy);
    const chunk = this.chunks.get(ck);
    if (chunk) {
      chunk.delete(pixelKey(x, y));
      if (chunk.size === 0) {
        this.chunks.delete(ck);
      }
    }
  }

  // --- Core pixel operations ---

  private dirty = false;

  placePixel(gridX: number, gridY: number, color: string, authorId: string, authorName: string): void {
    const pk = pixelKey(gridX, gridY);
    const existing = this.pixels.get(pk);
    if (existing) this.removeFromChunk(existing.x, existing.y);

    const pixel: Pixel = { x: gridX, y: gridY, color, authorId, authorName, timestamp: Date.now() };
    this.pixels.set(pk, pixel);
    this.addToChunk(pixel);
    this.dirty = true;
  }

  erasePixel(gridX: number, gridY: number): void {
    const pk = pixelKey(gridX, gridY);
    if (this.pixels.has(pk)) {
      this.removeFromChunk(gridX, gridY);
      this.pixels.delete(pk);
      this.dirty = true;
    }
  }

  // Call this once per frame (from the map render callback) instead of per-pixel
  flushRender(): void {
    if (this.dirty) {
      this.dirty = false;
      this.render();
    }
  }

  getPixel(gridX: number, gridY: number): Pixel | null {
    return this.pixels.get(pixelKey(gridX, gridY)) || null;
  }

  getPixelCount(): number {
    return this.pixels.size;
  }

  // Clear all pixels (used when server data replaces local data)
  clearAll(): void {
    this.pixels.clear();
    this.chunks.clear();
    this.dirty = true;
  }

  // --- Rendering ---

  private requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    requestAnimationFrame(() => {
      this.renderRequested = false;
      const now = performance.now();
      if (now - this.lastRenderTime < this.MIN_RENDER_INTERVAL) return;
      this.lastRenderTime = now;
      this.render();
    });
  }

  render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    const zoom = this.mapManager.getZoom();
    if (zoom < MIN_RENDER_ZOOM) return;

    // Determine visible bounds in grid coordinates
    const topLeft = this.screenToGrid(0, 0);
    const topRight = this.screenToGrid(width, 0);
    const bottomLeft = this.screenToGrid(0, height);
    const bottomRight = this.screenToGrid(width, height);

    const minGX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) - 1;
    const maxGX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x) + 1;
    const minGY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) - 1;
    const maxGY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) + 1;

    // Determine which chunks overlap the viewport
    const minCX = Math.floor(minGX / CHUNK_SIZE);
    const maxCX = Math.floor(maxGX / CHUNK_SIZE);
    const minCY = Math.floor(minGY / CHUNK_SIZE);
    const maxCY = Math.floor(maxGY / CHUNK_SIZE);

    // --- Compute affine transform: grid coords → screen coords ---
    // Sample 3 points to derive the full linear map (3 project() calls total instead of 4×N)
    const g0x = Math.floor((minGX + maxGX) / 2);
    const g0y = Math.floor((minGY + maxGY) / 2);
    const s0 = this.mapManager.project(this.gridToLngLat(g0x, g0y));
    const s1 = this.mapManager.project(this.gridToLngLat(g0x + 1, g0y));
    const s2 = this.mapManager.project(this.gridToLngLat(g0x, g0y + 1));
    // ctx.setTransform(a,b,c,d,e,f): screenX = a*gx + c*gy + e,  screenY = b*gx + d*gy + f
    const ta = s1.x - s0.x;
    const tb = s1.y - s0.y;
    const tc = s2.x - s0.x;
    const td = s2.y - s0.y;
    const te = s0.x - g0x * ta - g0y * tc;
    const tf = s0.y - g0x * tb - g0y * td;

    // Collect visible pixels grouped by color for batch rendering
    const colorBuckets: Map<string, Pixel[]> = new Map();

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const chunk = this.chunks.get(chunkKey(cx, cy));
        if (!chunk) continue;

        for (const pk of chunk) {
          const pixel = this.pixels.get(pk);
          if (!pixel) continue;

          // Bounds check
          if (pixel.x < minGX || pixel.x > maxGX || pixel.y < minGY || pixel.y > maxGY) continue;

          let bucket = colorBuckets.get(pixel.color);
          if (!bucket) {
            bucket = [];
            colorBuckets.set(pixel.color, bucket);
          }
          bucket.push(pixel);
        }
      }
    }

    // Render pixels using affine transform — draw in grid space, canvas handles the mapping
    ctx.globalAlpha = 0.7;
    ctx.save();
    ctx.setTransform(ta, tb, tc, td, te, tf);

    for (const [color, pixels] of colorBuckets) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const pixel of pixels) {
        // Slight 5% overlap to prevent subpixel gaps between adjacent pixels
        ctx.rect(pixel.x - 0.05, pixel.y - 0.05, 1.1, 1.1);
      }
      ctx.fill();
    }

    ctx.restore();

    // Draw grid lines if zoomed in enough
    if (this.showGrid && zoom >= GRID_LINE_ZOOM) {
      this.renderGridLines(minGX, maxGX, minGY, maxGY, ta, tb, tc, td, te, tf);
    }

    ctx.globalAlpha = 1.0;
  }

  private renderGridLines(
    minGX: number, maxGX: number, minGY: number, maxGY: number,
    ta: number, tb: number, tc: number, td: number, te: number, tf: number
  ): void {
    const ctx = this.ctx;

    // Limit grid line count to avoid performance issues
    const maxLines = 500;
    const rangeX = maxGX - minGX;
    const rangeY = maxGY - minGY;
    if (rangeX > maxLines || rangeY > maxLines) return;

    // Normalize lineWidth to 0.5 screen pixels using the cached transform scale
    const scale = Math.sqrt(ta * ta + tb * tb);

    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#000000';
    ctx.save();
    ctx.setTransform(ta, tb, tc, td, te, tf);
    ctx.lineWidth = 0.5 / scale;
    ctx.beginPath();

    // Vertical lines (constant x, from minGY to maxGY)
    for (let gx = minGX; gx <= maxGX; gx++) {
      ctx.moveTo(gx, minGY);
      ctx.lineTo(gx, maxGY);
    }

    // Horizontal lines (constant y, from minGX to maxGX)
    for (let gy = minGY; gy <= maxGY; gy++) {
      ctx.moveTo(minGX, gy);
      ctx.lineTo(maxGX, gy);
    }

    ctx.stroke();
    ctx.restore();
  }

  // --- Interaction ---

  setInteractive(interactive: boolean): void {
    this.canvas.style.pointerEvents = interactive ? 'auto' : 'none';
  }

  enableDrawing(
    color: string,
    tool: 'pencil' | 'eraser',
    onPixelPlaced: (pixel: Pixel) => void,
    authorId: string = '',
    authorName: string = ''
  ): void {
    this.currentColor = color;
    this.currentTool = tool;
    this.onPixelPlaced = onPixelPlaced;
    this.drawAuthorId = authorId;
    this.drawAuthorName = authorName;
    this.drawingEnabled = true;
    this.setInteractive(true);
    this.canvas.style.cursor = 'crosshair';
  }

  isDrawingEnabled(): boolean {
    return this.drawingEnabled;
  }

  setDrawColor(color: string): void {
    this.currentColor = color;
  }

  setDrawTool(tool: 'pencil' | 'eraser'): void {
    this.currentTool = tool;
    this.canvas.style.cursor = 'crosshair';
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(3, size));
  }

  disableDrawing(): void {
    this.drawingEnabled = false;
    this.isDrawing = false;
    this.onPixelPlaced = null;
    this.setInteractive(false);
    this.canvas.style.cursor = '';
  }

  private activePointers: Set<number> = new Set();

  private handlePointerDown(e: PointerEvent): void {
    if (!this.drawingEnabled) return;
    this.activePointers.add(e.pointerId);

    // If multiple pointers (pinch zoom), cancel drawing and let map handle it
    if (this.activePointers.size > 1) {
      this.isDrawing = false;
      this.canvas.releasePointerCapture(e.pointerId);
      return;
    }

    e.preventDefault();
    this.isDrawing = true;
    this.lastAppliedGrid = null; // Reset so each new stroke starts fresh at any position
    this.canvas.setPointerCapture(e.pointerId);
    this.applyToolAt(e.clientX, e.clientY);
    this.requestRender();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDrawing || this.activePointers.size > 1) return;
    e.preventDefault();

    // Interpolate between last position and current to avoid gaps
    const grid = this.screenToGrid(e.clientX, e.clientY);
    if (this.lastAppliedGrid) {
      const dx = Math.abs(grid.x - this.lastAppliedGrid.x);
      const dy = Math.abs(grid.y - this.lastAppliedGrid.y);
      if (dx > 1 || dy > 1) {
        // Bresenham line from last to current
        this.drawLine(this.lastAppliedGrid.x, this.lastAppliedGrid.y, grid.x, grid.y);
        this.requestRender();
        return;
      }
    }
    this.applyToolAt(e.clientX, e.clientY);
    this.requestRender();
  }

  // Bresenham line algorithm to fill gaps between fast pointer moves
  private drawLine(x0: number, y0: number, x1: number, y1: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.applyToolAtGrid(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // Apply tool at grid coordinates with brush size (circular pattern)
  private applyToolAtGrid(gx: number, gy: number): void {
    if (this.lastAppliedGrid && this.lastAppliedGrid.x === gx && this.lastAppliedGrid.y === gy) return;
    this.lastAppliedGrid = { x: gx, y: gy };

    const radius = this.brushSize - 1;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy > radius * radius + radius) continue;
        const px = gx + dx;
        const py = gy + dy;

        // Record previous state for undo
        const prev = this.getPixel(px, py);
        this.currentStroke.push({
          x: px, y: py,
          prevColor: prev?.color || null,
          prevAuthorId: prev?.authorId || '',
          prevAuthorName: prev?.authorName || '',
        });

        if (this.currentTool === 'eraser') {
          this.erasePixel(px, py);
          if (this.onPixelPlaced) {
            this.onPixelPlaced({ x: px, y: py, color: '', authorId: this.drawAuthorId, authorName: this.drawAuthorName, timestamp: Date.now() });
          }
        } else {
          this.placePixel(px, py, this.currentColor, this.drawAuthorId, this.drawAuthorName);
          const pixel = this.getPixel(px, py);
          if (pixel && this.onPixelPlaced) this.onPixelPlaced(pixel);
        }
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // Save completed stroke to undo stack
    if (this.currentStroke.length > 0) {
      this.undoStack.push(this.currentStroke);
      // Keep max 30 undo levels
      if (this.undoStack.length > 30) this.undoStack.shift();
      this.currentStroke = [];
    }

    this.saveToStorage();
  }

  // Undo the last stroke
  undo(): boolean {
    const stroke = this.undoStack.pop();
    if (!stroke || stroke.length === 0) return false;

    for (const change of stroke) {
      if (change.prevColor) {
        // Restore previous pixel
        this.placePixel(change.x, change.y, change.prevColor, change.prevAuthorId, change.prevAuthorName);
      } else {
        // Pixel didn't exist before, erase it
        this.erasePixel(change.x, change.y);
      }
      // Notify network about the undo
      if (this.onPixelPlaced) {
        this.onPixelPlaced({
          x: change.x, y: change.y,
          color: change.prevColor || '',
          authorId: change.prevAuthorId || this.drawAuthorId,
          authorName: change.prevAuthorName || this.drawAuthorName,
          timestamp: Date.now(),
        });
      }
    }

    this.requestRender();
    this.saveToStorage();
    return true;
  }

  private lastAppliedGrid: { x: number; y: number } | null = null;

  private applyToolAt(screenX: number, screenY: number): void {
    const grid = this.screenToGrid(screenX, screenY);

    // Avoid re-applying to the same grid cell during a single stroke
    if (this.lastAppliedGrid && this.lastAppliedGrid.x === grid.x && this.lastAppliedGrid.y === grid.y) {
      return;
    }
    this.lastAppliedGrid = { x: grid.x, y: grid.y };

    if (this.currentTool === 'eraser') {
      this.erasePixel(grid.x, grid.y);
      // Still fire callback with a "blank" pixel so the network knows to erase
      if (this.onPixelPlaced) {
        this.onPixelPlaced({
          x: grid.x,
          y: grid.y,
          color: '',
          authorId: this.drawAuthorId,
          authorName: this.drawAuthorName,
          timestamp: Date.now(),
        });
      }
    } else {
      this.placePixel(grid.x, grid.y, this.currentColor, this.drawAuthorId, this.drawAuthorName);
      const pixel = this.getPixel(grid.x, grid.y);
      if (pixel && this.onPixelPlaced) {
        this.onPixelPlaced(pixel);
      }
    }
  }

  // --- Grid overlay toggle ---

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.requestRender();
  }

  getShowGrid(): boolean {
    return this.showGrid;
  }

  // --- Persistence ---

  saveToStorage(): void {
    try {
      const data = this.exportPixels();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('PixelCanvas: Failed to save to localStorage', e);
    }
  }

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: Pixel[] = JSON.parse(raw);
        this.importPixels(data);
      }
    } catch (e) {
      console.warn('PixelCanvas: Failed to load from localStorage', e);
    }
  }

  // --- Bulk import/export ---

  importPixels(pixels: Pixel[]): void {
    for (const pixel of pixels) {
      const pk = pixelKey(pixel.x, pixel.y);
      const existing = this.pixels.get(pk);
      if (existing && existing.timestamp >= pixel.timestamp) continue;
      if (existing) this.removeFromChunk(existing.x, existing.y);
      this.pixels.set(pk, pixel);
      this.addToChunk(pixel);
    }
    this.dirty = true;
  }

  exportPixels(): Pixel[] {
    return Array.from(this.pixels.values());
  }

  // --- Cleanup ---

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('pointercancel', this.boundPointerUp);

    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.pixels.clear();
    this.chunks.clear();
  }
}
