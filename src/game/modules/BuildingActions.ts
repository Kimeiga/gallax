import { MapManager } from '../../map/MapManager';
import { BuildingManager, BUILDING_DEFS } from '../BuildingManager';
import { Inventory } from '../Inventory';
import { GeckosNetworkManager as NetworkManager } from '../../network/GeckosNetworkManager';
import { CraftingSystem } from '../Crafting';
import { authService } from '../../auth/AuthService';
import { buildingsAPI } from '../../api/BuildingsAPI';
import { notificationSystem } from '../NotificationSystem';
import { HomeInterior } from '../HomeInterior';
import { Player } from '../Player';
import { makeDragHandle } from '../utils/gizmoHandle';

export interface BuildingActionState {
  selectedBuildingId: string | null;
  rotationHandleEl: HTMLElement | null;
  moveHandleEl: HTMLElement | null;
  rotationLineEl: HTMLElement | null;
  buildingGlowEl: HTMLElement | null;
  isRotating: boolean;
  isMovingBuilding: boolean;
  rotationStartAngle: number;
  buildingStartRotation: number;
  moveStartScreenPos: { x: number; y: number } | null;
  buildingStartPos: { lng: number; lat: number } | null;
  boundUpdateGizmoPosition: (() => void) | null;
  isPlacingBuilding: boolean;
  isAdmin: boolean;
  _deleteHandleEl?: HTMLElement | null;
}

export interface BuildingDeps {
  mapManager: MapManager;
  buildingManager: BuildingManager | null;
  inventory: Inventory;
  network: NetworkManager;
  crafting: CraftingSystem;
  player: Player | null;
  playerName: string;
  playerSpriteNum: number;
  homeInterior: HomeInterior | null;
  isWater: (lng: number, lat: number) => boolean;
  saveBuildingToLocalStorage: (building: { id: string; type: string; lng: number; lat: number; ownerId: string; ownerName?: string; rotation: number }) => void;
  updateCraftingUI: () => void;
  updateMapCursor: () => void;
}

// Show action icons above a home building (Enter / Move)
export function showBuildingActions(state: BuildingActionState, deps: BuildingDeps, building: any, screenX: number, screenY: number, isOwner: boolean): void {
  // Remove any existing action popup
  document.getElementById('building-action-popup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'building-action-popup';
  popup.style.cssText = `
    position: fixed;
    left: ${screenX}px;
    top: ${screenY - 50}px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 500;
    pointer-events: auto;
  `;

  // Enter button
  const enterBtn = document.createElement('button');
  enterBtn.className = 'action-btn';
  enterBtn.style.cssText = 'width:36px;height:36px;min-width:36px;min-height:36px;font-size:16px;';
  enterBtn.textContent = '🚪';
  enterBtn.title = 'Enter Home';
  enterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.remove();
    // Walk to building then enter
    if (deps.player) {
      deps.player.setTarget({ lng: building.lng, lat: building.lat, type: 'terrain' }, () => {
        const userId = authService.getUser()?.id || 'local';
        const isOwner = building.ownerId === userId;
        // Get owner name from the building's name tag, or from auth if it's ours
        let ownerName = 'Someone';
        if (isOwner) {
          ownerName = deps.playerName || authService.getUser()?.name || 'You';
        } else {
          // Use stored ownerName, or fall back to parsing the nameTag text
          ownerName = building.ownerName || (building.nameTag?.text?.replace("'s Home", '')) || 'Someone';
        }
        if (deps.homeInterior) {
          // Dismiss any active building gizmo so it doesn't bleed through the interior overlay
          if (state.selectedBuildingId) deselectBuilding(state, deps);
          deps.homeInterior.enter(building.id, ownerName, deps.playerSpriteNum, isOwner);
          // Broadcast that we entered this home
          deps.network.enterHome(building.id, deps.playerSpriteNum, deps.playerName);
          localStorage.setItem('gallax_entered_home', '1');
        }
      });
    }
  });
  popup.appendChild(enterBtn);

  // Move button (only for owner)
  if (isOwner) {
    const moveBtn = document.createElement('button');
    moveBtn.className = 'action-btn';
    moveBtn.style.cssText = 'width:36px;height:36px;min-width:36px;min-height:36px;font-size:16px;';
    moveBtn.textContent = '✋';
    moveBtn.title = 'Move Building';
    moveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
      selectBuildingForRotation(state, deps, building.id);
    });
    popup.appendChild(moveBtn);

    // Style button - opens emoji + color picker for the home
    const styleBtn = document.createElement('button');
    styleBtn.className = 'action-btn';
    styleBtn.style.cssText = 'width:36px;height:36px;min-width:36px;min-height:36px;font-size:16px;';
    styleBtn.textContent = '🎨';
    styleBtn.title = 'Change Style';
    styleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
      showHomeStylePicker(state, deps, building.id);
    });
    popup.appendChild(styleBtn);
  }

  document.body.appendChild(popup);

  // Remove popup when clicking elsewhere
  const removePopup = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener('click', removePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', removePopup), 100);
}

// Home style picker: change emoji + tint color
export function showHomeStylePicker(state: BuildingActionState, deps: BuildingDeps, buildingId: string): void {
  document.getElementById('home-style-picker')?.remove();

  const buildingObj = deps.buildingManager?.getBuildings().get(buildingId);
  if (!buildingObj) return;

  const overlay = document.createElement('div');
  overlay.id = 'home-style-picker';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.4);z-index:10000;
    display:flex;justify-content:center;align-items:center;
  `;

  const panel = document.createElement('div');
  panel.className = 'glass';
  panel.style.cssText = `
    border-radius:16px;padding:20px;width:300px;max-width:90%;
    display:flex;flex-direction:column;gap:12px;color:white;
  `;

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'font-size:16px;font-weight:600;text-align:center;';
  title.textContent = '🏡 Change Home Style';
  panel.appendChild(title);

  // Emoji grid - all building-type emojis
  const homeEmojis = [
    '🏡', '🏠', '🛖', '🏘️', '🏚️',
    '🏰', '🏯', '🏛️', '🏗️', '🏢',
    '🏣', '🏤', '🏥', '🏦', '🏨',
    '🏩', '🏪', '🏫', '🏬', '🏭',
    '⛪', '🕌', '🕍', '⛩️', '🕋',
  ];

  const emojiLabel = document.createElement('div');
  emojiLabel.style.cssText = 'font-size:12px;opacity:0.6;';
  emojiLabel.textContent = 'Choose a building:';
  panel.appendChild(emojiLabel);

  const emojiGrid = document.createElement('div');
  emojiGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:4px;';

  const currentEmoji = buildingObj.text.text;

  for (const emoji of homeEmojis) {
    const btn = document.createElement('button');
    const isSelected = emoji === currentEmoji;
    btn.style.cssText = `
      aspect-ratio:1;font-size:24px;border-radius:8px;cursor:pointer;
      border:${isSelected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)'};
      background:${isSelected ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'};
      display:flex;align-items:center;justify-content:center;
    `;
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      buildingObj.text.text = emoji;
      localStorage.setItem(`gallax_home_emoji_${buildingId}`, emoji);
      deps.network.updateHomeStyle(buildingId, emoji, undefined);
      // Update selection
      emojiGrid.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.border = '1px solid rgba(255,255,255,0.1)';
        (b as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
      });
      btn.style.border = '2px solid #3b82f6';
      btn.style.background = 'rgba(59,130,246,0.2)';
    });
    emojiGrid.appendChild(btn);
  }
  panel.appendChild(emojiGrid);

  // Color picker
  const colorLabel = document.createElement('div');
  colorLabel.style.cssText = 'font-size:12px;opacity:0.6;margin-top:4px;';
  colorLabel.textContent = 'Tint color:';
  panel.appendChild(colorLabel);

  const colorRow = document.createElement('div');
  colorRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  const savedTint = localStorage.getItem(`gallax_home_tint_${buildingId}`);
  colorInput.value = savedTint?.startsWith('#') ? savedTint : '#ffffff';
  colorInput.style.cssText = 'width:48px;height:36px;border:none;border-radius:8px;cursor:pointer;background:none;';

  colorInput.addEventListener('input', () => {
    const tint = parseInt(colorInput.value.slice(1), 16);
    buildingObj.text.tint = tint;
    localStorage.setItem(`gallax_home_tint_${buildingId}`, colorInput.value);
    deps.network.updateHomeStyle(buildingId, undefined, colorInput.value);
  });

  const resetBtn = document.createElement('button');
  resetBtn.style.cssText = 'padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:12px;';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => {
    colorInput.value = '#ffffff';
    buildingObj.text.tint = 0xffffff;
    localStorage.removeItem(`gallax_home_tint_${buildingId}`);
  });

  colorRow.appendChild(colorInput);
  colorRow.appendChild(resetBtn);
  panel.appendChild(colorRow);

  // Done button
  const doneBtn = document.createElement('button');
  doneBtn.className = 'btn-primary';
  doneBtn.style.cssText = 'padding:10px;font-size:14px;border-radius:10px;margin-top:4px;';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', () => overlay.remove());
  panel.appendChild(doneBtn);

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Select a building for rotation
export function selectBuildingForRotation(state: BuildingActionState, deps: BuildingDeps, buildingId: string): void {
  // Deselect previous building if any
  if (state.selectedBuildingId) {
    deselectBuilding(state, deps);
  }

  state.selectedBuildingId = buildingId;
  console.log(`🔄 Selected building ${buildingId} for rotation`);

  // Create rotation handle
  createRotationHandle(state, deps);

  // Add map event listeners to keep gizmo in sync with map movement
  addGizmoMapListeners(state, deps);
}

// Add map event listeners to update gizmo position on zoom/pan/rotate
export function addGizmoMapListeners(state: BuildingActionState, deps: BuildingDeps): void {
  const map = deps.mapManager.getMap();

  // Create a bound handler that we can remove later
  state.boundUpdateGizmoPosition = () => {
    updateRotationHandlePosition(state, deps);
    updateMoveHandlePosition(state, deps);
  };

  // Listen for map movements that require gizmo updates
  map.on('zoom', state.boundUpdateGizmoPosition);
  map.on('move', state.boundUpdateGizmoPosition);
  map.on('rotate', state.boundUpdateGizmoPosition);
}

// Remove map event listeners for gizmo
export function removeGizmoMapListeners(state: BuildingActionState, deps: BuildingDeps): void {
  if (!state.boundUpdateGizmoPosition) return;

  const map = deps.mapManager.getMap();
  map.off('zoom', state.boundUpdateGizmoPosition);
  map.off('move', state.boundUpdateGizmoPosition);
  map.off('rotate', state.boundUpdateGizmoPosition);

  state.boundUpdateGizmoPosition = null;
}

// Deselect building and remove all handles
export function deselectBuilding(state: BuildingActionState, deps: BuildingDeps): void {
  removeGizmoMapListeners(state, deps);
  state.selectedBuildingId = null;
  removeRotationHandle(state);
  // Remove delete handle
  const deleteEl = state._deleteHandleEl as HTMLElement | null;
  if (deleteEl) { deleteEl.remove(); state._deleteHandleEl = null; }
}

// Create the rotation handle UI (white circle above the building)
export function createRotationHandle(state: BuildingActionState, deps: BuildingDeps): void {
  removeRotationHandle(state);

  if (!state.selectedBuildingId || !deps.buildingManager) return;

  const building = deps.buildingManager.getBuildings().get(state.selectedBuildingId);
  if (!building) return;

  // Glow circle removed - building selection indicated by handles only
  state.buildingGlowEl = null;

  // Create line from center to rotation handle
  const line = document.createElement('div');
  line.id = 'rotation-line';
  line.style.cssText = `
    position: fixed;
    height: 2px;
    background: rgba(255, 255, 255, 0.8);
    transform-origin: left center;
    z-index: 999;
    pointer-events: none;
  `;
  document.body.appendChild(line);
  state.rotationLineEl = line;

  // Create rotation handle via shared pointer-capture utility
  let startAngle = 0, startRotation = 0;
  const { element: handle } = makeDragHandle(
    document.body,
    `position:fixed;width:28px;height:28px;cursor:grab;z-index:1000;` +
    `transform:translate(-50%,-50%);display:flex;align-items:center;` +
    `justify-content:center;font-size:20px;` +
    `filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));`,
    '🔄',
    {
      coordConverter: (e) => ({ x: e.clientX, y: e.clientY }),
      onStart: ({ x, y }) => {
        handle.style.cursor = 'grabbing';
        const b = deps.buildingManager?.getBuildings().get(state.selectedBuildingId!);
        if (b) {
          const sp = deps.mapManager.project({ lng: b.lng, lat: b.lat });
          startAngle    = Math.atan2(y - sp.y, x - sp.x);
          startRotation = b.rotation;
        }
      },
      onDrag: ({ x, y }) => {
        if (!state.selectedBuildingId) return;
        const b = deps.buildingManager?.getBuildings().get(state.selectedBuildingId);
        if (!b) return;
        const sp = deps.mapManager.project({ lng: b.lng, lat: b.lat });
        const angleDelta = Math.atan2(y - sp.y, x - sp.x) - startAngle;
        deps.buildingManager?.rotateBuilding(state.selectedBuildingId, startRotation + angleDelta);
        updateRotationHandlePosition(state, deps);
        updateMoveHandlePosition(state, deps);
      },
      onEnd: () => {
        handle.style.cursor = 'grab';
        if (state.selectedBuildingId) {
          const b = deps.buildingManager?.getBuildings().get(state.selectedBuildingId);
          if (b) {
            console.log(`🔄 Broadcasting rotation: ${b.rotation.toFixed(2)} rad (owner: ${b.ownerId})`);
            deps.network.rotateBuilding(state.selectedBuildingId, b.rotation);
            buildingsAPI.update(state.selectedBuildingId, { rotation: b.rotation })
              .then(success => { if (success) console.log(`💾 Rotation saved to database`); })
              .catch(() => {});
          }
        }
      },
    },
  );
  handle.id = 'rotation-handle';
  state.rotationHandleEl = handle;

  // Position all elements
  updateRotationHandlePosition(state, deps);

  // Create move handle (below the building)
  createMoveHandle(state, deps);
}

// Create the move handle UI (at center of building for dragging)
export function createMoveHandle(state: BuildingActionState, deps: BuildingDeps): void {
  removeMoveHandle(state);

  if (!state.selectedBuildingId || !deps.buildingManager) return;

  const building = deps.buildingManager.getBuildings().get(state.selectedBuildingId);
  if (!building) return;

  // Create move handle via shared pointer-capture utility
  let moveStartScreenPos: { x: number; y: number } | null = null;
  let buildingStartPos: { lng: number; lat: number } | null = null;
  const { element: moveHandle } = makeDragHandle(
    document.body,
    `position:fixed;width:44px;height:44px;border-radius:50%;` +
    `background:rgba(59,130,246,0.8);border:2px solid white;cursor:move;` +
    `z-index:1001;transform:translate(-50%,-60%);` +
    `box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;` +
    `justify-content:center;font-size:22px;padding-bottom:2px;`,
    '✥',
    {
      coordConverter: (e) => ({ x: e.clientX, y: e.clientY }),
      onStart: ({ x, y }) => {
        moveHandle.style.cursor = 'grabbing';
        const b = deps.buildingManager?.getBuildings().get(state.selectedBuildingId!);
        if (b) {
          moveStartScreenPos = { x, y };
          buildingStartPos   = { lng: b.lng, lat: b.lat };
        }
      },
      onDrag: ({ x, y }) => {
        if (!state.selectedBuildingId || !moveStartScreenPos || !buildingStartPos) return;
        const dx = x - moveStartScreenPos.x;
        const dy = y - moveStartScreenPos.y;
        const startScreen = deps.mapManager.project({ lng: buildingStartPos.lng, lat: buildingStartPos.lat });
        const newGeo = deps.mapManager.unproject({ x: startScreen.x + dx, y: startScreen.y + dy });
        deps.buildingManager?.moveBuilding(state.selectedBuildingId, newGeo.lng, newGeo.lat);
        updateRotationHandlePosition(state, deps);
        updateMoveHandlePosition(state, deps);
      },
      onEnd: () => {
        moveHandle.style.cursor = 'move';
        if (state.selectedBuildingId) {
          const b = deps.buildingManager?.getBuildings().get(state.selectedBuildingId);
          if (b) {
            console.log(`📍 Broadcasting move: ${b.lng.toFixed(5)}, ${b.lat.toFixed(5)} (owner: ${b.ownerId})`);
            deps.network.moveBuilding(state.selectedBuildingId, b.lng, b.lat);
            buildingsAPI.update(state.selectedBuildingId, { lng: b.lng, lat: b.lat })
              .then(success => { if (success) console.log(`💾 Position saved to database`); })
              .catch(() => {});
          }
        }
        moveStartScreenPos = null;
        buildingStartPos   = null;
      },
    },
  );
  moveHandle.id = 'move-handle';
  state.moveHandleEl = moveHandle;

  // Create delete button (to the right of move handle)
  const deleteHandle = document.createElement('div');
  deleteHandle.id = 'delete-handle';
  deleteHandle.style.cssText = `
    position:fixed;width:32px;height:32px;border-radius:50%;
    background:rgba(239,68,68,0.8);border:2px solid white;
    cursor:pointer;z-index:1001;transform:translate(-50%,-50%);
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;font-size:14px;
  `;
  deleteHandle.textContent = '🗑️';
  deleteHandle.title = 'Delete building';
  deleteHandle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.selectedBuildingId) return;
    const bld = deps.buildingManager?.getBuildings().get(state.selectedBuildingId);
    if (!bld) return;

    // Refund resources if owner
    const userId = authService.getUser()?.id || 'local';
    if (bld.ownerId === userId) {
      const def = BUILDING_DEFS[bld.type];
      if (def && def.cost) {
        for (const [res, amount] of Object.entries(def.cost)) {
          deps.inventory.add(res as any, amount as number);
        }
        const refundStr = Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(', ');
        if (refundStr) notificationSystem.show(`♻️ Refunded: ${refundStr}`, 'info');
      }
    }

    // Delete from everywhere
    const bid = state.selectedBuildingId;
    deps.buildingManager?.removeBuilding(bid);
    buildingsAPI.delete(bid).catch(() => {});
    deps.network.deleteBuilding(bid);
    try {
      const key = 'gallax_local_buildings';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(stored.filter((b: any) => b.id !== bid)));
    } catch {}

    notificationSystem.show(`🗑️ Building deleted`, 'info');
    deselectBuilding(state, deps);
  });
  document.body.appendChild(deleteHandle);
  state._deleteHandleEl = deleteHandle;

  // Position the move handle
  updateMoveHandlePosition(state, deps);
}

// Update the position of the move handle (below the building)
export function updateMoveHandlePosition(state: BuildingActionState, deps: BuildingDeps): void {
  if (!state.moveHandleEl || !state.selectedBuildingId || !deps.buildingManager) return;

  const building = deps.buildingManager.getBuildings().get(state.selectedBuildingId);
  if (!building) return;

  // Get building screen position - move handle is at center
  const screenPos = deps.mapManager.project({ lng: building.lng, lat: building.lat });

  state.moveHandleEl.style.left = `${screenPos.x}px`;
  state.moveHandleEl.style.top = `${screenPos.y}px`;

  // Position delete handle to the right of move handle
  const deleteEl = state._deleteHandleEl as HTMLElement | null;
  if (deleteEl) {
    deleteEl.style.left = `${screenPos.x + 40}px`;
    deleteEl.style.top = `${screenPos.y}px`;
  }
}

// Remove the move handle
export function removeMoveHandle(state: BuildingActionState): void {
  if (state.moveHandleEl) {
    state.moveHandleEl.remove();
    state.moveHandleEl = null;
  }
}

// Update the position of the rotation handle
export function updateRotationHandlePosition(state: BuildingActionState, deps: BuildingDeps): void {
  if (!state.rotationHandleEl || !state.selectedBuildingId || !deps.buildingManager) return;

  const building = deps.buildingManager.getBuildings().get(state.selectedBuildingId);
  if (!building) return;

  // Get building screen position
  const screenPos = deps.mapManager.project({ lng: building.lng, lat: building.lat });

  // Calculate handle position above the building (rotated)
  const zoom = deps.mapManager.getZoom();
  const scale = Math.pow(2, zoom - 16) * 1.5;
  const handleDistance = 50 * scale; // Distance from center to rotation handle

  // Account for map bearing when positioning handles
  const mapBearing = deps.mapManager.getBearing() * (Math.PI / 180);

  // Handle is above the building, rotated by building rotation minus map bearing
  const handleAngle = building.rotation - mapBearing - Math.PI / 2; // Start at top
  const handleX = screenPos.x + Math.cos(handleAngle) * handleDistance;
  const handleY = screenPos.y + Math.sin(handleAngle) * handleDistance;

  state.rotationHandleEl.style.left = `${handleX}px`;
  state.rotationHandleEl.style.top = `${handleY}px`;

  // Update glow position (centered on building)
  if (state.buildingGlowEl) {
    const glowSize = 60 * scale;
    state.buildingGlowEl.style.width = `${glowSize}px`;
    state.buildingGlowEl.style.height = `${glowSize}px`;
    state.buildingGlowEl.style.left = `${screenPos.x}px`;
    state.buildingGlowEl.style.top = `${screenPos.y}px`;
  }

  // Update line from center to rotation handle
  if (state.rotationLineEl) {
    const lineLength = Math.sqrt(
      Math.pow(handleX - screenPos.x, 2) + Math.pow(handleY - screenPos.y, 2)
    );
    const lineAngle = Math.atan2(handleY - screenPos.y, handleX - screenPos.x) * (180 / Math.PI);
    state.rotationLineEl.style.left = `${screenPos.x}px`;
    state.rotationLineEl.style.top = `${screenPos.y}px`;
    state.rotationLineEl.style.width = `${lineLength}px`;
    state.rotationLineEl.style.transform = `rotate(${lineAngle}deg)`;
  }
}

// Remove the rotation handle and related UI elements
export function removeRotationHandle(state: BuildingActionState): void {
  if (state.rotationHandleEl) {
    state.rotationHandleEl.remove();
    state.rotationHandleEl = null;
  }
  if (state.rotationLineEl) {
    state.rotationLineEl.remove();
    state.rotationLineEl = null;
  }
  if (state.buildingGlowEl) {
    state.buildingGlowEl.remove();
    state.buildingGlowEl = null;
  }
  removeMoveHandle(state);
}

// Handle building placement
export function handleBuildingPlacement(state: BuildingActionState, deps: BuildingDeps, lng: number, lat: number): void {
  const buildingType = deps.crafting.getSelectedBuilding();
  if (!buildingType) return;

  // Check if location is water
  if (deps.isWater(lng, lat)) {
    console.log('🌊 Cannot build on water!');
    showWaterBlockedFeedback(deps, lng, lat);
    return;
  }

  // Check one-per-player limit for my_home
  if (buildingType === 'my_home') {
    const existing = deps.buildingManager?.getBuildings();
    const userId = authService.getUser()?.id || 'local';
    if (existing) {
      for (const b of existing.values()) {
        if (b.type === 'my_home' && b.ownerId === userId) {
          notificationSystem.show('🏡 You already have a home!', 'info');
          return;
        }
      }
    }
    // Also check localStorage
    const localBuildings = JSON.parse(localStorage.getItem('gallax_local_buildings') || '[]');
    if (localBuildings.some((b: any) => b.type === 'my_home' && b.ownerId === userId)) {
      notificationSystem.show('🏡 You already have a home!', 'info');
      return;
    }
  }

  // Check if player can afford
  if (!deps.crafting.canCraft(buildingType)) {
    console.log('❌ Not enough resources!');
    return;
  }

  // Consume resources and place building
  if (deps.crafting.craft(buildingType)) {
    // Generate building ID
    const buildingId = `bld_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add building locally so it renders immediately
    console.log(`🏗️ Adding building locally: ${buildingId} type=${buildingType} at ${lng},${lat}`);
    console.log(`🏗️ BuildingManager exists: ${!!deps.buildingManager}`);
    if (deps.buildingManager) {
      deps.buildingManager.addBuilding({
        id: buildingId,
        type: buildingType,
        lng,
        lat,
        ownerId: authService.getUser()?.id || 'local',
        ownerName: deps.playerName || authService.getUser()?.name || 'Someone',
        rotation: 0,
      });
      console.log(`🏗️ Building added! Total buildings: ${deps.buildingManager.getBuildings().size}`);
    } else {
      console.error('🏗️ BuildingManager is null!');
    }

    // Broadcast to other players via geckos
    deps.network.placeBuilding(buildingType, lng, lat);
    const ownerId = authService.getUser()?.id || 'local';
    console.log(`🏗️ Placed ${BUILDING_DEFS[buildingType].emoji} ${BUILDING_DEFS[buildingType].name} by ${ownerId} at ${lng.toFixed(5)},${lat.toFixed(5)}`);

    // Award XP for placing building
    const progression = (window as any).progression;
    if (progression) {
      const result = progression.addXP(25);
      notificationSystem.showXP(25);
      if (result.leveledUp) {
        notificationSystem.showLevelUp(result.newLevel);
      }
      progression.incrementBuildingsPlaced();
    }

    // Always save to localStorage for offline/guest persistence
    const ownerNameStr = deps.playerName || authService.getUser()?.name || 'Someone';
    deps.saveBuildingToLocalStorage({ id: buildingId, type: buildingType, lng, lat, ownerId, ownerName: ownerNameStr, rotation: 0 });

    // Persist to D1 (works for both authenticated and guest users)
    buildingsAPI.create({ id: buildingId, type: buildingType, lng, lat, rotation: 0 })
      .then(success => {
        if (success) {
          console.log(`💾 Building saved to database`);
        }
      })
      .catch(() => {}); // Silently fail if server unavailable

    // Exit placement mode
    state.isPlacingBuilding = false;
    deps.crafting.selectBuilding(null);
    hidePlacementHint();
    deps.updateCraftingUI();
    deps.updateMapCursor();
  }
}

// Show feedback when trying to move to water
export function showWaterBlockedFeedback(deps: BuildingDeps, lng: number, lat: number): void {
  const pos = deps.mapManager.project({ lng, lat });
  const feedbackEl = document.createElement('div');
  feedbackEl.className = 'collect-feedback water-blocked';
  feedbackEl.textContent = '🚫 🌊';
  feedbackEl.style.left = `${pos.x}px`;
  feedbackEl.style.top = `${pos.y}px`;
  document.body.appendChild(feedbackEl);
  setTimeout(() => {
    feedbackEl.classList.add('fade-out');
    setTimeout(() => feedbackEl.remove(), 500);
  }, 100);
}

// Show floating emoji feedback when collecting
export function showCollectFeedback(deps: BuildingDeps, lng: number, lat: number, emoji: string): void {
  const pos = deps.mapManager.project({ lng, lat });

  // Create floating text
  const feedbackEl = document.createElement('div');
  feedbackEl.className = 'collect-feedback';
  feedbackEl.textContent = `+1 ${emoji}`;
  feedbackEl.style.left = `${pos.x}px`;
  feedbackEl.style.top = `${pos.y}px`;

  document.body.appendChild(feedbackEl);

  // Animate and remove
  setTimeout(() => {
    feedbackEl.classList.add('fade-out');
    setTimeout(() => feedbackEl.remove(), 500);
  }, 100);
}

// Show placement hint
export function showPlacementHint(emoji: string, name: string): void {
  let hint = document.getElementById('placement-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'placement-hint';
    hint.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: bold;
      z-index: 9999;
      pointer-events: none;
      animation: fadeIn 0.3s ease-out;
    `;
    document.body.appendChild(hint);
  }
  hint.innerHTML = `${emoji} Click on the map to place ${name}`;
}

// Hide placement hint
export function hidePlacementHint(): void {
  const hint = document.getElementById('placement-hint');
  if (hint) {
    hint.remove();
  }
}
