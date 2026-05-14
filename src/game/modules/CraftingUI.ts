import { CraftingSystem } from '../Crafting';
import { Inventory } from '../Inventory';
import { WeaponSystem, GEAR_DEFS } from '../WeaponSystem';
import { CombatSystem } from '../CombatSystem';
import { BUILDING_DEFS } from '../BuildingManager';
import { authService } from '../../auth/AuthService';
import { notificationSystem } from '../NotificationSystem';

export interface CraftingUICallbacks {
  getBuildingManager(): { getBuildings(): Map<string, { type: string; ownerId: string }> } | null;
  getMapManager(): { getMap(): any };
  setPlacingBuilding(placing: boolean): void;
  isPlacingBuilding(): boolean;
  showPlacementHint(emoji: string, name: string): void;
  hidePlacementHint(): void;
}

export class CraftingUIManager {
  constructor(
    private crafting: CraftingSystem,
    private inventory: Inventory,
    private weaponSystem: WeaponSystem | null,
    private combatSystem: CombatSystem | null,
    private isAdmin: boolean,
    private callbacks: CraftingUICallbacks
  ) {}

  createUI(): void {
    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'craft-toggle-btn';
    toggleBtn.className = 'action-btn';
    toggleBtn.innerHTML = '🔨';
    toggleBtn.title = 'Toggle Crafting Menu';
    toggleBtn.addEventListener('click', () => {
      const menu = document.getElementById('crafting-menu');
      if (menu) {
        const isVisible = menu.classList.toggle('visible');
        toggleBtn.classList.toggle('active', isVisible);
      }
    });
    // Add to bottom-left zone (above the art icon)
    const zoneBottomLeft = document.getElementById('zone-bottom-left');
    if (zoneBottomLeft) zoneBottomLeft.appendChild(toggleBtn);
    else document.body.appendChild(toggleBtn);

    const craftMenu = document.createElement('div');
    craftMenu.id = 'crafting-menu';
    craftMenu.innerHTML = `
      <div class="crafting-tabs" style="display:flex;gap:2px;margin-bottom:8px;">
        <button class="craft-tab active" data-tab="buildings" style="flex:1;padding:6px;border:none;border-radius:8px 8px 0 0;background:rgba(255,255,255,0.2);color:white;font-size:13px;cursor:pointer;">🏗️ Build</button>
        <button class="craft-tab" data-tab="weapons" style="flex:1;padding:6px;border:none;border-radius:8px 8px 0 0;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:13px;cursor:pointer;">⚔️ Gear</button>
      </div>
      <div class="crafting-items"></div>
      <div class="weapon-items" style="display:none;"></div>
    `;
    document.body.appendChild(craftMenu);

    // Tab switching
    craftMenu.querySelectorAll('.craft-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        craftMenu.querySelectorAll('.craft-tab').forEach(t => {
          (t as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
          (t as HTMLElement).style.color = 'rgba(255,255,255,0.6)';
          t.classList.remove('active');
        });
        (tab as HTMLElement).style.background = 'rgba(255,255,255,0.2)';
        (tab as HTMLElement).style.color = 'white';
        tab.classList.add('active');

        const buildItems = craftMenu.querySelector('.crafting-items') as HTMLElement;
        const weaponItems = craftMenu.querySelector('.weapon-items') as HTMLElement;
        if (buildItems) buildItems.style.display = tabName === 'buildings' ? '' : 'none';
        if (weaponItems) weaponItems.style.display = tabName === 'weapons' ? '' : 'none';

        if (tabName === 'weapons') this.updateWeaponTab();
      });
    });

    this.updateBuildingTab();
  }

  updateBuildingTab(): void {
    const container = document.querySelector('#crafting-menu .crafting-items');
    if (!container) return;

    // Show resource counts at top of crafting menu
    let resourceBar = document.querySelector('#crafting-menu .craft-resources') as HTMLElement;
    if (!resourceBar) {
      resourceBar = document.createElement('div');
      resourceBar.className = 'craft-resources';
      resourceBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;padding:4px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:11px;';
      container.parentElement?.insertBefore(resourceBar, container);
    }
    const items = this.inventory.getAll();
    const resourceTypes = ['wood', 'stone', 'fish', 'gem', 'shell', 'herb'] as const;
    resourceBar.innerHTML = resourceTypes.map(r => {
      const count = items.get(r) || 0;
      return `<span style="display:flex;align-items:center;gap:1px;color:${count > 0 ? 'white' : 'rgba(255,255,255,0.4)'};">${this.getResourceEmoji(r)}${count}</span>`;
    }).join('');

    // Check if home already placed
    const userId = authService.getUser()?.id || 'local';
    const hasHome = (() => {
      const existing = this.callbacks.getBuildingManager()?.getBuildings();
      if (existing) {
        for (const b of existing.values()) {
          if (b.type === 'my_home' && b.ownerId === userId) return true;
        }
      }
      const local = JSON.parse(localStorage.getItem('gallax_local_buildings') || '[]');
      return local.some((b: any) => b.type === 'my_home' && b.ownerId === userId);
    })();

    const buildings = this.crafting.getAvailableBuildings();
    container.innerHTML = buildings.map(({ type, def, canCraft }) => {
      const isHomePlaced = type === 'my_home' && hasHome;
      const costLabel = isHomePlaced ? '✅ Placed' :
        Object.keys(def.cost).length === 0 ? '✨ FREE' :
        Object.entries(def.cost).map(([r, a]) => `${a}${this.getResourceEmoji(r)}`).join(' ');
      return `
      <button class="craft-btn ${isHomePlaced ? 'cannot-craft' : canCraft ? 'can-craft' : 'cannot-craft'} ${this.crafting.getSelectedBuilding() === type ? 'selected' : ''}" data-type="${type}" ${isHomePlaced ? 'disabled' : ''}>
        <span class="craft-emoji">${def.emoji}</span>
        <span class="craft-name">${def.name}</span>
        <span class="craft-cost">${costLabel}</span>
      </button>
    `;}).join('');

    // Add click handlers
    container.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (type && this.crafting.canCraft(type)) {
          if (this.crafting.getSelectedBuilding() === type) {
            // Deselect
            this.crafting.selectBuilding(null);
            this.callbacks.setPlacingBuilding(false);
            this.callbacks.hidePlacementHint();
          } else {
            // Select for placement
            this.crafting.selectBuilding(type);
            this.callbacks.setPlacingBuilding(true);
            this.callbacks.showPlacementHint(BUILDING_DEFS[type].emoji, BUILDING_DEFS[type].name);
          }
          this.updateBuildingTab();
          this.updateMapCursor();
        }
      });
    });
  }

  updateWeaponTab(): void {
    const container = document.querySelector('#crafting-menu .weapon-items');
    if (!container || !this.weaponSystem) return;

    const gearIds = Object.keys(GEAR_DEFS);
    const loadout = this.weaponSystem.getLoadout();

    container.innerHTML = gearIds.map(id => {
      const def = GEAR_DEFS[id];
      const crafted = this.weaponSystem!.hasCrafted(id);
      const equipped = loadout[def.slot as keyof typeof loadout] === id;
      const check = this.weaponSystem!.canCraft(id);
      const costStr = Object.entries(def.cost).map(([r, a]) => `${a}${this.getResourceEmoji(r as string)}`).join(' ');
      const statStr = def.stats.damage > 0 ? `⚔️${def.stats.damage}` : `🛡️${def.stats.defense}`;

      if (crafted) {
        return `<button class="craft-btn ${equipped ? 'selected' : 'can-craft'}" data-gear="${id}" data-action="${equipped ? 'unequip' : 'equip'}">
          <span class="craft-emoji">${def.emoji}</span>
          <span class="craft-name">${def.name} ${statStr}</span>
          <span class="craft-cost">${equipped ? '✅ Equipped' : 'Tap to equip'}</span>
        </button>`;
      } else {
        return `<button class="craft-btn ${check.ok ? 'can-craft' : 'cannot-craft'}" data-gear="${id}" data-action="craft">
          <span class="craft-emoji">${def.emoji}</span>
          <span class="craft-name">${def.name} ${statStr}</span>
          <span class="craft-cost">${costStr}${!check.ok && check.reason ? ` (${check.reason})` : ''}</span>
        </button>`;
      }
    }).join('');

    container.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gearId = btn.getAttribute('data-gear');
        const action = btn.getAttribute('data-action');
        if (!gearId || !this.weaponSystem) return;

        if (action === 'craft') {
          if (this.weaponSystem.craft(gearId)) {
            notificationSystem.show(`⚔️ Crafted ${GEAR_DEFS[gearId].emoji} ${GEAR_DEFS[gearId].name}!`, 'info');
            // Auto-equip if slot is empty
            const def = GEAR_DEFS[gearId];
            if (!this.weaponSystem!.getEquipped(def.slot)) {
              this.weaponSystem!.equip(gearId);
            }
          }
        } else if (action === 'equip') {
          this.weaponSystem.equip(gearId);
        } else if (action === 'unequip') {
          const def = GEAR_DEFS[gearId];
          this.weaponSystem.unequip(def.slot);
        }

        // Update equipment bonuses on combat system
        if (this.combatSystem && this.weaponSystem) {
          const stats = this.weaponSystem.getCombinedStats();
          this.combatSystem.setEquipmentBonuses({
            damage: stats.damage,
            defense: stats.defense,
            maxHp: 0,
            attackSpeed: stats.speed - 1.0,
          });
        }

        this.updateWeaponTab();
        this.updateBuildingTab();
      });
    });
  }

  getResourceEmoji(resource: string): string {
    const emojis: Record<string, string> = {
      wood: '🪵', stone: '🪨', fish: '🐟', gem: '💎', shell: '🐚', herb: '🌿'
    };
    return emojis[resource] || '?';
  }

  updateMapCursor(): void {
    const map = this.callbacks.getMapManager().getMap();
    const mapContainer = map.getContainer();
    if (this.callbacks.isPlacingBuilding()) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = '';
    }
  }
}
