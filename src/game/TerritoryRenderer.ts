// Territory Renderer — draws H3 hex grid, claimed cells, and selection UI
import { polygonToCells } from 'h3-js';
import { MapManager } from '../map/MapManager';
import {
  TerritorySystem, TerritoryCell,
  H3_RESOLUTION, lngLatToH3, h3ToLngLat, h3ToBoundary, h3Neighbors,
} from './TerritorySystem';

const MIN_RENDER_ZOOM = 13;
const GRID_ZOOM = 14; // zoom at which hex grid outlines appear

// Tap vs drag detection
const TAP_MAX_MOVE = 12;  // px — max movement for a tap
const TAP_MAX_TIME = 300; // ms — max duration for a tap

export class TerritoryRenderer {
  private mapManager: MapManager;
  private territory: TerritorySystem;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderRequested = false;
  private lastRenderTime = 0;
  private readonly MIN_RENDER_INTERVAL = 32;
  private dirty = true;
  private boundRender: () => void;

  // Claim progress UI
  private claimProgressEl: HTMLDivElement | null = null;

  // Territory mode state
  private active = false;
  private selectedCells: Set<string> = new Set();
  private onCellToggled: ((h3Index: string, selected: boolean) => void) | null = null;

  // Tap detection state (to distinguish taps from map drags)
  private tapStart: { x: number; y: number; time: number } | null = null;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(mapManager: MapManager, territory: TerritorySystem) {
    this.mapManager = mapManager;
    this.territory = territory;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'territory-canvas-overlay';
    // Always pointer-events:none — the map handles all drag/pinch/zoom.
    // We detect taps via document-level pointer listeners.
    this.canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for TerritoryRenderer');
    this.ctx = ctx;

    this.boundRender = this.requestRender.bind(this);
    this.mapManager.on('onRender', this.boundRender);

    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.render();
    });

    this.territory.setOnCellChanged(() => { this.dirty = true; });
    this.territory.setOnClaimProgress((progress, h3Index) => { this.showClaimProgress(progress, h3Index); });

    // Tap detection on the document — fires UNDER the map so drag/pinch still work
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    document.addEventListener('pointerdown', this.boundPointerDown, true);
    document.addEventListener('pointerup', this.boundPointerUp, true);
  }

  // ─── Territory mode ────────────────────────────────────────────────────

  enterMode(
    onCellToggled: (h3Index: string, selected: boolean) => void,
  ): void {
    this.active = true;
    this.selectedCells.clear();
    this.onCellToggled = onCellToggled;
    this.dirty = true;
  }

  exitMode(): void {
    this.active = false;
    this.selectedCells.clear();
    this.onCellToggled = null;
    this.dirty = true;
  }

  isActive(): boolean { return this.active; }
  getSelectedCells(): string[] { return Array.from(this.selectedCells); }

  selectCell(h3Index: string): void { this.selectedCells.add(h3Index); this.dirty = true; }
  deselectCell(h3Index: string): void { this.selectedCells.delete(h3Index); this.dirty = true; }
  clearSelection(): void { this.selectedCells.clear(); this.dirty = true; }

  // ─── Tap detection (quick tap = select hex, drag = move map) ───────────

  private handlePointerDown(e: PointerEvent): void {
    if (!this.active) return;
    this.tapStart = { x: e.clientX, y: e.clientY, time: Date.now() };
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.active || !this.tapStart) return;

    const dx = Math.abs(e.clientX - this.tapStart.x);
    const dy = Math.abs(e.clientY - this.tapStart.y);
    const dt = Date.now() - this.tapStart.time;
    this.tapStart = null;

    // Only treat as a hex selection if it was a quick tap (not a drag)
    if (dx > TAP_MAX_MOVE || dy > TAP_MAX_MOVE || dt > TAP_MAX_TIME) return;

    // Don't select if tapping on UI elements (buttons, inputs, etc.)
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, [role="button"], #territory-confirm-bar')) return;

    const lngLat = this.mapManager.unproject({ x: e.clientX, y: e.clientY });
    const h3 = lngLatToH3(lngLat.lng, lngLat.lat);

    // Toggle selection
    if (this.selectedCells.has(h3)) {
      this.selectedCells.delete(h3);
      this.onCellToggled?.(h3, false);
    } else {
      this.selectedCells.add(h3);
      this.onCellToggled?.(h3, true);
    }
    this.dirty = true;
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  requestRender(): void {
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

  markDirty(): void { this.dirty = true; }

  flushRender(): void {
    if (this.dirty) {
      this.dirty = false;
      this.render();
    }
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const zoom = this.mapManager.getZoom();
    if (zoom < MIN_RENDER_ZOOM) return;

    // 1. Always draw claimed territory cells
    this.renderClaimedCells(ctx);

    // 2. In territory mode: show hex grid + selected cells
    if (this.active && zoom >= GRID_ZOOM) {
      this.renderHexGrid(ctx, w, h);
      this.renderSelectedCells(ctx);
    }
  }

  private renderClaimedCells(ctx: CanvasRenderingContext2D): void {
    const cells = this.territory.getVisibleCells();
    if (cells.length === 0) return;

    const buckets = new Map<string, TerritoryCell[]>();
    for (const cell of cells) {
      let b = buckets.get(cell.color);
      if (!b) { b = []; buckets.set(cell.color, b); }
      b.push(cell);
    }

    // Fills
    ctx.globalAlpha = 0.3;
    for (const [color, bucket] of buckets) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const cell of bucket) this.traceHex(ctx, cell.h3Index);
      ctx.fill();
    }

    // Borders
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    const borderPaths = new Map<string, { sx: number; sy: number; ex: number; ey: number }[]>();
    for (const cell of cells) {
      const boundary = h3ToBoundary(cell.h3Index);
      const neighbors = h3Neighbors(cell.h3Index);
      for (let i = 0; i < 6; i++) {
        const neighbor = this.territory.getCell(neighbors[i]);
        if (!neighbor || neighbor.ownerId !== cell.ownerId) {
          const a = this.mapManager.project(boundary[i]);
          const b = this.mapManager.project(boundary[(i + 1) % 6]);
          let edges = borderPaths.get(cell.color);
          if (!edges) { edges = []; borderPaths.set(cell.color, edges); }
          edges.push({ sx: a.x, sy: a.y, ex: b.x, ey: b.y });
        }
      }
    }
    for (const [color, edges] of borderPaths) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (const { sx, sy, ex, ey } of edges) { ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  /** Draw hex grid outline for all hexes in the viewport */
  private renderHexGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const tl = this.mapManager.unproject({ x: 0, y: 0 });
    const tr = this.mapManager.unproject({ x: w, y: 0 });
    const br = this.mapManager.unproject({ x: w, y: h });
    const bl = this.mapManager.unproject({ x: 0, y: h });

    // polygonToCells expects [[[lat, lng], ...]] — array of rings, each ring is [lat, lng] pairs
    const ring = [
      [tl.lat, tl.lng], [bl.lat, bl.lng], [br.lat, br.lng], [tr.lat, tr.lng], [tl.lat, tl.lng],
    ];

    let viewportCells: string[];
    try {
      viewportCells = polygonToCells([ring], H3_RESOLUTION, false);
    } catch {
      return;
    }

    if (viewportCells.length > 3000) return;

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const h3 of viewportCells) {
      if (this.territory.getCell(h3)) continue;     // claimed — has its own rendering
      if (this.selectedCells.has(h3)) continue;      // selected — drawn separately
      this.traceHex(ctx, h3);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  /** Draw selected (pending) cells with a bright highlight */
  private renderSelectedCells(ctx: CanvasRenderingContext2D): void {
    if (this.selectedCells.size === 0) return;

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#4ECDC4';
    ctx.beginPath();
    for (const h3 of this.selectedCells) this.traceHex(ctx, h3);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#4ECDC4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const h3 of this.selectedCells) this.traceHex(ctx, h3);
    ctx.stroke();
  }

  /** Trace a hexagon path */
  private traceHex(ctx: CanvasRenderingContext2D, h3Index: string): void {
    const verts = h3ToBoundary(h3Index);
    let first = true;
    for (const v of verts) {
      const s = this.mapManager.project(v);
      if (first) { ctx.moveTo(s.x, s.y); first = false; }
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }

  // ─── Claim progress bar ────────────────────────────────────────────────

  private showClaimProgress(progress: number, h3Index: string): void {
    if (progress <= 0) { this.hideClaimProgress(); return; }
    if (!this.claimProgressEl) {
      this.claimProgressEl = document.createElement('div');
      this.claimProgressEl.id = 'territory-claim-progress';
      this.claimProgressEl.style.cssText = `
        position:fixed;z-index:100;pointer-events:none;
        width:60px;height:8px;background:rgba(0,0,0,0.5);border-radius:4px;
        overflow:hidden;transform:translate(-50%,-100%);
      `;
      const bar = document.createElement('div');
      bar.id = 'territory-claim-bar';
      bar.style.cssText = 'height:100%;background:#4ECDC4;border-radius:4px;transition:width 0.05s linear;';
      this.claimProgressEl.appendChild(bar);
      document.body.appendChild(this.claimProgressEl);
    }
    const center = h3ToLngLat(h3Index);
    const screen = this.mapManager.project(center);
    this.claimProgressEl.style.left = `${screen.x}px`;
    this.claimProgressEl.style.top = `${screen.y - 20}px`;
    this.claimProgressEl.style.display = 'block';
    const bar = this.claimProgressEl.querySelector('#territory-claim-bar') as HTMLDivElement;
    if (bar) bar.style.width = `${progress * 100}%`;
    if (progress >= 1) setTimeout(() => this.hideClaimProgress(), 200);
  }

  hideClaimProgress(): void {
    if (this.claimProgressEl) this.claimProgressEl.style.display = 'none';
  }

  destroy(): void {
    this.mapManager.off('onRender', this.boundRender);
    document.removeEventListener('pointerdown', this.boundPointerDown, true);
    document.removeEventListener('pointerup', this.boundPointerUp, true);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    if (this.claimProgressEl?.parentNode) this.claimProgressEl.parentNode.removeChild(this.claimProgressEl);
  }
}
