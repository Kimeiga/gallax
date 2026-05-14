/**
 * HomeInterior - A pure HTML/CSS/DOM interior scene for player homes.
 * When a player enters a home building, the map is hidden and this
 * full-screen overlay renders a walkable room with furniture placement.
 */
import 'emoji-picker-element';
import { makeDragHandle } from './utils/gizmoHandle';

interface FurnitureItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  placedBy: string;
  scale?: number;    // default 1
  rotation?: number; // radians, default 0
}

export interface HomeNetworkCallbacks {
  onFurniturePlaced: (homeId: string, item: { id: string; emoji: string; x: number; y: number }) => void;
  onFurnitureDeleted: (homeId: string, furnitureId: string) => void;
  onFurnitureMoved: (homeId: string, furnitureId: string, x: number, y: number, rotation?: number, scale?: number) => void;
}

export class HomeInterior {
  // State
  private active = false;
  private homeId: string | null = null;
  private ownerName: string = '';
  private spriteNum: number = 1;
  private isOwner: boolean = false;
  private exitCallbacks: (() => void)[] = [];

  // Multiplayer room presence
  private otherPlayers: Map<string, { el: HTMLElement; name: string }> = new Map();

  // Room dimensions (logical pixels)
  private readonly ROOM_W = 800;
  private readonly ROOM_H = 600;

  // Player state (pixel coords within room)
  private playerX = 400;
  private playerY = 300;
  private playerTargetX = 400;
  private playerTargetY = 300;
  private playerMoving = false;
  private readonly PLAYER_SPEED = 4; // px per frame
  private playerFacingLeft = false;

  // Furniture
  private furniture: FurnitureItem[] = [];
  private placingEmoji: string | null = null;
  private draggingFurniture: FurnitureItem | null = null;
  private dragOffset = { x: 0, y: 0 };

  // DOM elements
  private container: HTMLDivElement | null = null;
  private roomEl: HTMLDivElement | null = null;
  private playerEl: HTMLImageElement | null = null;
  private headerEl: HTMLDivElement | null = null;
  private furnitureLayer: HTMLDivElement | null = null;
  private buildMenuEl: HTMLDivElement | null = null;
  private placingIndicator: HTMLDivElement | null = null;
  private playerNameTagEl: HTMLDivElement | null = null;

  // Animation
  private animFrameId: number | null = null;

  // Network callbacks
  private networkCallbacks: HomeNetworkCallbacks | null = null;

  constructor() {}

  setNetworkCallbacks(callbacks: HomeNetworkCallbacks): void {
    this.networkCallbacks = callbacks;
  }

  // ── Public API ──────────────────────────────────────────────────

  enter(homeId: string, ownerName: string, playerSpriteNum: number, isOwner: boolean): void {
    if (this.active) return;

    this.homeId = homeId;
    this.ownerName = ownerName;
    this.spriteNum = playerSpriteNum;
    this.isOwner = isOwner;
    this.active = true;

    // Reset player to center
    this.playerX = this.ROOM_W / 2;
    this.playerY = this.ROOM_H / 2;
    this.playerTargetX = this.playerX;
    this.playerTargetY = this.playerY;
    this.playerMoving = false;
    this.placingEmoji = null;
    this.draggingFurniture = null;

    // Hide the game map
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = 'none';

    this.loadFurniture();
    this.createDOM();
    this.startLoop();
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;

    // Clean up immediately
    this.destroyDOM();
    // Show the map again
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = '';
    // Clear other players
    this.otherPlayers.clear();
    this.exitCallbacks.forEach(cb => cb());

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.homeId = null;
  }

  isInside(): boolean {
    return this.active;
  }

  getCurrentHomeId(): string | null {
    return this.homeId;
  }

  onExit(callback: () => void): void {
    this.exitCallbacks.push(callback);
  }

  // Network sync methods (called by Game.ts when other players modify furniture)
  addFurnitureFromNetwork(item: { id: string; emoji: string; x: number; y: number }): void {
    if (!this.active) return;
    if (!this.furniture.find(f => f.id === item.id)) {
      this.furniture.push({ ...item, placedBy: 'network' });
      this.renderFurniture();
    }
  }

  removeFurnitureFromNetwork(furnitureId: string): void {
    if (!this.active) return;
    this.furniture = this.furniture.filter(f => f.id !== furnitureId);
    this.renderFurniture();
  }

  moveFurnitureFromNetwork(furnitureId: string, x: number, y: number, rotation?: number, scale?: number): void {
    if (!this.active) return;
    const item = this.furniture.find(f => f.id === furnitureId);
    if (item) {
      item.x = x;
      item.y = y;
      if (rotation !== undefined) item.rotation = rotation;
      if (scale !== undefined) item.scale = scale;
      this.renderFurniture();
    }
  }

  // Called when the local player renames themselves while already inside the home
  updateLocalPlayerName(name: string): void {
    this.ownerName = name;
    if (this.playerNameTagEl) this.playerNameTagEl.textContent = name;
    if (this.isOwner && this.headerEl) this.headerEl.textContent = `${name}'s Home`;
  }

  // Other player entered the home
  addOtherPlayer(playerId: string, spriteNum: number, playerName: string): void {
    if (!this.active || !this.roomEl) return;
    if (this.otherPlayers.has(playerId)) return;

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;pointer-events:none;z-index:3;display:flex;flex-direction:column;align-items:center;transition:left 0.15s,top 0.15s;';

    // Name tag
    const nameTag = document.createElement('div');
    nameTag.style.cssText = 'font-size:12px;font-weight:bold;color:white;white-space:nowrap;margin-bottom:2px;-webkit-text-stroke:1px black;paint-order:stroke fill;';
    nameTag.textContent = playerName;
    container.appendChild(nameTag);

    // Sprite
    const sprite = document.createElement('img');
    sprite.src = `/sprites/${spriteNum}.png`;
    sprite.draggable = false;
    sprite.style.cssText = 'width:auto;height:40px;image-rendering:pixelated;';
    container.appendChild(sprite);

    // Start at center
    const cx = (this as any).ROOM_W / 2;
    const cy = (this as any).ROOM_H / 2;
    container.style.left = `${cx - 20}px`;
    container.style.top = `${cy - 50}px`;

    this.roomEl.appendChild(container);
    this.otherPlayers.set(playerId, { el: container, name: playerName });
  }

  // Other player left the home
  removeOtherPlayer(playerId: string): void {
    const p = this.otherPlayers.get(playerId);
    if (p) {
      p.el.remove();
      this.otherPlayers.delete(playerId);
    }
  }

  // Other player renamed themselves while inside the home
  updateOtherPlayerName(playerId: string, name: string): void {
    const p = this.otherPlayers.get(playerId);
    if (p) {
      p.name = name;
      const nameTagEl = p.el.firstElementChild as HTMLElement | null;
      if (nameTagEl) nameTagEl.textContent = name;
    }
  }

  // Other player moved inside the home
  moveOtherPlayer(playerId: string, x: number, y: number): void {
    const p = this.otherPlayers.get(playerId);
    if (p) {
      p.el.style.left = `${x - 20}px`;
      p.el.style.top = `${y - 50}px`;
    }
  }

  // Get player's current position (for broadcasting)
  getPlayerPosition(): { x: number; y: number } {
    return { x: this.playerX, y: this.playerY };
  }

  // ── DOM Creation ───────────────────────────────────────────────

  private createDOM(): void {
    // Main overlay container
    this.container = document.createElement('div');
    this.container.id = 'home-interior';
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '600',
      background: 'rgba(10, 10, 18, 0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: '1',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      overflow: 'hidden',
    } as Partial<CSSStyleDeclaration>);

    // Header
    this.headerEl = document.createElement('div');
    Object.assign(this.headerEl.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      padding: '16px 20px',
      background: 'rgba(30, 30, 40, 0.55)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: '#fff',
      fontSize: '18px',
      fontWeight: '700',
      textAlign: 'center',
      zIndex: '10',
      letterSpacing: '0.3px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    } as Partial<CSSStyleDeclaration>);
    this.headerEl.textContent = `${this.ownerName}'s Home`;
    this.container.appendChild(this.headerEl);

    // Room wrapper (handles scaling on small screens)
    const roomWrapper = document.createElement('div');
    Object.assign(roomWrapper.style, {
      position: 'relative',
      transformOrigin: 'center center',
      flexShrink: '0',
    } as Partial<CSSStyleDeclaration>);
    this.applyRoomScale(roomWrapper);
    this.container.appendChild(roomWrapper);

    // Room element
    this.roomEl = document.createElement('div');
    Object.assign(this.roomEl.style, {
      position: 'absolute',
      inset: '0',
      width: `${this.ROOM_W}px`,
      height: `${this.ROOM_H}px`,
      background: '#f8f8fa',
      borderRadius: '12px',
      border: '3px solid #bbb',
      boxShadow: 'inset 0 0 60px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      transformOrigin: 'top left',
    } as Partial<CSSStyleDeclaration>);

    // Floor grid pattern
    const floor = document.createElement('div');
    Object.assign(floor.style, {
      position: 'absolute',
      inset: '0',
      backgroundImage:
        'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), ' +
        'linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    this.roomEl.appendChild(floor);

    // Wall trim (top strip)
    const wallTrim = document.createElement('div');
    Object.assign(wallTrim.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      height: '8px',
      background: 'linear-gradient(180deg, #999, #bbb)',
      borderRadius: '9px 9px 0 0',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    this.roomEl.appendChild(wallTrim);

    // Furniture layer
    this.furnitureLayer = document.createElement('div');
    Object.assign(this.furnitureLayer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    this.roomEl.appendChild(this.furnitureLayer);

    // Render existing furniture
    this.renderFurniture();

    // Door
    const door = document.createElement('div');
    Object.assign(door.style, {
      position: 'absolute',
      bottom: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '40px',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '4px 8px',
      zIndex: '5',
      animation: 'home-door-pulse 2s ease-in-out infinite',
      filter: 'drop-shadow(0 0 6px rgba(255, 180, 50, 0.6))',
    } as Partial<CSSStyleDeclaration>);
    door.textContent = '\u{1F6AA}';
    door.title = 'Exit home';
    door.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.exit();
    });
    this.roomEl.appendChild(door);

    // Player sprite
    // Player sprite container (sprite + name tag)
    const playerContainer = document.createElement('div');
    playerContainer.style.cssText = 'position:absolute;pointer-events:none;z-index:4;display:flex;flex-direction:column;align-items:center;';

    // Name tag above sprite
    const nameTag = document.createElement('div');
    nameTag.style.cssText = 'font-size:14px;font-weight:bold;color:white;white-space:nowrap;margin-bottom:2px;-webkit-text-stroke:1.5px black;paint-order:stroke fill;';
    nameTag.textContent = this.ownerName || 'Player';
    this.playerNameTagEl = nameTag;
    playerContainer.appendChild(nameTag);

    this.playerEl = document.createElement('img');
    this.playerEl.src = `/sprites/${this.spriteNum}.png`;
    this.playerEl.draggable = false;
    Object.assign(this.playerEl.style, {
      width: 'auto',
      height: '48px',
      imageRendering: 'pixelated',
      transition: 'none',
      transformOrigin: 'center bottom',
    } as Partial<CSSStyleDeclaration>);
    playerContainer.appendChild(this.playerEl);
    this.roomEl.appendChild(playerContainer);

    // Store ref for position updates
    (this as any)._playerContainer = playerContainer;

    // Placing indicator (shows when in placement mode)
    this.placingIndicator = document.createElement('div');
    Object.assign(this.placingIndicator.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      padding: '6px',
      background: 'rgba(50, 200, 100, 0.9)',
      color: '#fff',
      textAlign: 'center',
      fontSize: '13px',
      fontWeight: '600',
      zIndex: '6',
      display: 'none',
      borderRadius: '9px 9px 0 0',
    } as Partial<CSSStyleDeclaration>);
    this.placingIndicator.textContent = 'Tap in the room to place furniture. Tap here to cancel.';
    this.placingIndicator.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.cancelPlacement();
    });
    this.roomEl.appendChild(this.placingIndicator);

    roomWrapper.appendChild(this.roomEl);

    // Room click handler (for movement and placement)
    this.roomEl.addEventListener('pointerdown', (e) => this.onRoomPointerDown(e));
    this.roomEl.addEventListener('pointermove', (e) => this.onRoomPointerMove(e));
    this.roomEl.addEventListener('pointerup', (e) => this.onRoomPointerUp(e));

    // Build menu (owner only)
    if (this.isOwner) {
      this.createBuildMenu();
    }

    // Inject keyframe animation
    this.injectStyles();

    document.body.appendChild(this.container);

    // Container is immediately visible (opacity:1 set in createDOM)

    // Resize handler
    window.addEventListener('resize', this.handleResize);
  }

  private applyRoomScale(wrapper: HTMLElement): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight - 80;
    const scaleX = (vw - 20) / this.ROOM_W;
    const scaleY = (vh - 20) / this.ROOM_H;
    const scale = Math.min(scaleX, scaleY, 1);

    // Set the unscaled dimensions then apply CSS transform scale
    wrapper.style.width = `${this.ROOM_W}px`;
    wrapper.style.height = `${this.ROOM_H}px`;
    wrapper.style.transform = `scale(${scale})`;

    // CRITICAL: Use negative margin to collapse the visual space to the scaled size
    // This prevents the parent flexbox from allocating space for the unscaled 800x600
    const scaledW = this.ROOM_W * scale;
    const scaledH = this.ROOM_H * scale;
    wrapper.style.marginLeft = `${-(this.ROOM_W - scaledW) / 2}px`;
    wrapper.style.marginRight = `${-(this.ROOM_W - scaledW) / 2}px`;
    wrapper.style.marginTop = `${-(this.ROOM_H - scaledH) / 2}px`;
    wrapper.style.marginBottom = `${-(this.ROOM_H - scaledH) / 2}px`;
  }

  private handleResize = (): void => {
    const wrapper = this.roomEl?.parentElement;
    if (wrapper) this.applyRoomScale(wrapper);
  };

  private createBuildMenu(): void {
    this.buildMenuEl = document.createElement('div');
    Object.assign(this.buildMenuEl.style, {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      zIndex: '610',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-start',
    } as Partial<CSSStyleDeclaration>);

    // Add furniture button
    const addBtn = document.createElement('button');
    Object.assign(addBtn.style, {
      padding: '10px 16px',
      borderRadius: '10px',
      border: 'none',
      background: 'rgba(30, 30, 40, 0.55)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    } as Partial<CSSStyleDeclaration>);
    addBtn.innerHTML = '<span style="font-size:18px">\u{1F3E0}</span> Add Furniture';
    addBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.showEmojiInput();
    });
    this.buildMenuEl.appendChild(addBtn);

    this.container!.appendChild(this.buildMenuEl);
  }

  private showEmojiInput(): void {
    // Remove any existing picker
    const existing = document.getElementById('home-emoji-picker-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'home-emoji-picker-container';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9999',
      maxWidth: '350px',
      width: '90%',
    } as Partial<CSSStyleDeclaration>);

    // Quick-pick emoji grid (works immediately, no async loading)
    const quickGrid = document.createElement('div');
    quickGrid.style.cssText = 'background:rgba(30,30,40,0.9);border-radius:12px;padding:12px;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-bottom:4px;max-height:250px;overflow-y:auto;';

    const quickEmojis = [
      '🛋️','🛏️','🪑','🪞','📺','🖼️','🕯️','💡','📚','🎵','🌿','🪴',
      '🧸','🎮','🎸','🎹','🎨','🏆','⭐','❤️','🔥','💎','🌈','☀️',
      '🍕','🍔','☕','🍰','🎂','🍷','🍺','🧃','🍎','🌸','🌺','🌻',
      '🐱','🐶','🐟','🦋','🐦','🦊','🐻','🐼','🦁','🐸','🐰','🐙',
      '⚽','🏀','🎾','🎯','🎲','♟️','🎪','🎭','🎬','📷','🔮','🪄',
      '🚀','✈️','🚗','🚲','⛵','🏠','🏰','⛩️','🗽','🌍','🗺️','🧭',
    ];

    for (const emoji of quickEmojis) {
      const btn = document.createElement('button');
      btn.style.cssText = 'width:36px;height:36px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;';
      btn.textContent = emoji;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.startPlacement(emoji);
        container.remove();
      });
      quickGrid.appendChild(btn);
    }

    // Also add a text input for any emoji
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';
    const emojiInput = document.createElement('input');
    emojiInput.type = 'text';
    emojiInput.placeholder = 'Type any emoji...';
    emojiInput.style.cssText = 'flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:white;font-size:18px;text-align:center;outline:none;';
    const placeBtn = document.createElement('button');
    placeBtn.textContent = 'Place';
    placeBtn.className = 'btn-primary';
    placeBtn.style.cssText = 'padding:8px 14px;border-radius:8px;font-size:13px;';
    placeBtn.addEventListener('click', () => {
      const emoji = emojiInput.value.trim();
      if (emoji) { this.startPlacement(emoji); container.remove(); }
    });
    emojiInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { const emoji = emojiInput.value.trim(); if (emoji) { this.startPlacement(emoji); container.remove(); } }
    });
    inputRow.appendChild(emojiInput);
    inputRow.appendChild(placeBtn);

    container.appendChild(inputRow);
    container.appendChild(quickGrid);

    // Cancel button below picker
    const cancelBtn = document.createElement('button');
    Object.assign(cancelBtn.style, {
      width: '100%',
      padding: '10px',
      marginTop: '4px',
      borderRadius: '0 0 12px 12px',
      border: 'none',
      background: 'rgba(30,30,40,0.85)',
      color: 'rgba(255,255,255,0.6)',
      fontSize: '13px',
      cursor: 'pointer',
    } as Partial<CSSStyleDeclaration>);
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => container.remove());
    container.appendChild(cancelBtn);

    document.body.appendChild(container);
  }

  private startPlacement(emoji: string): void {
    this.placingEmoji = emoji;
    if (this.placingIndicator) {
      this.placingIndicator.style.display = 'block';
      this.placingIndicator.textContent = `Tap in the room to place ${emoji}. Tap here to cancel.`;
    }
  }

  private cancelPlacement(): void {
    this.placingEmoji = null;
    if (this.placingIndicator) {
      this.placingIndicator.style.display = 'none';
    }
  }

  // ── Room Interaction ───────────────────────────────────────────

  private pointerDownTime = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private isDragging = false;

  // Gizmo state
  private selectedFurniture: FurnitureItem | null = null;
  private gizmoRotateHandle: HTMLElement | null = null;
  private gizmoScaleHandle: HTMLElement | null = null;
  private gizmoLine: HTMLElement | null = null;

  private getRoomCoords(e: PointerEvent): { x: number; y: number } | null {
    if (!this.roomEl) return null;
    const rect = this.roomEl.getBoundingClientRect();
    const scaleX = this.ROOM_W / rect.width;
    const scaleY = this.ROOM_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    if (x < 0 || x > this.ROOM_W || y < 0 || y > this.ROOM_H) return null;
    return { x, y };
  }

  private onRoomPointerDown(e: PointerEvent): void {
    const coords = this.getRoomCoords(e);
    if (!coords) return;

    this.pointerDownTime = Date.now();
    this.pointerDownPos = { x: coords.x, y: coords.y };
    this.isDragging = false;

    // Check if tapping on furniture (for dragging/selection, owner only)
    if (this.isOwner && !this.placingEmoji) {
      const hit = this.hitTestFurniture(coords.x, coords.y);
      if (hit) {
        this.selectedFurniture = hit;
        this.draggingFurniture = hit;
        this.dragOffset = { x: coords.x - hit.x, y: coords.y - hit.y };
        this.isDragging = true;
        this.showFurnitureSelection(hit);
        e.preventDefault();
        return;
      } else {
        this.hideFurnitureSelection();
        this.selectedFurniture = null;
      }
    }
  }

  private onRoomPointerMove(e: PointerEvent): void {
    if (!this.draggingFurniture || !this.isDragging) return;
    const coords = this.getRoomCoords(e);
    if (!coords) return;

    const dx = coords.x - this.pointerDownPos.x;
    const dy = coords.y - this.pointerDownPos.y;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    this.draggingFurniture.x = this.clamp(coords.x - this.dragOffset.x, 20, this.ROOM_W - 20);
    this.draggingFurniture.y = this.clamp(coords.y - this.dragOffset.y, 20, this.ROOM_H - 20);
    this.renderFurniture();
    this.updateGizmo(this.draggingFurniture);
    e.preventDefault();
  }

  private onRoomPointerUp(e: PointerEvent): void {
    const coords = this.getRoomCoords(e);

    // If was dragging furniture, finish drag
    if (this.draggingFurniture && this.isDragging) {
      const dx = (coords?.x ?? 0) - this.pointerDownPos.x;
      const dy = (coords?.y ?? 0) - this.pointerDownPos.y;
      const wasDrag = Math.abs(dx) > 5 || Math.abs(dy) > 5;

      if (wasDrag) {
        this.saveFurniture();
        this.persistToServer();
        if (this.homeId && this.networkCallbacks && this.draggingFurniture) {
          const f = this.draggingFurniture;
          this.networkCallbacks.onFurnitureMoved(this.homeId, f.id, f.x, f.y, f.rotation, f.scale);
        }
      }
      this.draggingFurniture = null;
      this.isDragging = false;
      return; // keep selectedFurniture + gizmo alive
    }

    this.draggingFurniture = null;
    this.isDragging = false;

    if (!coords) return;

    // If in placement mode, place furniture
    if (this.placingEmoji && this.isOwner) {
      const item: FurnitureItem = {
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        emoji: this.placingEmoji,
        x: coords.x,
        y: coords.y,
        placedBy: this.ownerName,
      };
      this.furniture.push(item);
      this.renderFurniture();
      this.saveFurniture();
      this.persistToServer();
      if (this.homeId && this.networkCallbacks) {
        this.networkCallbacks.onFurniturePlaced(this.homeId, { id: item.id, emoji: item.emoji, x: item.x, y: item.y });
      }
      this.cancelPlacement();
      return;
    }

    // Otherwise, move player
    this.playerTargetX = this.clamp(coords.x, 16, this.ROOM_W - 16);
    this.playerTargetY = this.clamp(coords.y, 16, this.ROOM_H - 16);
    this.playerMoving = true;
  }

  private hitTestFurniture(x: number, y: number): FurnitureItem | null {
    const HIT_RADIUS = 24;
    // Test in reverse order (top items first)
    for (let i = this.furniture.length - 1; i >= 0; i--) {
      const f = this.furniture[i];
      if (Math.abs(x - f.x) < HIT_RADIUS && Math.abs(y - f.y) < HIT_RADIUS) {
        return f;
      }
    }
    return null;
  }

  // ── Rendering ──────────────────────────────────────────────────

  private renderFurniture(): void {
    if (!this.furnitureLayer) return;

    // Clear existing furniture elements
    this.furnitureLayer.innerHTML = '';

    for (const item of this.furniture) {
      const el = document.createElement('span');
      const scale = item.scale ?? 1;
      const rotation = item.rotation ?? 0;
      Object.assign(el.style, {
        position: 'absolute',
        left: `${item.x}px`,
        top: `${item.y}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}rad) scale(${scale})`,
        fontSize: '28px',
        lineHeight: '1',
        pointerEvents: 'auto',
        cursor: this.isOwner ? 'grab' : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: `${Math.floor(item.y)}`,
      } as Partial<CSSStyleDeclaration>);
      el.textContent = item.emoji;
      el.title = this.isOwner ? 'Drag to move, double-tap to remove' : item.emoji;

      // Double-tap to remove (owner only)
      if (this.isOwner) {
        let lastTap = 0;
        el.addEventListener('pointerdown', (e) => {
          const now = Date.now();
          if (now - lastTap < 350) {
            // Double tap - remove
            e.stopPropagation();
            this.furniture = this.furniture.filter(f => f.id !== item.id);
            this.renderFurniture();
            this.saveFurniture();
            this.deleteFromServer(item.id);
            if (this.homeId && this.networkCallbacks) {
              this.networkCallbacks.onFurnitureDeleted(this.homeId, item.id);
            }
          }
          lastTap = now;
        });
      }

      this.furnitureLayer.appendChild(el);
    }
  }

  private updatePlayer(): void {
    if (!this.playerEl) return;

    if (this.playerMoving) {
      const dx = this.playerTargetX - this.playerX;
      const dy = this.playerTargetY - this.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.PLAYER_SPEED) {
        this.playerX = this.playerTargetX;
        this.playerY = this.playerTargetY;
        this.playerMoving = false;
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        // Ease: slow down when close
        const speed = dist < 30 ? this.PLAYER_SPEED * (0.4 + 0.6 * (dist / 30)) : this.PLAYER_SPEED;
        this.playerX += nx * speed;
        this.playerY += ny * speed;

        // Flip sprite based on direction
        if (Math.abs(dx) > 1) {
          this.playerFacingLeft = dx < 0;
        }
      }
    }

    // Constrain to room
    this.playerX = this.clamp(this.playerX, 16, this.ROOM_W - 16);
    this.playerY = this.clamp(this.playerY, 16, this.ROOM_H - 16);

    const scaleX = this.playerFacingLeft ? -1 : 1;
    const pc = (this as any)._playerContainer as HTMLElement;
    if (pc) {
      pc.style.left = `${this.playerX - 24}px`;
      pc.style.top = `${this.playerY - 60}px`;
    }
    this.playerEl.style.transform = `scaleX(${scaleX})`;
  }

  // ── Game Loop ──────────────────────────────────────────────────

  private startLoop(): void {
    const loop = () => {
      if (!this.active) return;
      this.updatePlayer();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  // ── Auth helpers ──────────────────────────────────────────────

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const guestId = localStorage.getItem('gallax_guest_id');
    if (guestId) {
      headers['X-Guest-ID'] = guestId;
    }
    return headers;
  }

  // ── Persistence ────────────────────────────────────────────────

  private loadFurniture(): void {
    if (!this.homeId) return;

    // Load from localStorage first for instant display
    try {
      const stored = localStorage.getItem(`gallax_home_furniture_${this.homeId}`);
      if (stored) {
        this.furniture = JSON.parse(stored);
      } else {
        this.furniture = [];
      }
    } catch {
      this.furniture = [];
    }

    // Then fetch from server and merge (server is source of truth)
    this.loadFromServer();
  }

  private saveFurniture(): void {
    if (!this.homeId) return;
    try {
      localStorage.setItem(
        `gallax_home_furniture_${this.homeId}`,
        JSON.stringify(this.furniture)
      );
    } catch {
      // localStorage full or unavailable
    }
  }

  private async loadFromServer(): Promise<void> {
    if (!this.homeId) return;
    try {
      const res = await fetch(
        `/api/home-furniture?homeId=${encodeURIComponent(this.homeId)}`,
        { headers: this.getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json() as { furniture: FurnitureItem[] };
        if (Array.isArray(data.furniture) && data.furniture.length > 0) {
          // Server data wins - merge: use server items, add any local-only items
          const serverIds = new Set(data.furniture.map((f: FurnitureItem) => f.id));
          const localOnly = this.furniture.filter(f => !serverIds.has(f.id));
          this.furniture = [...data.furniture, ...localOnly];
          this.saveFurniture(); // sync merged result to localStorage
          this.renderFurniture();

          // If there were local-only items, push them to server too
          if (localOnly.length > 0) {
            this.persistToServer();
          }
        } else if (data.furniture && data.furniture.length === 0 && this.furniture.length > 0) {
          // Server is empty but we have local data - push local to server
          this.persistToServer();
        }
      }
    } catch {
      // Server unavailable, use local data
    }
  }

  private async persistToServer(): Promise<void> {
    if (!this.homeId) return;
    try {
      await fetch('/api/home-furniture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          homeId: this.homeId,
          furniture: this.furniture,
        }),
      });
    } catch {
      // Silent fail, localStorage has the data
    }
  }

  private async deleteFromServer(furnitureId: string): Promise<void> {
    if (!this.homeId) return;
    try {
      await fetch('/api/home-furniture', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          homeId: this.homeId,
          furnitureId,
        }),
      });
    } catch {
      // Silent fail
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  private destroyDOM(): void {
    window.removeEventListener('resize', this.handleResize);

    if (this.container && this.container.parentElement) {
      this.container.remove();
    }
    this.container = null;
    this.roomEl = null;
    this.playerEl = null;
    this.headerEl = null;
    this.furnitureLayer = null;
    this.buildMenuEl = null;
    this.placingIndicator = null;
    this.playerNameTagEl = null;
  }

  private injectStyles(): void {
    if (document.getElementById('home-interior-styles')) return;

    const style = document.createElement('style');
    style.id = 'home-interior-styles';
    style.textContent = `
      @keyframes home-door-pulse {
        0%, 100% {
          filter: drop-shadow(0 0 4px rgba(255, 180, 50, 0.4));
          transform: translateX(-50%) scale(1);
        }
        50% {
          filter: drop-shadow(0 0 10px rgba(255, 180, 50, 0.8));
          transform: translateX(-50%) scale(1.08);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Utility ────────────────────────────────────────────────────

  private selectionEl: HTMLElement | null = null;

  /** Unclamped screen→room conversion (for gizmo handles that can go outside room bounds). */
  private screenToRoom(e: PointerEvent): { x: number; y: number } {
    if (!this.roomEl) return { x: 0, y: 0 };
    const rect = this.roomEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.ROOM_W / rect.width),
      y: (e.clientY - rect.top)  * (this.ROOM_H / rect.height),
    };
  }

  private broadcastFurnitureTransform(f: FurnitureItem): void {
    this.saveFurniture();
    this.persistToServer();
    if (this.homeId && this.networkCallbacks) {
      this.networkCallbacks.onFurnitureMoved(this.homeId, f.id, f.x, f.y, f.rotation, f.scale);
    }
  }

  private showFurnitureSelection(f: FurnitureItem): void {
    this.hideFurnitureSelection();
    if (!this.roomEl) return;

    const s = f.scale ?? 1;
    const r = f.rotation ?? 0;
    const boxSize = Math.max(44, 56 * s);
    const half = boxSize / 2;
    const ROTATE_GAP = 46;

    // ── Selection box ──
    const sel = document.createElement('div');
    sel.id = 'furniture-selection';
    sel.style.cssText = `
      position: absolute;
      left: ${f.x - half}px; top: ${f.y - half}px;
      width: ${boxSize}px; height: ${boxSize}px;
      border: 2px dashed rgba(59, 130, 246, 0.85);
      border-radius: 8px; background: rgba(59, 130, 246, 0.07);
      pointer-events: none; z-index: 10;
      transform-origin: center center; transform: rotate(${r}rad);
    `;
    this.roomEl.appendChild(sel);
    this.selectionEl = sel;

    // ── Line from box-top to rotation handle ──
    const line = document.createElement('div');
    line.style.cssText = `
      position: absolute; left: ${f.x - 1}px; top: ${f.y - half - ROTATE_GAP}px;
      width: 2px; height: ${ROTATE_GAP}px;
      background: rgba(59, 130, 246, 0.55); pointer-events: none; z-index: 10;
    `;
    this.roomEl.appendChild(line);
    this.gizmoLine = line;

    // ── Rotation handle ──
    let startAngle = 0, startRotation = 0;
    const { element: rotEl } = makeDragHandle(
      this.roomEl,
      `position:absolute; left:${f.x - 14}px; top:${f.y - half - ROTATE_GAP - 14}px;
       width:28px; height:28px; display:flex; align-items:center; justify-content:center;
       font-size:18px; cursor:grab; z-index:11;
       filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45));`,
      '🔄',
      {
        coordConverter: (e) => this.screenToRoom(e),
        onStart: ({ x, y }) => {
          if (!this.selectedFurniture) return;
          startAngle    = Math.atan2(y - this.selectedFurniture.y, x - this.selectedFurniture.x);
          startRotation = this.selectedFurniture.rotation ?? 0;
          rotEl.style.cursor = 'grabbing';
        },
        onDrag: ({ x, y }) => {
          if (!this.selectedFurniture) return;
          const angle = Math.atan2(y - this.selectedFurniture.y, x - this.selectedFurniture.x);
          this.selectedFurniture.rotation = startRotation + (angle - startAngle);
          this.renderFurniture();
          this.updateGizmo(this.selectedFurniture);
        },
        onEnd: () => {
          rotEl.style.cursor = 'grab';
          if (this.selectedFurniture) this.broadcastFurnitureTransform(this.selectedFurniture);
        },
      },
    );
    rotEl.title = 'Drag to rotate';
    this.gizmoRotateHandle = rotEl;

    // ── Scale handle ──
    let startDist = 1, startScale = 1;
    const scaleOff = half + 8;
    const { element: scaleEl } = makeDragHandle(
      this.roomEl,
      `position:absolute; left:${f.x + scaleOff - 13}px; top:${f.y + scaleOff - 13}px;
       width:26px; height:26px; display:flex; align-items:center; justify-content:center;
       font-size:13px; font-weight:bold; color:white;
       background:rgba(59,130,246,0.9); border-radius:50%;
       cursor:nwse-resize; z-index:11; box-shadow:0 1px 4px rgba(0,0,0,0.35);`,
      '⤡',
      {
        coordConverter: (e) => this.screenToRoom(e),
        onStart: ({ x, y }) => {
          if (!this.selectedFurniture) return;
          const dx = x - this.selectedFurniture.x, dy = y - this.selectedFurniture.y;
          startDist  = Math.sqrt(dx * dx + dy * dy) || 1;
          startScale = this.selectedFurniture.scale ?? 1;
        },
        onDrag: ({ x, y }) => {
          if (!this.selectedFurniture) return;
          const dx = x - this.selectedFurniture.x, dy = y - this.selectedFurniture.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          this.selectedFurniture.scale = Math.max(0.3, Math.min(3, startScale * (dist / startDist)));
          this.renderFurniture();
          this.updateGizmo(this.selectedFurniture);
        },
        onEnd: () => {
          if (this.selectedFurniture) this.broadcastFurnitureTransform(this.selectedFurniture);
        },
      },
    );
    scaleEl.title = 'Drag to resize';
    this.gizmoScaleHandle = scaleEl;
  }

  private updateGizmo(f: FurnitureItem): void {
    const s = f.scale ?? 1;
    const r = f.rotation ?? 0;
    const boxSize = Math.max(44, 56 * s);
    const half = boxSize / 2;
    const ROTATE_GAP = 46;

    if (this.selectionEl) {
      this.selectionEl.style.left = `${f.x - half}px`;
      this.selectionEl.style.top = `${f.y - half}px`;
      this.selectionEl.style.width = `${boxSize}px`;
      this.selectionEl.style.height = `${boxSize}px`;
      this.selectionEl.style.transform = `rotate(${r}rad)`;
    }
    if (this.gizmoLine) {
      this.gizmoLine.style.left = `${f.x - 1}px`;
      this.gizmoLine.style.top = `${f.y - half - ROTATE_GAP}px`;
      this.gizmoLine.style.height = `${ROTATE_GAP}px`;
    }
    if (this.gizmoRotateHandle) {
      this.gizmoRotateHandle.style.left = `${f.x - 14}px`;
      this.gizmoRotateHandle.style.top = `${f.y - half - ROTATE_GAP - 14}px`;
    }
    if (this.gizmoScaleHandle) {
      const scaleOff = half + 8;
      this.gizmoScaleHandle.style.left = `${f.x + scaleOff - 13}px`;
      this.gizmoScaleHandle.style.top = `${f.y + scaleOff - 13}px`;
    }
  }

  private hideFurnitureSelection(): void {
    this.selectionEl?.remove();   this.selectionEl = null;
    this.gizmoLine?.remove();     this.gizmoLine = null;
    this.gizmoRotateHandle?.remove(); this.gizmoRotateHandle = null;
    this.gizmoScaleHandle?.remove();  this.gizmoScaleHandle = null;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
