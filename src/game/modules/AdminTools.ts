import { MapManager } from '../../map/MapManager';
import { BuildingManager } from '../BuildingManager';
import { Inventory } from '../Inventory';
import { buildingsAPI } from '../../api/BuildingsAPI';
import { notificationSystem } from '../NotificationSystem';

interface NetworkLike {
  deleteBuilding(buildingId: string): void;
}

export class AdminTools {
  private adminSelectMode = false;
  private selectionBoxEl: HTMLElement | null = null;
  private selectionStart: { x: number; y: number } | null = null;

  constructor(
    private mapManager: MapManager,
    private buildingManager: BuildingManager,
    private inventory: Inventory,
    private network?: NetworkLike,
  ) {}

  isSelectMode(): boolean {
    return this.adminSelectMode;
  }

  createUI(): void {
    const zoneTopRight = document.getElementById('zone-top-right');
    if (!zoneTopRight) return;

    const adminBtn = document.createElement('button');
    adminBtn.id = 'admin-select-btn';
    adminBtn.className = 'action-btn';
    adminBtn.textContent = '🔧';
    adminBtn.title = 'Admin: Selection Mode';
    zoneTopRight.appendChild(adminBtn);

    adminBtn.addEventListener('click', () => {
      this.adminSelectMode = !this.adminSelectMode;
      adminBtn.classList.toggle('active', this.adminSelectMode);

      if (this.adminSelectMode) {
        // Enable selection box drawing on the map
        this.enableAdminSelection();
      } else {
        this.disableAdminSelection();
      }
    });
  }

  private enableAdminSelection(): void {
    const map = this.mapManager.getMap();
    map.dragPan.disable(); // Disable map panning so we can draw selection box

    // Create selection box overlay
    this.selectionBoxEl = document.createElement('div');
    this.selectionBoxEl.id = 'admin-selection-box';
    this.selectionBoxEl.style.cssText = `
      position:fixed;display:none;
      border:2px solid rgba(59,130,246,0.8);
      background:rgba(59,130,246,0.15);
      z-index:500;pointer-events:none;
    `;
    document.body.appendChild(this.selectionBoxEl);

    const canvas = map.getCanvasContainer();
    canvas.style.cursor = 'crosshair';

    const onMouseDown = (e: MouseEvent) => {
      if (!this.adminSelectMode) return;
      this.selectionStart = { x: e.clientX, y: e.clientY };
      if (this.selectionBoxEl) {
        this.selectionBoxEl.style.display = 'block';
        this.selectionBoxEl.style.left = `${e.clientX}px`;
        this.selectionBoxEl.style.top = `${e.clientY}px`;
        this.selectionBoxEl.style.width = '0';
        this.selectionBoxEl.style.height = '0';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.selectionStart || !this.selectionBoxEl) return;
      const x = Math.min(this.selectionStart.x, e.clientX);
      const y = Math.min(this.selectionStart.y, e.clientY);
      const w = Math.abs(e.clientX - this.selectionStart.x);
      const h = Math.abs(e.clientY - this.selectionStart.y);
      this.selectionBoxEl.style.left = `${x}px`;
      this.selectionBoxEl.style.top = `${y}px`;
      this.selectionBoxEl.style.width = `${w}px`;
      this.selectionBoxEl.style.height = `${h}px`;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!this.selectionStart || !this.selectionBoxEl) return;
      const x1 = Math.min(this.selectionStart.x, e.clientX);
      const y1 = Math.min(this.selectionStart.y, e.clientY);
      const x2 = Math.max(this.selectionStart.x, e.clientX);
      const y2 = Math.max(this.selectionStart.y, e.clientY);
      this.selectionBoxEl.style.display = 'none';
      this.selectionStart = null;

      // Only process if box is big enough (not a click)
      if (x2 - x1 < 10 || y2 - y1 < 10) return;

      // Find all buildings inside the selection box
      const selected: string[] = [];
      this.buildingManager?.getBuildings().forEach((b, id) => {
        const sp = this.mapManager.project({ lng: b.lng, lat: b.lat });
        if (sp.x >= x1 && sp.x <= x2 && sp.y >= y1 && sp.y <= y2) {
          selected.push(id);
        }
      });

      if (selected.length > 0) {
        this.showAdminBulkActions(selected, (x1 + x2) / 2, (y1 + y2) / 2);
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store handlers for cleanup
    (this as any)._adminHandlers = { onMouseDown, onMouseMove, onMouseUp, canvas };
  }

  private disableAdminSelection(): void {
    const h = (this as any)._adminHandlers;
    if (h) {
      h.canvas.removeEventListener('mousedown', h.onMouseDown);
      document.removeEventListener('mousemove', h.onMouseMove);
      document.removeEventListener('mouseup', h.onMouseUp);
      h.canvas.style.cursor = '';
    }
    this.selectionBoxEl?.remove();
    this.selectionBoxEl = null;
    this.mapManager.getMap().dragPan.enable();
  }

  private showAdminBulkActions(buildingIds: string[], cx: number, cy: number): void {
    document.getElementById('admin-bulk-popup')?.remove();

    const popup = document.createElement('div');
    popup.id = 'admin-bulk-popup';
    popup.className = 'glass';
    popup.style.cssText = `
      position:fixed;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);
      z-index:1000;padding:12px;border-radius:12px;display:flex;flex-direction:column;gap:8px;
      min-width:150px;text-align:center;
    `;

    const label = document.createElement('div');
    label.style.cssText = 'color:white;font-size:13px;font-weight:600;';
    label.textContent = `${buildingIds.length} building${buildingIds.length > 1 ? 's' : ''} selected`;
    popup.appendChild(label);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-primary';
    deleteBtn.style.cssText = 'background:#ef4444;padding:8px;border-radius:8px;font-size:13px;';
    deleteBtn.textContent = `🗑️ Delete ${buildingIds.length}`;
    deleteBtn.addEventListener('click', () => {
      for (const id of buildingIds) {
        this.buildingManager?.removeBuilding(id);
        buildingsAPI.delete(id).catch(() => {});
        this.network?.deleteBuilding(id);
        // Remove from localStorage
        try {
          const key = 'gallax_local_buildings';
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify(stored.filter((b: any) => b.id !== id)));
        } catch {}
      }
      notificationSystem.show(`🗑️ Deleted ${buildingIds.length} buildings`, 'info');
      popup.remove();
    });
    popup.appendChild(deleteBtn);

    // Close
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);padding:6px;border-radius:8px;font-size:12px;cursor:pointer;';
    closeBtn.textContent = 'Cancel';
    closeBtn.addEventListener('click', () => popup.remove());
    popup.appendChild(closeBtn);

    document.body.appendChild(popup);

    // Dismiss on outside click
    setTimeout(() => {
      document.addEventListener('click', function dismiss(e) {
        if (!popup.contains(e.target as Node)) {
          popup.remove();
          document.removeEventListener('click', dismiss);
        }
      });
    }, 100);
  }
}
