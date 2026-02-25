import { Application, Ticker } from 'pixi.js';
import { MapManager } from '../map/MapManager';
import { Player, TargetResource } from './Player';
import { InputManager } from './InputManager';
import { ResourceManager } from './Resources';
import { NPCManager } from './NPCManager';
import { WaterEntityManager } from './WaterEntityManager';
import { TerrainEntityManager } from './TerrainEntityManager';
import { Inventory, EMOJI_TO_RESOURCE, RESOURCE_INFO } from './Inventory';
import { GeckosNetworkManager as NetworkManager, ChatMessage } from '../network/GeckosNetworkManager';
import { OtherPlayersManager } from './OtherPlayersManager';
import { BuildingManager, BUILDING_DEFS } from './BuildingManager';
import { CraftingSystem } from './Crafting';
import { getPerformanceManager, PerformanceManager } from './PerformanceManager';

export class Game {
  private app: Application;
  private mapManager: MapManager;
  private player: Player | null = null;
  private inputManager: InputManager;
  private resourceManager: ResourceManager | null = null;
  private npcManager: NPCManager | null = null;
  private waterEntityManager: WaterEntityManager | null = null;
  private terrainEntityManager: TerrainEntityManager | null = null;
  private isRunning = false;
  private followingTrain: boolean = false;
  private inventory: Inventory;

  // Multiplayer
  private network: NetworkManager;
  private otherPlayers: OtherPlayersManager | null = null;
  private buildingManager: BuildingManager | null = null;
  private crafting: CraftingSystem;
  private collectedResourceIds: Set<string> = new Set(); // Track globally collected resources
  private playerSpriteNum: number;
  private isPlacingBuilding = false;
  private lastPositionSent = { lng: 0, lat: 0 };
  private positionSendThrottle = 50; // ms between position updates
  private lastPositionSendTime = 0;
  private playerName: string = '';
  private performanceManager: PerformanceManager;
  private entitiesVisible: boolean = true;

  // Client-side prediction tracking
  private currentInput = { x: 0, y: 0 };
  private currentDeltaTime = 0;

  // Chat
  private chatMessages: ChatMessage[] = [];
  private maxChatMessages = 50;

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
    this.app = new Application();
    this.inputManager = new InputManager();
    this.inventory = new Inventory();
    this.network = new NetworkManager();
    this.crafting = new CraftingSystem(this.inventory);
    this.performanceManager = getPerformanceManager();

    // Load saved sprite number from localStorage, or generate a random one
    const savedSpriteNum = localStorage.getItem('gallax_player_sprite');
    if (savedSpriteNum) {
      this.playerSpriteNum = parseInt(savedSpriteNum, 10);
    } else {
      this.playerSpriteNum = Math.floor(Math.random() * 125) + 1;
      localStorage.setItem('gallax_player_sprite', this.playerSpriteNum.toString());
    }

    // Name will be assigned by server on join
    this.playerName = '';
  }

  async init(): Promise<void> {
    // Initialize Pixi app
    await this.app.init({
      backgroundAlpha: 0,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    // Replace the placeholder canvas with Pixi's canvas
    const container = document.getElementById('game-container');
    const oldCanvas = document.getElementById('game-canvas');
    if (oldCanvas) {
      oldCanvas.remove();
    }

    // Style and add Pixi canvas
    this.app.canvas.id = 'game-canvas';
    this.app.canvas.style.position = 'absolute';
    this.app.canvas.style.top = '0';
    this.app.canvas.style.left = '0';
    this.app.canvas.style.pointerEvents = 'none';
    container?.appendChild(this.app.canvas);

    console.log('Pixi app initialized, canvas added');

    // Create player at map center with saved sprite
    const center = this.mapManager.getCenter();
    this.player = new Player(this.mapManager, center.lng, center.lat);
    await this.player.init(this.app, this.playerSpriteNum);

    // Initialize resource manager
    this.resourceManager = new ResourceManager(this.mapManager, this.app);

    // Initialize NPC manager
    this.npcManager = new NPCManager(this.mapManager, this.app);
    await this.npcManager.loadTextures();

    // Initialize water entity manager (fish and boats)
    this.waterEntityManager = new WaterEntityManager(this.mapManager, this.app);

    // Initialize terrain entity manager (all terrain-based entities)
    this.terrainEntityManager = new TerrainEntityManager(this.mapManager, this.app);

    // Initialize multiplayer managers
    this.otherPlayers = new OtherPlayersManager(this.mapManager, this.app);
    this.buildingManager = new BuildingManager(this.mapManager, this.app);

    // Wait for map to load style, then spawn everything
    this.mapManager.onLoad(() => {
      console.log('Map loaded, spawning all entities...');
      this.resourceManager?.spawnTreesInView();
      this.npcManager?.spawnNPCsInView();
      this.waterEntityManager?.spawnEntitiesInView();
      this.terrainEntityManager?.spawnEntitiesInView();
    });

    // Sync sprites when map moves/zooms
    this.mapManager.on('onRender', () => {
      this.player?.updatePosition();
      this.resourceManager?.updateAllPositions();
      this.npcManager?.updateAllPositions();
      this.waterEntityManager?.updateAllPositions();
      this.terrainEntityManager?.updateAllPositions();
      this.otherPlayers?.updateAllPositions();
      this.buildingManager?.updateAllPositions();
    });

    // Respawn entities when moving to new areas (performance-aware)
    this.mapManager.on('onMove', () => {
      const zoom = this.mapManager.getZoom();

      // Always cull distant entities for memory
      this.resourceManager?.cullDistantResources();
      this.npcManager?.cullDistantNPCs();
      this.waterEntityManager?.cullDistantEntities();
      this.terrainEntityManager?.cullDistantEntities();

      // Only spawn new entities when zoomed in enough
      if (this.performanceManager.shouldSpawnEntities(zoom)) {
        this.resourceManager?.spawnTreesInView();
        this.npcManager?.spawnNPCsInView();
        this.waterEntityManager?.spawnEntitiesInView();
        this.terrainEntityManager?.spawnEntitiesInView();
      }
    });

    // Update UI
    this.updateUI();
    this.mapManager.on('onMove', () => this.updateUI());
    this.mapManager.on('onZoom', () => this.updateUI());

    // Setup follow train button
    this.setupFollowTrainButton();

    // Setup tap-to-collect and click-to-move on map
    this.setupMapClickHandler();

    // Setup inventory UI
    this.createInventoryUI();
    this.inventory.onChange(() => this.updateInventoryUI());

    // Setup crafting UI
    this.createCraftingUI();
    this.inventory.onChange(() => this.updateCraftingUI());

    // Setup name input UI
    this.createNameInputUI();

    // Setup chat UI
    this.createChatUI();

    // Setup mobile UI (toggle buttons, fullscreen, etc.)
    this.createMobileUI();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
      this.mapManager.resize();
    });

    // Connect to multiplayer server
    await this.connectToServer();

    // Expose debug functions on window for testing
    this.exposeDebugFunctions();

    // Start game loop
    this.start();
  }

  // Expose functions on window for testing with Chrome DevTools
  private exposeDebugFunctions(): void {
    const win = window as any;

    // Add resources directly to inventory
    win.addResource = (type: string, amount: number = 10) => {
      for (let i = 0; i < amount; i++) {
        this.inventory.add(type as any);
      }
      console.log(`✅ Added ${amount} ${type}`);
      return this.inventory.getAll();
    };

    // Get current inventory
    win.getInventory = () => {
      const inv: Record<string, number> = {};
      this.inventory.getAll().forEach((v, k) => inv[k] = v);
      return inv;
    };

    // Place a building at player's current location
    win.placeBuilding = (type: string) => {
      if (!this.player) return 'No player';
      const pos = this.player.getPosition();
      if (this.crafting.canCraft(type)) {
        this.crafting.craft(type);
        this.network.placeBuilding(type, pos.lng, pos.lat);
        return `✅ Placed ${type} at ${pos.lng.toFixed(5)}, ${pos.lat.toFixed(5)}`;
      }
      return `❌ Cannot afford ${type}`;
    };

    // Get all buildings
    win.getBuildings = () => {
      const buildings: any[] = [];
      this.buildingManager?.getBuildings().forEach((b, id) => {
        buildings.push({ id, type: b.type, lng: b.lng, lat: b.lat, ownerId: b.ownerId });
      });
      return buildings;
    };

    // Get player position
    win.getPlayerPosition = () => {
      if (!this.player) return null;
      return this.player.getPosition();
    };

    // Get other players
    win.getOtherPlayers = () => {
      const players: any[] = [];
      // Access through network manager's state
      return `Players connected - check server logs`;
    };

    // Get collected resources
    win.getCollectedResources = () => {
      return Array.from(this.collectedResourceIds);
    };

    // Check network connection
    win.isConnected = () => {
      return this.network.isConnected();
    };

    console.log('🔧 Debug functions exposed on window:');
    console.log('  - addResource(type, amount) - Add resources to inventory');
    console.log('  - getInventory() - Get current inventory');
    console.log('  - placeBuilding(type) - Place a building at player location');
    console.log('  - getBuildings() - Get all placed buildings');
    console.log('  - getPlayerPosition() - Get player position');
    console.log('  - getCollectedResources() - Get IDs of collected resources');
    console.log('  - isConnected() - Check if connected to server');
  }

  private start(): void {
    this.isRunning = true;
    this.app.ticker.add((ticker: Ticker) => {
      if (!this.isRunning) return;
      this.update(ticker.deltaTime);
    });
  }

  private update(deltaTime: number): void {
    // Get input direction
    const input = this.inputManager.getDirection();

    // Update player (always runs)
    if (this.player) {
      // Track current input for client-side prediction
      this.currentInput = { x: input.x, y: input.y };
      this.currentDeltaTime = deltaTime;

      this.player.setVelocity(input.x, input.y);
      this.player.update(deltaTime);

      // Send position updates to server (throttled) with input data for prediction
      this.sendPositionUpdate();
    }

    // Update other players (always runs for smooth multiplayer)
    this.otherPlayers?.update(deltaTime);

    // Performance: Check zoom level for entity updates
    const zoom = this.mapManager.getZoom();
    const shouldShowEntities = this.performanceManager.shouldShowEntities(zoom);
    const shouldUpdateMovement = this.performanceManager.shouldUpdateMovement(zoom);

    // Toggle entity visibility based on zoom
    this.updateEntityVisibility(shouldShowEntities);

    // Only update entity movement when zoomed in enough and throttled
    if (shouldUpdateMovement && this.performanceManager.shouldUpdate()) {
      // Update NPCs
      this.npcManager?.update(deltaTime);

      // Update water entities (fish and boats)
      this.waterEntityManager?.update(deltaTime);

      // Update terrain entities (trains, etc.)
      this.terrainEntityManager?.update(deltaTime);
    }

    // Follow train if enabled
    this.followTrain();
  }

  // Show/hide entities based on zoom level for performance
  private updateEntityVisibility(shouldShow: boolean): void {
    if (shouldShow === this.entitiesVisible) return;

    this.entitiesVisible = shouldShow;

    // Toggle visibility of all entity containers
    this.npcManager?.setVisible(shouldShow);
    this.waterEntityManager?.setVisible(shouldShow);
    this.terrainEntityManager?.setVisible(shouldShow);
    this.resourceManager?.setVisible(shouldShow);

    console.log(`📊 Entities ${shouldShow ? 'shown' : 'hidden'} (zoom: ${this.mapManager.getZoom().toFixed(1)})`);
  }

  // Send position update to server (throttled) with input data for client-side prediction
  private sendPositionUpdate(): void {
    if (!this.player || !this.network.isConnected()) return;

    const now = Date.now();
    if (now - this.lastPositionSendTime < this.positionSendThrottle) return;

    const pos = this.player.getPosition();

    // Only send if position changed significantly
    const dx = pos.lng - this.lastPositionSent.lng;
    const dy = pos.lat - this.lastPositionSent.lat;
    const moved = Math.sqrt(dx * dx + dy * dy) > 0.000001;

    if (moved) {
      // Include input data for client-side prediction tracking
      this.network.move(
        pos.lng,
        pos.lat,
        this.currentInput.x,
        this.currentInput.y,
        this.currentDeltaTime
      );
      this.lastPositionSent = { lng: pos.lng, lat: pos.lat };
      this.lastPositionSendTime = now;
    }
  }

  private updateUI(): void {
    const coordsEl = document.getElementById('coords');
    const zoomEl = document.getElementById('zoom-level');

    if (this.player && coordsEl) {
      const pos = this.player.getPosition();
      coordsEl.textContent = `📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    }

    if (zoomEl) {
      zoomEl.textContent = `🔍 Zoom: ${this.mapManager.getZoom().toFixed(1)}`;
    }
  }

  private setupFollowTrainButton(): void {
    const btn = document.getElementById('follow-train-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (this.followingTrain) {
        // Stop following
        this.followingTrain = false;
        btn.textContent = '🚂 Follow Train';
        btn.classList.remove('following');
      } else {
        // Start following a train
        const train = this.terrainEntityManager?.getRandomTrain();
        if (train) {
          this.followingTrain = true;
          btn.textContent = '⏹️ Stop Following';
          btn.classList.add('following');
          // Pan to the train
          this.mapManager.getMap().flyTo({
            center: [train.lng, train.lat],
            zoom: 16,
            duration: 1000
          });
        } else {
          btn.textContent = '🚂 No trains found!';
          setTimeout(() => {
            btn.textContent = '🚂 Follow Train';
          }, 2000);
        }
      }
    });
  }

  // Called each frame to follow train
  private followTrain(): void {
    if (!this.followingTrain || !this.terrainEntityManager) return;

    const train = this.terrainEntityManager.getRandomTrain();
    if (train) {
      this.mapManager.getMap().panTo([train.lng, train.lat], { duration: 100 });
    }
  }

  // Check if a location is water
  private isWater(lng: number, lat: number): boolean {
    const map = this.mapManager.getMap();
    const point = map.project([lng, lat]);

    // Query water layers at this point
    const features = map.queryRenderedFeatures(point, {
      layers: ['water', 'waterway']
    });

    return features.length > 0;
  }

  // Setup click handler for: resource collection, click-to-move, building placement
  private setupMapClickHandler(): void {
    const map = this.mapManager.getMap();

    map.on('click', (e) => {
      const clickLng = e.lngLat.lng;
      const clickLat = e.lngLat.lat;
      const screenX = e.point.x;
      const screenY = e.point.y;

      // If placing a building, handle building placement
      if (this.isPlacingBuilding && this.crafting.getSelectedBuilding()) {
        this.handleBuildingPlacement(clickLng, clickLat);
        return;
      }

      // Check if clicked on a resource
      const resource = this.findResourceAtPoint(screenX, screenY, clickLng, clickLat);

      if (resource && this.player) {
        // Check if resource was already collected by someone else - silently skip
        if (this.collectedResourceIds.has(resource.id)) {
          return;
        }

        console.log(`🎯 Target set: ${resource.emoji} at (${resource.lng.toFixed(5)}, ${resource.lat.toFixed(5)})`);

        // Set player target with callback for when they arrive
        this.player.setTarget(resource, (target) => {
          this.collectResource(target);
        });
      } else if (this.player) {
        // Click-to-move: check if destination is water
        if (this.isWater(clickLng, clickLat)) {
          console.log('🌊 Cannot move to water!');
          this.showWaterBlockedFeedback(clickLng, clickLat);
          return;
        }

        // Move to clicked location
        console.log(`🚶 Moving to (${clickLng.toFixed(5)}, ${clickLat.toFixed(5)})`);
        this.player.setTarget(
          { id: 'move', lng: clickLng, lat: clickLat, emoji: '', type: 'terrain' },
          () => {} // No callback needed for movement
        );
      }
    });
  }

  // Show feedback when trying to move to water
  private showWaterBlockedFeedback(lng: number, lat: number): void {
    const pos = this.mapManager.project({ lng, lat });
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

  // Handle building placement
  private handleBuildingPlacement(lng: number, lat: number): void {
    const buildingType = this.crafting.getSelectedBuilding();
    if (!buildingType) return;

    // Check if location is water
    if (this.isWater(lng, lat)) {
      console.log('🌊 Cannot build on water!');
      this.showWaterBlockedFeedback(lng, lat);
      return;
    }

    // Check if player can afford
    if (!this.crafting.canCraft(buildingType)) {
      console.log('❌ Not enough resources!');
      return;
    }

    // Consume resources and place building
    if (this.crafting.craft(buildingType)) {
      this.network.placeBuilding(buildingType, lng, lat);
      console.log(`🏗️ Placed ${BUILDING_DEFS[buildingType].emoji} ${BUILDING_DEFS[buildingType].name}!`);

      // Exit placement mode
      this.isPlacingBuilding = false;
      this.crafting.selectBuilding(null);
      this.updateCraftingUI();
    }
  }

  // Find a collectible resource at the given world position
  private findResourceAtPoint(_screenX: number, _screenY: number, lng: number, lat: number): TargetResource | null {
    const hitRadius = 0.0003; // ~30m hit radius in degrees

    // Check trees from ResourceManager
    if (this.resourceManager) {
      const trees = this.resourceManager.getResources();
      for (const [id, resource] of trees) {
        const dx = resource.lng - lng;
        const dy = resource.lat - lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hitRadius) {
          return {
            id,
            lng: resource.lng,
            lat: resource.lat,
            emoji: resource.emoji,
            type: 'tree'
          };
        }
      }
    }

    // Check water entities (fish, etc.)
    if (this.waterEntityManager) {
      const entities = this.waterEntityManager.getEntities();
      for (const [id, entity] of entities) {
        const dx = entity.lng - lng;
        const dy = entity.lat - lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hitRadius) {
          return {
            id,
            lng: entity.lng,
            lat: entity.lat,
            emoji: entity.emoji,
            type: 'water'
          };
        }
      }
    }

    // Check terrain entities (excluding trains/vehicles)
    if (this.terrainEntityManager) {
      const entities = this.terrainEntityManager.getCollectibleEntities();
      for (const [id, entity] of entities) {
        const dx = entity.lng - lng;
        const dy = entity.lat - lat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hitRadius) {
          return {
            id,
            lng: entity.lng,
            lat: entity.lat,
            emoji: entity.emoji,
            type: 'terrain'
          };
        }
      }
    }

    return null;
  }

  // Collect a resource when player reaches it
  private collectResource(target: TargetResource): void {
    // Skip if already collected (from server sync) - silently
    if (this.collectedResourceIds.has(target.id)) {
      return;
    }

    const resourceType = EMOJI_TO_RESOURCE[target.emoji];

    if (resourceType) {
      this.inventory.add(resourceType);
      console.log(`✨ Collected ${RESOURCE_INFO[resourceType].emoji} ${RESOURCE_INFO[resourceType].name}!`);

      // Show floating text feedback
      this.showCollectFeedback(target.lng, target.lat, RESOURCE_INFO[resourceType].emoji);
    }

    // Notify server of collection
    this.network.collectResource(target.id);
    this.collectedResourceIds.add(target.id);

    // Remove the resource from its manager
    this.removeResourceLocally(target.id, target.type);
  }

  // Remove a resource locally (from any manager)
  private removeResourceLocally(id: string, type: string): void {
    if (type === 'tree' && this.resourceManager) {
      this.resourceManager.removeResource(id);
    } else if (type === 'water' && this.waterEntityManager) {
      this.waterEntityManager.removeEntity(id);
    } else if (type === 'terrain' && this.terrainEntityManager) {
      this.terrainEntityManager.removeEntity(id);
    }
  }

  // Remove resource by ID (called from server sync)
  private removeResourceById(resourceId: string): void {
    // Try to remove from any manager
    this.resourceManager?.removeResource(resourceId);
    this.waterEntityManager?.removeEntity(resourceId);
    this.terrainEntityManager?.removeEntity(resourceId);
  }

  // Show floating emoji feedback when collecting
  private showCollectFeedback(lng: number, lat: number, emoji: string): void {
    const pos = this.mapManager.project({ lng, lat });

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

  // Create inventory hotbar UI
  private createInventoryUI(): void {
    const hotbar = document.createElement('div');
    hotbar.id = 'inventory-hotbar';
    hotbar.innerHTML = `
      <div class="hotbar-item" data-type="wood">
        <span class="item-emoji">🪵</span>
        <span class="item-count">0</span>
      </div>
      <div class="hotbar-item" data-type="stone">
        <span class="item-emoji">🪨</span>
        <span class="item-count">0</span>
      </div>
      <div class="hotbar-item" data-type="fish">
        <span class="item-emoji">🐟</span>
        <span class="item-count">0</span>
      </div>
      <div class="hotbar-item" data-type="gem">
        <span class="item-emoji">💎</span>
        <span class="item-count">0</span>
      </div>
      <div class="hotbar-item" data-type="shell">
        <span class="item-emoji">🐚</span>
        <span class="item-count">0</span>
      </div>
      <div class="hotbar-item" data-type="herb">
        <span class="item-emoji">🌿</span>
        <span class="item-count">0</span>
      </div>
    `;
    document.body.appendChild(hotbar);
  }

  // Update inventory UI when items change
  private updateInventoryUI(): void {
    const items = this.inventory.getAll();

    for (const [type, count] of items) {
      const itemEl = document.querySelector(`#inventory-hotbar .hotbar-item[data-type="${type}"] .item-count`);
      if (itemEl) {
        itemEl.textContent = count.toString();

        // Add pulse animation when count changes
        const parent = itemEl.parentElement;
        if (parent && count > 0) {
          parent.classList.add('has-items');
          parent.classList.add('pulse');
          setTimeout(() => parent.classList.remove('pulse'), 300);
        }
      }
    }
  }

  // Connect to multiplayer server
  private async connectToServer(): Promise<void> {
    try {
      await this.network.connect({
        onInit: (playerId, players, collectedResources, buildings) => {
          console.log(`🎮 Received init as player ${playerId}`);
          console.log(`👥 ${players.length} players online:`, players.map(p => `${p.name}(${p.id})`));
          console.log(`🌲 ${collectedResources.length} resources already collected`);
          console.log(`🏠 ${buildings.length} buildings placed`);

          // Track already collected resources
          collectedResources.forEach(id => this.collectedResourceIds.add(id));

          // Get the server-assigned name for this player
          const myPlayer = players.find(p => p.id === playerId);
          if (myPlayer) {
            this.playerName = myPlayer.name;
            this.player?.setName(this.playerName);
            console.log(`📛 Server assigned name: "${this.playerName}"`);
          }

          // Add other players
          const otherPlayerList = players.filter(p => p.id !== playerId);
          console.log(`👥 Adding ${otherPlayerList.length} other players...`);
          otherPlayerList.forEach(p => {
            console.log(`  → Adding player ${p.name} (${p.id}) sprite=${p.spriteNum} at ${p.lng.toFixed(4)}, ${p.lat.toFixed(4)}`);
            this.otherPlayers?.addPlayer(p);
          });

          // Add buildings
          buildings.forEach(b => this.buildingManager?.addBuilding(b));
        },
        onPlayerJoined: (player) => {
          console.log(`👋 Player ${player.name} joined with sprite=${player.spriteNum}`);
          this.otherPlayers?.addPlayer(player);
        },
        onPlayerLeft: (playerId) => {
          console.log(`👋 Player ${playerId} left`);
          this.otherPlayers?.removePlayer(playerId);
        },
        onPlayerMoved: (playerId, lng, lat) => {
          this.otherPlayers?.movePlayer(playerId, lng, lat);
        },
        onPlayerNameChanged: (playerId, name) => {
          console.log(`📛 Player ${playerId} changed name to "${name}"`);
          this.otherPlayers?.updatePlayerName(playerId, name);
        },
        onResourceCollected: (resourceId, playerId) => {
          console.log(`🌲 Resource ${resourceId} collected by ${playerId}`);
          this.collectedResourceIds.add(resourceId);
          this.removeResourceById(resourceId);
        },
        onBuildingPlaced: (building) => {
          console.log(`🏠 Building ${building.type} placed by ${building.ownerId}`);
          this.buildingManager?.addBuilding(building);
        },
        onChatMessage: (message) => {
          this.addChatMessage(message);
        },
        onPositionCorrection: (lng, lat, inputsToReapply) => {
          // Server position differs from our prediction - reconcile
          if (this.player) {
            // Snap to server position
            this.player.setPosition(lng, lat);

            // Re-apply all unprocessed inputs to get back to current state
            for (const input of inputsToReapply) {
              this.player.applyInput(input.inputX, input.inputY, input.deltaTime);
            }

            console.log(`🔄 Reconciled: snapped to server, re-applied ${inputsToReapply.length} inputs`);
          }
        },
      });

      // Send join message - server will assign a unique name
      const pos = this.player?.getPosition();
      if (pos) {
        console.log(`📤 Sending join message with sprite: ${this.playerSpriteNum}`);
        this.network.join(pos.lng, pos.lat, this.playerSpriteNum);
      }
    } catch (error) {
      console.error('Failed to connect to server:', error);
    }
  }

  // Create name input UI - empty input, type to change your server-assigned name
  private createNameInputUI(): void {
    const nameContainer = document.createElement('div');
    nameContainer.id = 'name-input-container';
    nameContainer.innerHTML = `
      <input type="text" id="player-name-input" placeholder="Change name..." maxlength="20" value="">
      <button id="set-name-btn">Set</button>
    `;
    document.body.appendChild(nameContainer);

    const input = document.getElementById('player-name-input') as HTMLInputElement;
    const btn = document.getElementById('set-name-btn') as HTMLButtonElement;

    const setName = () => {
      const name = input.value.trim();
      if (name) {
        console.log(`📛 Changing player name to "${name}"`);
        this.playerName = name;
        this.player?.setName(name);
        this.network.setName(name);
        console.log(`📛 Name change sent to server`);
        input.value = ''; // Clear input after setting
        input.blur();
      }
    };

    btn.addEventListener('click', setName);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') setName();
    });
  }

  // Create chat UI
  private createChatUI(): void {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';
    chatContainer.innerHTML = `
      <div id="chat-messages"></div>
      <div id="chat-input-row">
        <input type="text" id="chat-input" placeholder="Press Enter to chat..." maxlength="200">
        <button id="chat-send-btn">Send</button>
      </div>
    `;
    document.body.appendChild(chatContainer);

    const input = document.getElementById('chat-input') as HTMLInputElement;
    const btn = document.getElementById('chat-send-btn') as HTMLButtonElement;

    const sendMessage = () => {
      const message = input.value.trim();
      if (message) {
        this.network.sendChat(message);
        input.value = '';
      }
    };

    btn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    // Focus chat input when pressing Enter (if not already focused on desktop)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement !== input && !this.isMobile()) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // Check if on mobile (touch device)
  private isMobile(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  // Create mobile UI buttons
  private createMobileUI(): void {
    if (!this.isMobile()) return;

    const container = document.getElementById('mobile-ui-buttons');
    if (!container) return;

    // Hotbar toggle button
    const btnHotbar = document.createElement('button');
    btnHotbar.id = 'btn-hotbar';
    btnHotbar.className = 'mobile-toggle-btn';
    btnHotbar.innerHTML = '🎒';
    btnHotbar.title = 'Toggle Inventory';
    container.appendChild(btnHotbar);

    btnHotbar.addEventListener('click', () => {
      const hotbar = document.getElementById('inventory-hotbar');
      if (hotbar) {
        hotbar.classList.toggle('visible');
        btnHotbar.classList.toggle('active', hotbar.classList.contains('visible'));
      }
    });

    // Crafting toggle button
    const btnCrafting = document.createElement('button');
    btnCrafting.id = 'btn-crafting';
    btnCrafting.className = 'mobile-toggle-btn';
    btnCrafting.innerHTML = '🔨';
    btnCrafting.title = 'Toggle Crafting';
    container.appendChild(btnCrafting);

    btnCrafting.addEventListener('click', () => {
      const craftMenu = document.getElementById('crafting-menu');
      if (craftMenu) {
        craftMenu.classList.toggle('visible');
        btnCrafting.classList.toggle('active', craftMenu.classList.contains('visible'));
      }
    });

    // Name change button (uses browser prompt)
    const btnName = document.createElement('button');
    btnName.id = 'btn-name';
    btnName.className = 'mobile-toggle-btn';
    btnName.innerHTML = '✏️';
    btnName.title = 'Change Name';
    container.appendChild(btnName);

    btnName.addEventListener('click', () => {
      const newName = prompt('Enter your name:', this.playerName || '');
      if (newName && newName.trim()) {
        const name = newName.trim().substring(0, 20);
        console.log(`📛 Changing player name to "${name}"`);
        this.playerName = name;
        this.player?.setName(name);
        this.network.setName(name);
      }
    });

    // Fullscreen toggle button (top right)
    const btnFullscreen = document.createElement('button');
    btnFullscreen.id = 'btn-fullscreen';
    btnFullscreen.className = 'mobile-toggle-btn';
    btnFullscreen.innerHTML = '⛶';
    btnFullscreen.title = 'Toggle Fullscreen';
    container.appendChild(btnFullscreen);

    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('Fullscreen error:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });

    // Chat toggle button (bottom right)
    const btnChat = document.createElement('button');
    btnChat.id = 'btn-chat';
    btnChat.className = 'mobile-toggle-btn';
    btnChat.innerHTML = '💬';
    btnChat.title = 'Toggle Chat';
    container.appendChild(btnChat);

    const chatContainer = document.getElementById('chat-container');
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;

    btnChat.addEventListener('click', () => {
      if (chatContainer) {
        chatContainer.classList.toggle('expanded');
        btnChat.classList.toggle('active', chatContainer.classList.contains('expanded'));
        // Focus input when opening chat
        if (chatContainer.classList.contains('expanded') && chatInput) {
          chatInput.focus();
        }
      }
    });

    // Update coords display without emojis on mobile
    this.updateCoordsDisplay();
  }

  // Update coords/zoom display (no emojis on mobile)
  private updateCoordsDisplay(): void {
    const coordsEl = document.getElementById('coords');
    const zoomEl = document.getElementById('zoom-level');
    if (!coordsEl || !zoomEl) return;

    const updateCoords = () => {
      const pos = this.player?.getPosition();
      const zoom = this.mapManager.getMap().getZoom();
      if (pos) {
        if (this.isMobile()) {
          coordsEl.textContent = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
          zoomEl.textContent = `Zoom: ${zoom.toFixed(1)}`;
        } else {
          coordsEl.textContent = `📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
          zoomEl.textContent = `🔍 Zoom: ${zoom.toFixed(1)}`;
        }
      }
    };

    // Initial update
    updateCoords();

    // Update on map move
    this.mapManager.getMap().on('move', updateCoords);
  }

  // Add a chat message to the UI
  private addChatMessage(message: ChatMessage): void {
    this.chatMessages.push(message);

    // Trim old messages
    while (this.chatMessages.length > this.maxChatMessages) {
      this.chatMessages.shift();
    }

    this.updateChatUI();
  }

  // Update chat messages display
  private updateChatUI(): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const myPlayerId = this.network.getPlayerId();

    messagesContainer.innerHTML = this.chatMessages.map(msg => {
      const isMe = msg.playerId === myPlayerId;
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-message ${isMe ? 'my-message' : ''}">
        <span class="chat-time">${time}</span>
        <span class="chat-name">${msg.playerName}:</span>
        <span class="chat-text">${this.escapeHtml(msg.message)}</span>
      </div>`;
    }).join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Escape HTML to prevent XSS
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Create crafting UI
  private createCraftingUI(): void {
    const craftMenu = document.createElement('div');
    craftMenu.id = 'crafting-menu';
    craftMenu.innerHTML = `
      <div class="crafting-header">🔨 Craft</div>
      <div class="crafting-items"></div>
    `;
    document.body.appendChild(craftMenu);
    this.updateCraftingUI();
  }

  // Update crafting UI
  private updateCraftingUI(): void {
    const container = document.querySelector('#crafting-menu .crafting-items');
    if (!container) return;

    const buildings = this.crafting.getAvailableBuildings();
    container.innerHTML = buildings.map(({ type, def, canCraft }) => `
      <button class="craft-btn ${canCraft ? 'can-craft' : 'cannot-craft'} ${this.crafting.getSelectedBuilding() === type ? 'selected' : ''}" data-type="${type}">
        <span class="craft-emoji">${def.emoji}</span>
        <span class="craft-name">${def.name}</span>
        <span class="craft-cost">${Object.entries(def.cost).map(([r, a]) => `${a}${this.getResourceEmoji(r)}`).join(' ')}</span>
      </button>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.craft-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (type && this.crafting.canCraft(type)) {
          if (this.crafting.getSelectedBuilding() === type) {
            // Deselect
            this.crafting.selectBuilding(null);
            this.isPlacingBuilding = false;
          } else {
            // Select for placement
            this.crafting.selectBuilding(type);
            this.isPlacingBuilding = true;
          }
          this.updateCraftingUI();
        }
      });
    });
  }

  // Helper to get emoji for resource type
  private getResourceEmoji(resource: string): string {
    const emojis: Record<string, string> = {
      wood: '🪵', stone: '🪨', fish: '🐟', gem: '💎', shell: '🐚', herb: '🌿'
    };
    return emojis[resource] || '?';
  }

  stop(): void {
    this.isRunning = false;
    this.network.disconnect();
  }
}

