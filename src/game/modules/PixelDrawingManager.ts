import { MapManager } from '../../map/MapManager';
import { GeckosNetworkManager } from '../../network/GeckosNetworkManager';
import { PixelCanvas } from '../PixelCanvas';
import { PixelDrawUI } from '../PixelDrawUI';
import { authService } from '../../auth/AuthService';

/** Shape of a row returned by GET /api/pixels */
interface PixelRow {
  x: number;
  y: number;
  color: string;
  author_id: string;
  author_name?: string | null;
  created_at: string;
}

export class PixelDrawingManager {
  private remoteCursors: Map<string, { el: HTMLElement; timer: number }> = new Map();

  private saveBuffer: { x: number; y: number; color: string }[] = [];
  private saveTimer: number | null = null;

  private networkBatch: { x: number; y: number; color: string }[] = [];
  private networkTimer: number | null = null;

  constructor(
    private readonly pixelCanvas: PixelCanvas,
    private readonly pixelDrawUI: PixelDrawUI,
    private readonly network: GeckosNetworkManager,
    private readonly mapManager: MapManager,
  ) {}

  async init(): Promise<void> {
    this.setupUICallbacks();
    await this.loadFromServer();
    this.pixelDrawUI.setPixelCount(this.pixelCanvas.getPixelCount());
  }

  flushRender(): void {
    this.pixelCanvas.flushRender();
  }

  // ─── Network event handlers (called from connectToServer callbacks) ─────────

  onPixelPlaced(x: number, y: number, color: string, authorId: string, authorName: string): void {
    if (color) {
      this.pixelCanvas.placePixel(x, y, color, authorId, authorName);
    } else {
      this.pixelCanvas.erasePixel(x, y);
    }
    this.pixelDrawUI.setPixelCount(this.pixelCanvas.getPixelCount());
    this.showRemoteCursor(x, y, authorName, color ? '✏️' : '🧽', color || '#ff0000');
  }

  onPixelErased(x: number, y: number): void {
    this.pixelCanvas.erasePixel(x, y);
    this.pixelDrawUI.setPixelCount(this.pixelCanvas.getPixelCount());
  }

  onPixelBatchPlaced(
    pixels: { x: number; y: number; color: string }[],
    authorId: string,
    authorName: string,
  ): void {
    for (const p of pixels) {
      if (p.color) {
        this.pixelCanvas.placePixel(p.x, p.y, p.color, authorId, authorName);
      } else {
        this.pixelCanvas.erasePixel(p.x, p.y);
      }
    }
    this.pixelDrawUI.setPixelCount(this.pixelCanvas.getPixelCount());
    if (pixels.length > 0) {
      const last = pixels[pixels.length - 1];
      this.showRemoteCursor(last.x, last.y, authorName, last.color ? '✏️' : '🧽', last.color || '#ff0000');
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private setupUICallbacks(): void {
    this.pixelDrawUI.onToggleDrawMode((active) => {
      if (active) {
        // Read auth at toggle time so renames are always reflected
        const userId = authService.getUser()?.id || 'anonymous';
        const userName = authService.getUser()?.name || 'Anonymous';
        const color = this.pixelDrawUI.getSelectedColor();
        const tool = this.pixelDrawUI.getSelectedTool();
        this.pixelCanvas.enableDrawing(color, tool, (pixel) => {
          this.networkBatch.push({ x: pixel.x, y: pixel.y, color: pixel.color });
          if (!this.networkTimer) {
            this.networkTimer = window.setTimeout(
              () => this.flushNetworkBatch(authService.getUser()?.name || 'Anonymous'),
              50,
            );
          }
          this.queueSaveToServer(pixel);
        }, userId, userName);
      } else {
        this.pixelCanvas.disableDrawing();
      }
    });

    this.pixelDrawUI.onColorChange((color) => {
      if (this.pixelCanvas.isDrawingEnabled()) {
        this.pixelCanvas.setDrawColor(color);
      }
    });

    this.pixelDrawUI.onToolChange((tool) => {
      if (this.pixelCanvas.isDrawingEnabled()) {
        this.pixelCanvas.setDrawTool(tool);
        this.pixelCanvas.setBrushSize(this.pixelDrawUI.getBrushSize());
      }
    });

    this.pixelDrawUI.onUndo(() => {
      this.pixelCanvas.undo();
    });
  }

  private flushNetworkBatch(userName: string): void {
    this.networkTimer = null;
    if (this.networkBatch.length === 0) return;
    const batch = this.networkBatch.splice(0);
    this.network.placePixelBatch(batch, userName);
  }

  private async loadFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/pixels', { credentials: 'include' });
      if (!response.ok) return;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const pixels = await response.json() as PixelRow[];
      if (Array.isArray(pixels)) {
        // Server is authoritative — clear local pixels and replace with server data
        // This prevents erased pixels from reappearing from stale localStorage
        this.pixelCanvas.clearAll();
        const mapped = pixels.map((p) => ({
          x: p.x, y: p.y, color: p.color,
          authorId: p.author_id, authorName: p.author_name || 'Unknown',
          timestamp: new Date(p.created_at).getTime(),
        }));
        if (mapped.length > 0) this.pixelCanvas.importPixels(mapped);
        this.pixelCanvas.saveToStorage();
        this.pixelDrawUI.setPixelCount(this.pixelCanvas.getPixelCount());
        console.log(`🎨 Loaded ${mapped.length} pixels from server (authoritative)`);
      }
    } catch {
      console.log('🎨 Could not load pixels from server, falling back to localStorage');
      this.pixelCanvas.loadFromStorage();
    }
  }

  private queueSaveToServer(pixel: { x: number; y: number; color: string }): void {
    this.saveBuffer.push({ x: pixel.x, y: pixel.y, color: pixel.color });
    if (!this.saveTimer) {
      this.saveTimer = window.setTimeout(() => {
        this.saveTimer = null;
        this.flushSaveBuffer();
      }, 500);
    }
  }

  private async flushSaveBuffer(): Promise<void> {
    const batch = this.saveBuffer.splice(0);
    if (batch.length === 0) return;

    const guestId = localStorage.getItem('gallax_guest_id');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (guestId) headers['X-Guest-ID'] = guestId;
    const fetchOpts = { headers, credentials: 'include' as RequestCredentials };

    const draws = batch.filter(p => p.color !== '');
    const erases = batch.filter(p => p.color === '');

    if (draws.length > 0) {
      try {
        const res = await fetch('/api/pixels', { method: 'POST', ...fetchOpts, body: JSON.stringify(draws) });
        if (!res.ok) {
          console.error(`[PixelSave] POST failed (${res.status}):`, await res.text().catch(() => 'no body'));
          this.saveBuffer.push(...draws);
        }
      } catch (err) {
        console.error('[PixelSave] POST network error:', err);
        this.saveBuffer.push(...draws);
      }
    }

    if (erases.length > 0) {
      // Use POST with action:'delete' instead of DELETE method — Safari drops body on DELETE requests
      const deletePayload = erases.map(e => ({ x: e.x, y: e.y }));
      try {
        const res = await fetch('/api/pixels', { method: 'POST', ...fetchOpts, body: JSON.stringify({ action: 'delete', pixels: deletePayload }) });
        if (!res.ok) {
          console.error(`[PixelSave] erase failed (${res.status}):`, await res.text().catch(() => 'no body'));
          this.saveBuffer.push(...erases);
        }
      } catch (err) {
        console.error('[PixelSave] erase network error:', err);
        this.saveBuffer.push(...erases);
      }
    }

    // Retry with backoff if items were re-queued
    if (this.saveBuffer.length > 0 && !this.saveTimer) {
      this.saveTimer = window.setTimeout(() => {
        this.saveTimer = null;
        this.flushSaveBuffer();
      }, 2000);
    }
  }

  private showRemoteCursor(
    gridX: number, gridY: number,
    authorName: string, toolEmoji: string, color: string,
  ): void {
    const lngLat = this.pixelCanvas.gridToLngLat(gridX, gridY);
    if (!lngLat) return;
    const screenPos = this.mapManager.project(lngLat);

    let cursor = this.remoteCursors.get(authorName);
    if (!cursor) {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed;pointer-events:none;z-index:300;
        display:flex;flex-direction:column;align-items:center;
        transition:left 0.1s,top 0.1s;
      `;
      const hue = Math.abs(authorName.split('').reduce((h, c) => h + c.charCodeAt(0), 0)) % 360;
      el.innerHTML = `
        <span style="font-size:16px;">${toolEmoji}</span>
        <span style="font-size:10px;color:hsl(${hue},70%,65%);white-space:nowrap;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${authorName}</span>
      `;
      document.body.appendChild(el);
      cursor = { el, timer: 0 };
      this.remoteCursors.set(authorName, cursor);
    }

    cursor.el.style.left = `${screenPos.x}px`;
    cursor.el.style.top = `${screenPos.y - 30}px`;
    cursor.el.style.opacity = '1';

    clearTimeout(cursor.timer);
    cursor.timer = window.setTimeout(() => {
      cursor!.el.style.opacity = '0';
      setTimeout(() => {
        cursor!.el.remove();
        this.remoteCursors.delete(authorName);
      }, 300);
    }, 2000);
  }
}
