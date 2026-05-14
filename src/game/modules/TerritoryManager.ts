import type { GeoJSONFeature } from 'mapbox-gl';
import { MapManager } from '../../map/MapManager';
import { GeckosNetworkManager } from '../../network/GeckosNetworkManager';
import { Inventory, ResourceType } from '../Inventory';
import { InputManager } from '../InputManager';
import { Player } from '../Player';
import { BuildingManager } from '../BuildingManager';
import {
  TerritorySystem, TerrainType,
  lngLatToH3, h3ToLngLat, playerColor,
} from '../TerritorySystem';
import { TerritoryRenderer } from '../TerritoryRenderer';
import { notificationSystem } from '../NotificationSystem';
import { authService } from '../../auth/AuthService';
import type { ProgressionSystem } from '../ProgressionSystem';

interface TerritoryRow {
  h3_index: string;
  owner_id: string;
  owner_name?: string | null;
  color: string;
  claimed_at: string;
  last_visited: string;
}

interface MapboxFeature extends GeoJSONFeature {
  sourceLayer?: string;
}

function getProgressionLevel(): number {
  return (window as unknown as { progression?: ProgressionSystem }).progression
    ?.getStats?.()?.level ?? 1;
}

const DAILY_CLAIM_BUDGET = 8;
const BUDGET_KEY = 'gallax_territory_daily';

interface DailyBudget { date: string; used: number }

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

function loadBudget(): DailyBudget {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (raw) { const b = JSON.parse(raw) as DailyBudget; if (b.date === todayStr()) return b; }
  } catch { /* ignore */ }
  return { date: todayStr(), used: 0 };
}

function saveBudget(budget: DailyBudget): void {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
}

// ─── TerritoryManager ─────────────────────────────────────────────────────────

export class TerritoryManager {
  private readonly system: TerritorySystem;
  private readonly renderer: TerritoryRenderer;

  private lastCollected = 0;
  private indicatorEl: HTMLDivElement | null = null;
  private indicatorOwner: string | null = null;
  private productionTimer: ReturnType<typeof setInterval> | null = null;
  private attackNotifCooldown = 0;
  private modeActive = false;
  private toggleBtn: HTMLButtonElement | null = null;

  // Edit mode: track original state to compute diff
  private originalCells: Set<string> = new Set();
  private confirmBar: HTMLDivElement | null = null;
  private confirmCountEl: HTMLSpanElement | null = null;
  private budget: DailyBudget;

  // Optional: building manager for removing buildings on unclaimed tiles
  private buildingManager: BuildingManager | null = null;

  constructor(
    private readonly mapManager: MapManager,
    private readonly network: GeckosNetworkManager,
    private readonly inventory: Inventory,
    private readonly inputManager: InputManager,
    private readonly getPlayer: () => Player | null,
    private readonly getPlayerId: () => string,
    private readonly getPlayerName: () => string,
  ) {
    this.system = new TerritorySystem();
    this.renderer = new TerritoryRenderer(mapManager, this.system);
    this.budget = loadBudget();
  }

  setBuildingManager(bm: BuildingManager): void {
    this.buildingManager = bm;
  }

  async init(): Promise<void> {
    (window as any).territory = this.system;
    (window as any).territoryRenderer = this.renderer;
    await this.loadFromServer();
    this.setupControls();
  }

  update(): void {
    this.renderer.flushRender();
    const player = this.getPlayer();
    if (player) {
      const pos = player.getPosition();
      const h3 = lngLatToH3(pos.lng, pos.lat);
      const playerId = this.getPlayerId();
      this.system.touchNearby(h3, playerId);
      this.updateIndicator(h3, playerId);
    }
  }

  flushRender(): void { this.renderer.flushRender(); }
  getSystem(): TerritorySystem { return this.system; }

  onTerritoryClaimed(
    playerId: string, playerName: string, cells: string[], color: string,
  ): void {
    const myId = this.network.getPlayerId();
    if (playerId === myId) return;
    let myLostCells = 0;
    for (const h3 of cells) {
      const existing = this.system.getCell(h3);
      if (existing && existing.ownerId === myId) myLostCells++;
      this.system.claimCell(h3, playerId, playerName, color);
    }
    this.renderer.markDirty();
    if (myLostCells > 0 && Date.now() > this.attackNotifCooldown) {
      this.attackNotifCooldown = Date.now() + 5000;
      notificationSystem.show(
        `⚔️ ${playerName} is taking your territory! (${myLostCells} cell${myLostCells > 1 ? 's' : ''})`,
        'warning', 4000,
      );
    }
  }

  stop(): void { if (this.productionTimer) clearInterval(this.productionTimer); }

  getRemainingBudget(): number {
    this.budget = loadBudget();
    return Math.max(0, DAILY_CLAIM_BUDGET - this.budget.used);
  }

  // ─── Diff helpers ─────────────────────────────────────────────────────────

  /** Cells the player wants to add (selected but not in original) */
  private getNewCells(): string[] {
    return this.renderer.getSelectedCells().filter(h => !this.originalCells.has(h));
  }

  /** Cells the player wants to remove (in original but deselected) */
  private getRemovedCells(): string[] {
    return Array.from(this.originalCells).filter(h => !this.renderer.getSelectedCells().includes(h));
  }

  /** Net new claims that count against daily budget */
  private getNetNew(): number {
    return Math.max(0, this.getNewCells().length - this.getRemovedCells().length);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async loadFromServer(): Promise<void> {
    try {
      const user = authService.getUser();
      const headers: Record<string, string> = {};
      if (user?.id?.startsWith('guest_')) headers['X-Guest-ID'] = user.id;
      const res = await fetch('/api/territory', { headers });
      if (res.ok) {
        const rows = await res.json() as TerritoryRow[];
        const cells = rows.map((r) => ({
          h3Index: r.h3_index,
          ownerId: r.owner_id,
          ownerName: r.owner_name || undefined,
          color: r.color || playerColor(r.owner_id),
          claimedAt: new Date(r.claimed_at).getTime(),
          lastVisited: new Date(r.last_visited).getTime(),
        }));
        this.system.loadCells(cells);
        this.renderer.markDirty();
        console.log(`🏴 Loaded ${cells.length} territory cells from server`);
        this.showWelcome(user?.id || 'local');
      }
    } catch (err) { console.error('Failed to load territory:', err); }
  }

  private showWelcome(playerId: string): void {
    const lastCollected = parseInt(localStorage.getItem('gallax_territory_last_collected') || '0');
    if (!lastCollected) {
      localStorage.setItem('gallax_territory_last_collected', Date.now().toString());
      this.lastCollected = Date.now();
      return;
    }
    const { resources, hoursElapsed } = this.system.calculateAccumulatedResources(playerId, lastCollected);
    const resourceKeys = Object.keys(resources).filter(k => resources[k] > 0);
    if (resourceKeys.length > 0) {
      for (const [type, amount] of Object.entries(resources)) {
        if (amount > 0) this.inventory.add(type as ResourceType, amount);
      }
      const emojiMap: Record<string, string> = { wood: '🪵', stone: '🪨', fish: '🐟', gem: '💎', shell: '🐚', herb: '🌿' };
      const summary = resourceKeys.map(k => `${emojiMap[k] || ''} ${resources[k]} ${k}`).join(', ');
      const hours = Math.floor(hoursElapsed);
      const mins = Math.floor((hoursElapsed - hours) * 60);
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      notificationSystem.show(`🏴 Territory produced (${timeStr}): ${summary}`, 'success', 6000);
    }
    localStorage.setItem('gallax_territory_last_collected', Date.now().toString());
    this.lastCollected = Date.now();
    this.productionTimer = setInterval(() => this.collectProduction(), 5 * 60 * 1000);
  }

  private collectProduction(): void {
    const playerId = authService.getUser()?.id || this.network.getPlayerId() || 'local';
    const { resources } = this.system.calculateAccumulatedResources(playerId, this.lastCollected || Date.now(), undefined, 1);
    let any = false;
    for (const [type, amount] of Object.entries(resources)) {
      if (amount > 0) { this.inventory.add(type as ResourceType, amount); any = true; }
    }
    if (any) {
      const summary = Object.entries(resources).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${k}`).join(', ');
      notificationSystem.show(`🏴 Territory: ${summary}`, 'info');
    }
    this.lastCollected = Date.now();
    localStorage.setItem('gallax_territory_last_collected', Date.now().toString());
  }

  private async saveToServer(cells: string[], color: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/territory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cells, color }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        return { ok: false, error: body.error || `Server error (${res.status})` };
      }
      return { ok: true };
    } catch { return { ok: false, error: 'Network error — check your connection' }; }
  }

  private async deleteFromServer(cells: string[]): Promise<{ ok: boolean; error?: string }> {
    try {
      // Use POST with action:'delete' — Safari drops body on DELETE requests
      const res = await fetch('/api/territory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', cells }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        return { ok: false, error: body.error || `Server error (${res.status})` };
      }
      return { ok: true };
    } catch { return { ok: false, error: 'Network error' }; }
  }

  private detectTerrain(h3Index: string): TerrainType {
    const lngLat = h3ToLngLat(h3Index);
    const screen = this.mapManager.project(lngLat);
    try {
      const map = this.mapManager.getMap();
      const features = map.queryRenderedFeatures([screen.x, screen.y]) as MapboxFeature[];
      for (const f of features) {
        const sl = f.sourceLayer || '';
        const li = f.layer?.id || '';
        const cl = f.properties?.class || '';
        if (sl === 'water' || li.includes('water')) return 'water';
        if (sl === 'landuse' && ['park', 'grass', 'wood', 'scrub', 'pitch', 'garden', 'meadow', 'forest'].includes(cl)) return 'park';
        if (sl === 'road') return 'road';
      }
    } catch { /* map not ready */ }
    return 'urban';
  }

  // ─── Territory mode ────────────────────────────────────────────────────────

  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 't') this.toggleMode();
    });
    const btn = document.createElement('button');
    btn.id = 'territory-draw-btn';
    btn.className = 'action-btn';
    btn.innerHTML = '🏴';
    btn.title = 'Claim territory (T)';
    btn.addEventListener('click', () => this.toggleMode());
    this.toggleBtn = btn;
    const zone = document.getElementById('zone-bottom-left');
    if (zone) zone.appendChild(btn); else document.body.appendChild(btn);
  }

  private toggleMode(): void {
    if (this.modeActive) this.exitMode();
    else this.enterMode();
  }

  private enterMode(): void {
    const user = authService.getUser();
    if (!user || user.id.startsWith('guest_')) {
      notificationSystem.show('🏴 Sign in with Google to claim territory', 'info', 3000);
      return;
    }

    this.modeActive = true;
    this.toggleBtn?.classList.add('active');

    // Snapshot current owned cells as the "original" state
    const playerId = this.getPlayerId();
    this.originalCells.clear();
    for (const cell of this.system.getPlayerCells(playerId)) {
      this.originalCells.add(cell.h3Index);
    }

    // Pre-select all currently owned cells in the renderer
    this.renderer.enterMode((h3, selected) => this.onCellToggled(h3, selected));
    for (const h of this.originalCells) {
      this.renderer.selectCell(h);
    }

    this.createConfirmBar();
    this.updateConfirmBar();

    const remaining = this.getRemainingBudget();
    const owned = this.originalCells.size;
    notificationSystem.show(
      `🏴 Tap hexes to add/remove territory (${owned} owned, ${remaining} new/day)`,
      'info', 3000,
    );
  }

  private exitMode(): void {
    this.modeActive = false;
    this.toggleBtn?.classList.remove('active');
    this.renderer.exitMode();
    this.originalCells.clear();
    this.destroyConfirmBar();
  }

  // ─── Cell toggling ─────────────────────────────────────────────────────────

  private onCellToggled(h3Index: string, selected: boolean): void {
    if (selected) {
      // Adding a cell — check if it's someone else's
      const existing = this.system.getCell(h3Index);
      if (existing && existing.ownerId !== this.getPlayerId()) {
        // Enemy cell — block for now (could allow contesting later)
        this.renderer.deselectCell(h3Index);
        notificationSystem.show(`🏴 That hex belongs to ${existing.ownerName || 'someone else'}`, 'info', 1500);
        return;
      }

      // If this is a NEW cell (not in original), check budget
      if (!this.originalCells.has(h3Index)) {
        const netNew = this.getNetNew();
        if (netNew > this.getRemainingBudget()) {
          this.renderer.deselectCell(h3Index);
          notificationSystem.show(`🏴 No more claims today — remove a hex first to free a slot`, 'info', 2000);
          return;
        }
      }
    }
    this.updateConfirmBar();
  }

  private async confirmChanges(): Promise<void> {
    const newCells = this.getNewCells();
    const removedCells = this.getRemovedCells();

    if (newCells.length === 0 && removedCells.length === 0) {
      this.exitMode();
      return;
    }

    const playerId = this.getPlayerId();
    const name = this.getPlayerName();
    const color = playerColor(playerId);

    // 1. Delete removed cells first (frees server-side daily budget slots)
    if (removedCells.length > 0) {
      const delResult = await this.deleteFromServer(removedCells);
      if (!delResult.ok) {
        notificationSystem.show(`🏴 ${delResult.error}`, 'warning', 4000);
        return;
      }
      // Remove locally
      for (const h3 of removedCells) {
        this.system.removeCell(h3);
      }
      // Remove buildings on unclaimed tiles
      this.removeBuildingsOnCells(removedCells);
    }

    // 2. Claim new cells
    if (newCells.length > 0) {
      const saveResult = await this.saveToServer(newCells, color);
      if (!saveResult.ok) {
        notificationSystem.show(`🏴 ${saveResult.error}`, 'warning', 4000);
        // The deletes already went through — don't rollback those, but don't
        // claim new cells either. Stay in mode so user can adjust.
        return;
      }
      for (const h3 of newCells) {
        this.system.claimCell(h3, playerId, name, color);
        const cell = this.system.getCell(h3);
        if (cell) cell.terrain = this.detectTerrain(h3);
      }
      this.network.claimTerritory(newCells, color, name);
    }

    // Update budget
    const netNew = Math.max(0, newCells.length - removedCells.length);
    if (netNew > 0) {
      this.budget.used += netNew;
      saveBudget(this.budget);
    }

    // Summary
    const parts: string[] = [];
    if (newCells.length > 0) parts.push(`+${newCells.length} claimed`);
    if (removedCells.length > 0) parts.push(`-${removedCells.length} released`);
    notificationSystem.show(`🏴 ${parts.join(', ')} (${this.getRemainingBudget()} left today)`, 'success', 3000);

    this.exitMode();
  }

  /** Remove buildings that sit on cells being unclaimed */
  private removeBuildingsOnCells(cells: string[]): void {
    if (!this.buildingManager) return;
    const unclaimed = new Set(cells);
    const buildings = this.buildingManager.getBuildings();
    const playerId = this.getPlayerId();

    for (const [id, building] of buildings) {
      if (building.ownerId !== playerId) continue;
      const bH3 = lngLatToH3(building.lng, building.lat);
      if (unclaimed.has(bH3)) {
        this.buildingManager.removeBuilding(id);
        // Also delete from server
        this.network.deleteBuilding(id);
        console.log(`🏴 Removed building ${id} from unclaimed hex ${bH3}`);
      }
    }
  }

  // ─── Confirm bar UI ────────────────────────────────────────────────────────

  private createConfirmBar(): void {
    if (this.confirmBar) return;
    const bar = document.createElement('div');
    bar.id = 'territory-confirm-bar';
    bar.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      z-index:200;display:flex;align-items:center;gap:12px;
      padding:10px 20px;border-radius:16px;
      background:rgba(20,20,30,0.85);
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      border:1px solid rgba(78,205,196,0.4);
      color:white;font-size:14px;font-weight:500;
    `;
    const countSpan = document.createElement('span');
    countSpan.id = 'territory-confirm-count';
    this.confirmCountEl = countSpan;

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '✓ Confirm';
    confirmBtn.style.cssText = `
      padding:8px 18px;border-radius:10px;border:none;
      background:#4ECDC4;color:#000;font-weight:700;font-size:14px;cursor:pointer;
    `;
    confirmBtn.addEventListener('click', () => this.confirmChanges());

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕';
    cancelBtn.style.cssText = `
      padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);
      background:transparent;color:white;font-size:14px;cursor:pointer;
    `;
    cancelBtn.addEventListener('click', () => this.exitMode());

    bar.appendChild(countSpan);
    bar.appendChild(confirmBtn);
    bar.appendChild(cancelBtn);
    document.body.appendChild(bar);
    this.confirmBar = bar;
  }

  private updateConfirmBar(): void {
    if (!this.confirmCountEl) return;
    const newCount = this.getNewCells().length;
    const removedCount = this.getRemovedCells().length;
    const parts: string[] = [];
    if (newCount > 0) parts.push(`+${newCount} new`);
    if (removedCount > 0) parts.push(`-${removedCount} removed`);
    if (parts.length === 0) parts.push('no changes');
    const remaining = this.getRemainingBudget();
    this.confirmCountEl.textContent = `🏴 ${parts.join(', ')} · ${remaining} new/day`;
  }

  private destroyConfirmBar(): void {
    this.confirmBar?.remove();
    this.confirmBar = null;
    this.confirmCountEl = null;
  }

  // ─── Territory indicator ───────────────────────────────────────────────────

  private updateIndicator(playerH3: string, myPlayerId: string): void {
    const owner = this.system.getTerritoryOwnerAt(playerH3);
    if (owner && owner.ownerId === myPlayerId) {
      if (this.indicatorOwner !== 'self') {
        this.indicatorOwner = 'self';
        this.showIndicator('Your', owner.color, true);
      }
    } else if (owner) {
      if (this.indicatorOwner !== owner.ownerId) {
        this.indicatorOwner = owner.ownerId;
        this.showIndicator(owner.ownerName || 'Unknown', owner.color, false);
      }
    } else if (this.indicatorOwner) {
      this.indicatorOwner = null;
      this.hideIndicator();
    }
  }

  private showIndicator(ownerName: string, color: string, isOwn: boolean): void {
    if (!this.indicatorEl) {
      this.indicatorEl = document.createElement('div');
      this.indicatorEl.id = 'territory-indicator';
      this.indicatorEl.style.cssText = `
        position:fixed;top:50px;left:50%;transform:translateX(-50%);
        z-index:100;padding:6px 16px;border-radius:20px;
        font-size:13px;font-weight:500;color:white;
        background:rgba(30,30,40,0.7);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
        border:2px solid;transition:opacity 0.3s ease;
        opacity:0;pointer-events:none;
        display:flex;align-items:center;gap:8px;
      `;
      document.body.appendChild(this.indicatorEl);
    }
    const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>`;
    const label = isOwn ? 'Your territory' : `${ownerName}'s territory`;
    this.indicatorEl.style.borderColor = color;
    this.indicatorEl.innerHTML = `${dot}${label}`;
    this.indicatorEl.style.opacity = '1';
  }

  private hideIndicator(): void { if (this.indicatorEl) this.indicatorEl.style.opacity = '0'; }
}
