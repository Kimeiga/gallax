import { Application, Ticker } from 'pixi.js';
import { MapManager } from '../map/MapManager';
import { Player, TargetResource } from './Player';
import { InputManager } from './InputManager';
import { ResourceManager } from './Resources';
import { NPCManager, NPC } from './NPCManager';
import { WaterEntityManager } from './WaterEntityManager';
import { TerrainEntityManager } from './TerrainEntityManager';
import { Inventory, EMOJI_TO_RESOURCE, RESOURCE_INFO } from './Inventory';
import { GeckosNetworkManager as NetworkManager, ChatMessage } from '../network/GeckosNetworkManager';
import { OtherPlayersManager } from './OtherPlayersManager';
import { BuildingManager, BUILDING_DEFS } from './BuildingManager';
import { CraftingSystem } from './Crafting';
import { getPerformanceManager, PerformanceManager } from './PerformanceManager';
import { authService } from '../auth/AuthService';
import { buildingsAPI } from '../api/BuildingsAPI';
import { PublicSpacesManager } from './PublicSpacesManager';
import { notificationSystem } from './NotificationSystem';
import { DialogueUI } from './DialogueUI';
import { NPCMissionSystem } from './NPCMissionSystem';
import { getRandomConversation, getMissionConversation } from './DialogueSystem';
import { EmojiDiscoverySystem } from './EmojiDiscoverySystem';
import { MobManager, Mob } from './MobManager';
import { PixelCanvas } from './PixelCanvas';
import { PixelDrawUI } from './PixelDrawUI';
import { PixelDrawingManager } from './modules/PixelDrawingManager';
import { TerritorySystem } from './TerritorySystem';
import { TerritoryManager } from './modules/TerritoryManager';
import { HomeInterior } from './HomeInterior';
import { LifeMissionSystem } from './LifeMissions';
import { CombatSystem, CombatMob } from './CombatSystem';
import { CombatUI } from './CombatUI';
import { WeaponSystem } from './WeaponSystem';
import { AdminTools } from './modules/AdminTools';
import { StationTeleporter } from './modules/StationTeleporter';
import { ChatManager } from './modules/ChatSystem';
import { CraftingUIManager, CraftingUICallbacks } from './modules/CraftingUI';
import {
  BuildingActionState, BuildingDeps,
  showBuildingActions, showHomeStylePicker, selectBuildingForRotation,
  handleBuildingPlacement, showWaterBlockedFeedback, showCollectFeedback,
  showPlacementHint, hidePlacementHint, deselectBuilding,
  updateRotationHandlePosition, updateMoveHandlePosition,
} from './modules/BuildingActions';

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
  private publicSpacesManager: PublicSpacesManager | null = null;
  private crafting: CraftingSystem;
  private collectedResourceIds: Set<string> = new Set(); // Track globally collected resources
  private playerSpriteNum: number;
  private isAdmin = false;
  private lastPositionSent = { lng: 0, lat: 0 };
  private positionSendThrottle = 50; // ms between position updates
  private lastPositionSendTime = 0;
  private playerName: string = '';
  private performanceManager: PerformanceManager;
  private entitiesVisible: boolean = true;

  // Client-side prediction tracking
  private currentInput = { x: 0, y: 0 };
  private currentDeltaTime = 0;

  // Pixel drawing (r/place)
  private pixelCanvas: PixelCanvas | null = null;
  private pixelDrawUI: PixelDrawUI | null = null;
  private pixelDrawingManager: PixelDrawingManager | null = null;

  // Territory
  private territoryManager: TerritoryManager | null = null;

  // Home interior
  private homeInterior: HomeInterior | null = null;

  // Combat
  private mobManager: MobManager | null = null;
  private combatSystem: CombatSystem | null = null;
  private combatUI: CombatUI | null = null;
  private weaponSystem: WeaponSystem | null = null;

  // NPC Dialogue and Missions
  private dialogueUI: DialogueUI;
  private npcMissionSystem: NPCMissionSystem;
  private emojiDiscovery: EmojiDiscoverySystem;
  private currentDialogueNPCId: string | null = null; // Track which NPC is in dialogue

  // Extracted modules
  private chatManager: ChatManager | null = null;
  private adminTools: AdminTools | null = null;
  private craftingUI: CraftingUIManager | null = null;
  private stationTeleporter: StationTeleporter | null = null;

  // Proximity interaction prompts
  private proximityPromptEl: HTMLDivElement | null = null;
  private currentProximityNPC: NPC | null = null;
  private currentProximityMob: Mob | null = null;
  private readonly INTERACT_RADIUS = 0.0004; // ~40m in lng/lat units

  // Building action state (shared with BuildingActions module)
  private buildingActionState: BuildingActionState = {
    selectedBuildingId: null,
    rotationHandleEl: null,
    moveHandleEl: null,
    rotationLineEl: null,
    buildingGlowEl: null,
    isRotating: false,
    isMovingBuilding: false,
    rotationStartAngle: 0,
    buildingStartRotation: 0,
    moveStartScreenPos: null,
    buildingStartPos: null,
    boundUpdateGizmoPosition: null,
    isPlacingBuilding: false,
    isAdmin: false,
    _deleteHandleEl: null,
  };

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
    this.app = new Application();
    this.inputManager = new InputManager();
    this.inventory = new Inventory();
    this.network = new NetworkManager();
    this.crafting = new CraftingSystem(this.inventory);
    this.performanceManager = getPerformanceManager();
    this.dialogueUI = new DialogueUI();
    this.npcMissionSystem = new NPCMissionSystem();
    this.emojiDiscovery = new EmojiDiscoverySystem();
    (window as any).emojiDiscovery = this.emojiDiscovery;

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

    // Initialize managers (non-blocking constructors)
    this.resourceManager = new ResourceManager(this.mapManager, this.app);
    this.npcManager = new NPCManager(this.mapManager, this.app);
    this.waterEntityManager = new WaterEntityManager(this.mapManager, this.app);
    this.terrainEntityManager = new TerrainEntityManager(this.mapManager, this.app);
    this.otherPlayers = new OtherPlayersManager(this.mapManager, this.app);
    this.buildingManager = new BuildingManager(this.mapManager, this.app);
    this.publicSpacesManager = new PublicSpacesManager(this.mapManager, this.app);

    // Parallelize async loads (player sprite, NPC textures, public spaces)
    await Promise.all([
      this.player.init(this.app, this.playerSpriteNum),
      this.npcManager.loadTextures(),
      this.publicSpacesManager.loadPublicSpaces(),
    ]);

    // Initialize combat systems
    this.mobManager = new MobManager(this.mapManager, this.app);
    const progression = (window as any).progression;
    const playerLevel = progression?.getStats?.()?.level || 1;
    this.weaponSystem = new WeaponSystem(this.inventory, playerLevel);
    this.combatSystem = new CombatSystem(this.inventory, progression);
    this.combatUI = new CombatUI();

    // Set equipment bonuses on combat system
    if (this.weaponSystem) {
      const stats = this.weaponSystem.getCombinedStats();
      this.combatSystem.setEquipmentBonuses({
        damage: stats.damage,
        defense: stats.defense,
        maxHp: 0,
        attackSpeed: stats.speed - 1.0, // speed is a multiplier, convert to bonus
      });
    }

    // Init player combat stats
    this.player?.initCombatStats(playerLevel);

    // Setup combat callbacks
    this.setupCombatCallbacks();

    // Initialize pixel drawing canvas (r/place)
    this.pixelCanvas = new PixelCanvas(this.mapManager);
    this.pixelDrawUI = new PixelDrawUI();
    this.pixelDrawingManager = new PixelDrawingManager(
      this.pixelCanvas, this.pixelDrawUI, this.network, this.mapManager,
    );
    await this.pixelDrawingManager.init();

    // Initialize territory manager
    this.territoryManager = new TerritoryManager(
      this.mapManager,
      this.network,
      this.inventory,
      this.inputManager,
      () => this.player,
      () => {
        const user = authService.getUser();
        return user?.id || this.network.getPlayerId() || 'local';
      },
      () => this.playerName || authService.getUser()?.name || 'Explorer',
    );
    await this.territoryManager.init();
    if (this.buildingManager) this.territoryManager.setBuildingManager(this.buildingManager);

    // Initialize station teleporter
    this.stationTeleporter = new StationTeleporter(
      this.mapManager,
      () => this.player,
      this.network,
      () => this.sendPositionUpdate(),
    );

    // Initialize home interior
    this.homeInterior = new HomeInterior();
    this.homeInterior.setNetworkCallbacks({
      onFurniturePlaced: (homeId, item) => this.network.placeFurniture(homeId, item),
      onFurnitureDeleted: (homeId, furnitureId) => this.network.deleteFurniture(homeId, furnitureId),
      onFurnitureMoved: (homeId, furnitureId, x, y, rotation, scale) => this.network.moveFurniture(homeId, furnitureId, x, y, rotation, scale),
    });

    // Admin mode setup
    this.isAdmin = authService.getUser()?.isAdmin === true;
    this.buildingActionState.isAdmin = this.isAdmin;
    if (this.isAdmin) {
      this.adminTools = new AdminTools(this.mapManager, this.buildingManager!, this.inventory, this.network);
      this.adminTools.createUI();
    }

    // Life missions
    const lifeMissions = new LifeMissionSystem();
    (window as any).lifeMissions = lifeMissions;

    // Check mission progress periodically
    setInterval(() => {
      const user = authService.getUser();
      const prog = (window as any).progression;
      if (!prog) return;
      const stats = prog.getStats();
      const items = this.inventory.getAll();
      const resourcesCollected: Record<string, number> = {};
      items.forEach((v: number, k: string) => { resourcesCollected[k] = v; });

      const hasHome = (() => {
        const buildings = this.buildingManager?.getBuildings();
        if (!buildings) return false;
        for (const b of buildings.values()) {
          if (b.type === 'my_home' && b.ownerId === (user?.id || 'local')) return true;
        }
        return false;
      })();

      const completed = lifeMissions.checkProgress({
        resourcesCollected,
        buildingsPlaced: stats.totalBuildingsPlaced,
        hasHome,
        hasEnteredHome: !!localStorage.getItem('gallax_entered_home'),
        mobsKilled: parseInt(localStorage.getItem('gallax_mobs_killed') || '0'),
        level: stats.level,
        weaponsCrafted: this.weaponSystem ? this.weaponSystem.getCraftedItems().length : 0,
        pixelsDrawn: this.pixelCanvas?.getPixelCount() || 0,
        emojisDiscovered: (window as any).emojiDiscovery?.getDiscoveredCount() || 0,
        hasChangedName: !!localStorage.getItem('gallax_guest_name'),
        hasChangedSkin: !!localStorage.getItem('gallax_player_sprite'),
        landmarksVisited: 0,
        totalResourcesCollected: stats.totalResourcesCollected,
        totalDistance: stats.totalDistanceTraveled || 0,
      });

      // Award rewards for completed missions
      for (const mission of completed) {
        const reward = lifeMissions.completeMission(mission.id);
        if (reward) {
          if (reward.xp > 0 && prog) {
            const result = prog.addXP(reward.xp);
            notificationSystem.show(`🎯 Mission complete: ${mission.title}! +${reward.xp} XP`, 'xp');
            if (result.leveledUp) notificationSystem.showLevelUp(result.newLevel);
          }
        }
      }
    }, 5000);
    this.homeInterior.onExit(() => {
      // Show the map again
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) gameContainer.style.display = '';
      // Broadcast that we left
      this.network.exitHome();
    });

    // Wait for map to load style, then spawn everything
    this.mapManager.onLoad(() => {
      console.log('Map loaded, spawning all entities...');
      this.resourceManager?.spawnTreesInView();
      this.npcManager?.spawnNPCsInView();
      this.waterEntityManager?.spawnEntitiesInView();
      this.terrainEntityManager?.spawnEntitiesInView();
      this.mobManager?.spawnMobsInView();
    });

    // Sync sprites when map moves/zooms
    this.mapManager.on('onRender', () => {
      this.player?.updatePosition();
      this.resourceManager?.updateAllPositions();
      this.npcManager?.updateAllPositions();
      this.mobManager?.updateAllPositions();
      this.pixelDrawingManager?.flushRender();
      this.territoryManager?.flushRender();
      this.waterEntityManager?.updateAllPositions();
      this.terrainEntityManager?.updateAllPositions();
      this.otherPlayers?.updateAllPositions();

      // Track mob health bar position during combat
      if (this.combatSystem?.getState() === 'IN_COMBAT' && this.combatUI) {
        const mob = this.combatSystem.getMob();
        if (mob) {
          const mobObj = this.mobManager?.getMob(mob.id);
          if (mobObj) {
            const sp = this.mapManager.project({ lng: mobObj.lng, lat: mobObj.lat });
            this.combatUI.updateMobPosition(sp.x, sp.y);
          }
        }
      }
      this.buildingManager?.updateAllPositions();
      this.publicSpacesManager?.updateAllPositions();
    });

    // Respawn entities when moving to new areas (performance-aware)
    this.mapManager.on('onMove', () => {
      const zoom = this.mapManager.getZoom();

      // Always cull distant entities for memory
      this.resourceManager?.cullDistantResources();
      this.npcManager?.cullDistantNPCs();
      this.waterEntityManager?.cullDistantEntities();
      this.terrainEntityManager?.cullDistantEntities();
      this.mobManager?.cullDistantMobs();

      // Only spawn new entities when zoomed in enough
      if (this.performanceManager.shouldSpawnEntities(zoom)) {
        this.resourceManager?.spawnTreesInView();
        this.npcManager?.spawnNPCsInView();
        this.waterEntityManager?.spawnEntitiesInView();
        this.terrainEntityManager?.spawnEntitiesInView();
        this.mobManager?.spawnMobsInView();
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
    this.inventory.onChange(() => {
      this.updateInventoryUI();
      // Update mission progress when inventory changes
      const inventoryData: Record<string, number> = {};
      this.inventory.getAll().forEach((count, type) => {
        inventoryData[type] = count;
      });
      this.npcMissionSystem.updateProgress(inventoryData);
    });

    // Setup crafting UI (delegated to CraftingUIManager)
    const craftingCallbacks: CraftingUICallbacks = {
      getBuildingManager: () => this.buildingManager,
      getMapManager: () => this.mapManager,
      setPlacingBuilding: (placing: boolean) => { this.buildingActionState.isPlacingBuilding = placing; },
      isPlacingBuilding: () => this.buildingActionState.isPlacingBuilding,
      showPlacementHint: (emoji: string, name: string) => showPlacementHint(emoji, name),
      hidePlacementHint: () => hidePlacementHint(),
    };
    this.craftingUI = new CraftingUIManager(
      this.crafting, this.inventory, this.weaponSystem, this.combatSystem, this.isAdmin, craftingCallbacks
    );
    this.craftingUI.createUI();
    this.inventory.onChange(() => this.craftingUI?.updateBuildingTab());

    // Setup name input UI
    this.createNameInputUI();

    // Setup chat UI (delegated to ChatManager)
    this.chatManager = new ChatManager(this.network, this.playerName, () => this.isMobile());
    this.chatManager.createUI();
    this.chatManager.createChatButton();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
      this.mapManager.resize();
    });

    // Connect to multiplayer server and load buildings in background (don't block game start)
    // Load buildings from D1 first (authoritative source), then connect to multiplayer
    await this.loadBuildingsFromD1().catch(err => console.log('Building load failed:', err));

    // Spawn player at their home if they have one
    this.spawnAtHome();

    this.connectToServer().catch(err => console.log('Server connection deferred:', err));

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
        const buildingId = `bld_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const building = { id: buildingId, type, lng: pos.lng, lat: pos.lat, ownerId: 'local', rotation: 0 };
        this.buildingManager?.addBuilding(building);
        this.saveBuildingToLocalStorage(building);
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

  // Public method to change player sprite (used by settings menu)
  async changePlayerSprite(spriteNum: number): Promise<void> {
    if (!this.player) return;

    // Update local sprite
    await this.player.changeSprite(spriteNum);

    // Update stored sprite number
    this.playerSpriteNum = spriteNum;
    localStorage.setItem('gallax_player_sprite', spriteNum.toString());

    // Send sprite change to server so other players see it
    this.network.changeSprite(spriteNum);
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

      // Update mobs (with player position for aggro)
      if (this.player && this.mobManager) {
        const pos = this.player.getPosition();
        this.mobManager.setPlayerPosition(pos.lng, pos.lat);
        this.mobManager.update(deltaTime);
      }

      // Update water entities (fish and boats)
      this.waterEntityManager?.update(deltaTime);

      // Update terrain entities (trains, etc.)
      this.terrainEntityManager?.update(deltaTime);
    }

    // Update combat system
    if (this.combatSystem && this.combatSystem.getState() === 'IN_COMBAT') {
      this.combatSystem.update(deltaTime / 60); // Convert frames to seconds (60fps)

      // Keep mob health bar tracking the mob position during pan/zoom
      const currentMob = this.combatSystem.getMob();
      if (currentMob && this.combatUI && this.mobManager) {
        const mobObj = this.mobManager.getMob(currentMob.id);
        if (mobObj) {
          const screenPos = this.mapManager.project({ lng: mobObj.lng, lat: mobObj.lat });
          this.combatUI.updateMobPosition(screenPos.x, screenPos.y);
        }
      }
    }

    // Update proximity interaction prompts (NPC talk / mob fight)
    this.updateProximityPrompts();

    // Flush pixel canvas render (runs every frame, only actually renders when dirty)
    this.pixelDrawingManager?.flushRender();

    // Territory: flush render + update claim progress
    this.territoryManager?.update();

    // Broadcast home room position if inside a home (throttled)
    if (this.homeInterior?.isInside()) {
      const homeId = this.homeInterior.getCurrentHomeId();
      if (homeId) {
        const pos = this.homeInterior.getPlayerPosition();
        this.network.homeMove(homeId, pos.x, pos.y);
      }
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

    if (this.player) {
      const pos = this.player.getPosition();

      // Check proximity to public spaces for missions
      if (this.publicSpacesManager) {
        const nearbySpace = this.publicSpacesManager.checkProximity(pos.lng, pos.lat);

        if ((window as any).setCurrentMissionSpace) {
          (window as any).setCurrentMissionSpace(nearbySpace);
        }
      }
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

  // Setup click handler for: resource collection, click-to-move, building placement, building rotation
  private setupMapClickHandler(): void {
    const map = this.mapManager.getMap();

    map.on('click', (e) => {
      const clickLng = e.lngLat.lng;
      const clickLat = e.lngLat.lat;
      const screenX = e.point.x;
      const screenY = e.point.y;

      // If dialogue is open, close it when clicking elsewhere
      if (this.dialogueUI.isVisible()) {
        console.log('💬 Closing dialogue (clicked elsewhere)');
        this.dialogueUI.hide();

        // Unfreeze the NPC
        if (this.currentDialogueNPCId) {
          this.npcManager?.unfreezeNPC(this.currentDialogueNPCId);
          this.currentDialogueNPCId = null;
        }
        return;
      }

      // If placing a building, handle building placement
      if (this.buildingActionState.isPlacingBuilding && this.crafting.getSelectedBuilding()) {
        handleBuildingPlacement(this.buildingActionState, this.getBuildingDeps(), clickLng, clickLat);
        return;
      }

      // Check if clicked on a building
      const building = this.buildingManager?.getBuildingAtPosition(screenX, screenY);
      if (building && this.player) {
        const userId = authService.getUser()?.id || 'local';
        const isOwner = building.ownerId === userId || this.isAdmin;

        if (building.type === 'my_home') {
          // Show action popup: Enter + Move (if owner or admin)
          showBuildingActions(this.buildingActionState, this.getBuildingDeps(), building, screenX, screenY, isOwner);
          return;
        }

        // For buildings owned by you (or admin), show gizmo
        if (isOwner) {
          selectBuildingForRotation(this.buildingActionState, this.getBuildingDeps(), building.id);
          return;
        }

        // For buildings owned by others, just walk to them
        this.player.setTarget({ lng: building.lng, lat: building.lat, type: 'terrain' }, () => {});
        return;
      }

      // Clicking elsewhere deselects any selected building
      if (this.buildingActionState.selectedBuildingId) {
        deselectBuilding(this.buildingActionState, this.getBuildingDeps());
      }

      // Check if clicked on a train station — walk to it, then enter station mode
      // (checked before NPC/mob so stations aren't blocked by overlapping sprites)
      if (this.stationTeleporter) {
        const map = this.mapManager.getMap();
        let stationFeature: mapboxgl.GeoJSONFeature | null = null;
        try {
          const transitFeatures = map.queryRenderedFeatures([screenX, screenY], { layers: ['transit-label'] });
          stationFeature = transitFeatures.find((f: any) => {
            const maki = f.properties?.maki || '';
            const type = f.properties?.type || '';
            return maki.includes('rail') || type.includes('station');
          }) as mapboxgl.GeoJSONFeature || null;
        } catch { /* transit-label layer may not exist at all zoom levels */ }

        if (stationFeature || this.stationTeleporter.isInStationMode()) {
          const result = this.stationTeleporter.handleStationClick(stationFeature, clickLng, clickLat);
          if (result.handled) {
            if (result.walkTo && this.player) {
              // Walk to the station first, then enter station mode on arrival
              const station = result.walkTo;
              notificationSystem.show(`🚉 Walking to ${station.name}...`, 'info', 2000);
              this.player.setTarget(
                { lng: station.lng, lat: station.lat, type: 'station' as any },
                () => {
                  this.stationTeleporter?.enterStationMode(station.name, station.lng, station.lat);
                },
              );
            }
            return;
          }
        }
      }

      // NPCs and mobs are handled via proximity prompts (not click-to-target)
      // They fall through to click-to-move below

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
          showWaterBlockedFeedback(this.getBuildingDeps(), clickLng, clickLat);
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
    const targetId = target.id || '';
    const targetEmoji = target.emoji || '';

    // Skip if already collected (from server sync) - silently
    if (targetId && this.collectedResourceIds.has(targetId)) {
      return;
    }

    const resourceType = targetEmoji ? EMOJI_TO_RESOURCE[targetEmoji] : undefined;

    if (resourceType) {
      this.inventory.add(resourceType);
      console.log(`✨ Collected ${RESOURCE_INFO[resourceType].emoji} ${RESOURCE_INFO[resourceType].name}!`);

      // Award XP for collecting resource
      const progression = (window as any).progression;
      let totalXP = 5;

      // Check for emoji discovery bonus
      if (targetEmoji) {
        const discovery = this.emojiDiscovery.discover(targetEmoji);
        if (discovery.isNew && discovery.entry) {
          totalXP += discovery.xp;
          notificationSystem.show(
            `${targetEmoji} New discovery: ${discovery.entry.name}! ${discovery.entry.meaning} (+${discovery.xp} XP)`,
            'levelup',
            4000
          );
        }
      }

      if (progression) {
        const result = progression.addXP(totalXP);
        notificationSystem.showXP(totalXP);
        if (result.leveledUp) {
          notificationSystem.showLevelUp(result.newLevel);
        }
        progression.incrementResourcesCollected();
      }

      // Show floating text feedback
      showCollectFeedback(this.getBuildingDeps(), target.lng, target.lat, RESOURCE_INFO[resourceType].emoji);
    }

    // Notify server of collection
    if (targetId) {
      this.network.collectResource(targetId);
      this.collectedResourceIds.add(targetId);
    }

    // Remove the resource from its manager
    if (targetId) {
      this.removeResourceLocally(targetId, target.type);
    }
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

  // Start dialogue with an NPC
  private startNPCDialogue(npc: NPC): void {
    console.log(`💬 Starting dialogue with NPC ${npc.id}`);

    // Track which NPC is in dialogue
    this.currentDialogueNPCId = npc.id;

    // Freeze the NPC so they stop moving
    this.npcManager?.freezeNPC(npc.id);

    // Update mission progress based on current inventory
    const inventoryData: Record<string, number> = {};
    this.inventory.getAll().forEach((count, type) => {
      inventoryData[type] = count;
    });
    this.npcMissionSystem.updateProgress(inventoryData);

    // Check if this NPC has an active mission
    const activeMissions = this.npcMissionSystem.getActiveMissions();
    let conversation = null;

    // Try to find a mission-related conversation
    for (const mission of activeMissions) {
      const hasMission = this.npcMissionSystem.hasMission(mission.id);
      const missionConv = getMissionConversation(mission.id, hasMission);
      if (missionConv) {
        conversation = missionConv;
        break;
      }
    }

    // If no mission conversation, show random small talk
    if (!conversation) {
      const activeMissionIds = activeMissions.map(m => m.id);
      conversation = getRandomConversation(activeMissionIds);
    }

    // Get player position
    const playerPos = this.player?.getPosition();
    if (!playerPos) return;

    // Show dialogue UI with positions
    this.dialogueUI.show(
      conversation,
      (action, missionId) => {
        this.handleDialogueAction(action, missionId, npc.id);
      },
      this.mapManager,
      { lng: npc.lng, lat: npc.lat },
      playerPos
    );
  }

  // Handle dialogue actions (accept mission, complete mission, etc.)
  private handleDialogueAction(action: string, missionId?: string, npcId?: string): void {
    if (action === 'accept_mission' && missionId) {
      this.npcMissionSystem.acceptMission(missionId);
      notificationSystem.show(`📜 Mission accepted: ${missionId}`, 'info');
    } else if (action === 'complete_mission' && missionId) {
      const progression = (window as any).progression;
      const result = this.npcMissionSystem.completeMission(missionId, this.inventory, progression);

      if (result.success) {
        notificationSystem.show(`🎉 Mission complete! +${result.xp} XP, +${result.coins} coins`, 'success');
        notificationSystem.showXP(result.xp);
      } else {
        notificationSystem.show(`❌ Mission requirements not met`, 'error');
      }
    }

    // Always unfreeze NPC when dialogue ends (for any action)
    if (npcId) {
      this.npcManager?.unfreezeNPC(npcId);
      this.currentDialogueNPCId = null;
    }
  }

  // Remove resource by ID (called from server sync)
  private removeResourceById(resourceId: string): void {
    // Try to remove from any manager
    this.resourceManager?.removeResource(resourceId);
    this.waterEntityManager?.removeEntity(resourceId);
    this.terrainEntityManager?.removeEntity(resourceId);
  }


  // Create inventory hotbar UI
  private createInventoryUI(): void {
    // Hotbar removed - resources shown in crafting menu instead
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

  // Load buildings - try D1 first, fall back to localStorage
  private async loadBuildingsFromD1(): Promise<void> {
    // Try loading from D1 (server) — server is authoritative
    try {
      const response = await fetch('/api/buildings');
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const buildings = await response.json();
          if (Array.isArray(buildings)) {
            console.log(`📂 Loaded ${buildings.length} buildings from D1`);

            // Add server buildings to the map
            const existingBuildings = this.buildingManager?.getBuildings();
            for (const b of buildings) {
              if (!existingBuildings?.has(b.id)) {
                this.buildingManager?.addBuilding({
                  id: b.id,
                  type: b.type,
                  lng: b.lng,
                  lat: b.lat,
                  rotation: b.rotation || 0,
                  ownerId: b.owner_id,
                  ownerName: b.owner_name || undefined,
                });
              }
            }

            // Sync localStorage to match server (prevents deleted buildings reappearing)
            const serverData = buildings.map((b: any) => ({
              id: b.id, type: b.type, lng: b.lng, lat: b.lat,
              ownerId: b.owner_id, ownerName: b.owner_name, rotation: b.rotation || 0,
            }));
            localStorage.setItem('gallax_local_buildings', JSON.stringify(serverData));
            console.log(`📂 Synced localStorage with ${serverData.length} server buildings`);
            return; // Server loaded successfully, done
          }
        }
      }
    } catch (err) {
      console.log('📂 D1 not available, will use local storage');
    }

    // Server not available — use localStorage as fallback
    console.log('📂 Using localStorage buildings only');
    this.loadBuildingsFromLocalStorage();
  }

  // Save a building to localStorage for offline/guest persistence
  private saveBuildingToLocalStorage(building: { id: string; type: string; lng: number; lat: number; ownerId: string; ownerName?: string; rotation: number }): void {
    try {
      const key = 'gallax_local_buildings';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      // Don't duplicate
      if (!existing.some((b: any) => b.id === building.id)) {
        existing.push(building);
        localStorage.setItem(key, JSON.stringify(existing));
      }
    } catch (err) {
      console.error('Failed to save building to localStorage:', err);
    }
  }

  // Load buildings from localStorage
  private loadBuildingsFromLocalStorage(): void {
    try {
      const key = 'gallax_local_buildings';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(stored) || stored.length === 0) return;

      console.log(`📂 Loading ${stored.length} buildings from localStorage`);
      const existingBuildings = this.buildingManager?.getBuildings();
      for (const b of stored) {
        if (b.id && b.type && !existingBuildings?.has(b.id)) {
          this.buildingManager?.addBuilding({
            id: b.id,
            type: b.type,
            lng: b.lng,
            lat: b.lat,
            rotation: b.rotation || 0,
            ownerId: b.ownerId || 'local',
            ownerName: b.ownerName || undefined,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load buildings from localStorage:', err);
    }
  }

  // Connect to multiplayer server
  private async connectToServer(): Promise<void> {
    try {
      await this.network.connect({
        onInit: (playerId, players, collectedResources, buildings, resumedPosition) => {
          console.log(`🎮 Received init as player ${playerId}`);
          console.log(`👥 ${players.length} players online:`, players.map(p => `${p.name}(${p.id})`));
          console.log(`🌲 ${collectedResources.length} resources already collected`);
          console.log(`🏠 ${buildings.length} buildings placed`);

          // If resuming an existing session (same auth ID on another device),
          // teleport to where we already were
          if (resumedPosition && this.player) {
            console.log(`🔄 Resuming session at ${resumedPosition.lng.toFixed(4)}, ${resumedPosition.lat.toFixed(4)}`);
            this.player.setPosition(resumedPosition.lng, resumedPosition.lat);
            this.player.cancelTarget();
            this.mapManager.getMap().jumpTo({ center: [resumedPosition.lng, resumedPosition.lat] });
          }

          // Track already collected resources
          collectedResources.forEach(id => this.collectedResourceIds.add(id));

          // Use auth name (consistent across sessions) instead of server-generated name
          const user = authService.getUser();
          const authName = user?.name || '';
          if (authName) {
            this.playerName = authName;
            this.player?.setName(authName);
            this.chatManager?.setPlayerName(authName);
            // Tell server to use this name too
            this.network.setName(authName);
            console.log(`📛 Using auth name: "${authName}"`);
          } else {
            // Fallback to server-assigned name
            const myPlayer = players.find(p => p.id === playerId);
            if (myPlayer) {
              this.playerName = myPlayer.name;
              this.player?.setName(this.playerName);
              this.chatManager?.setPlayerName(this.playerName);
              console.log(`📛 Server assigned name: "${this.playerName}"`);
            }
          }

          // Add other players
          const otherPlayerList = players.filter(p => p.id !== playerId);
          console.log(`👥 Adding ${otherPlayerList.length} other players...`);
          otherPlayerList.forEach(p => {
            console.log(`  → Adding player ${p.name} (${p.id}) sprite=${p.spriteNum} at ${p.lng.toFixed(4)}, ${p.lat.toFixed(4)}`);
            this.otherPlayers?.addPlayer(p);
          });

          // Skip geckos buildings — D1 is the authoritative source
          // Geckos server keeps buildings in RAM from all sessions,
          // but D1 has the real state (including deletes)
          console.log(`🏠 Skipping ${buildings.length} geckos buildings (D1 is authoritative)`);
        },
        onPlayerJoined: (player) => {
          console.log(`👋 Player ${player.name} joined with sprite=${player.spriteNum}`);
          this.otherPlayers?.addPlayer(player);
        },
        onPlayerLeft: (playerId) => {
          console.log(`👋 Player ${playerId} left`);
          this.otherPlayers?.removePlayer(playerId);
          // Also clean up home presence — player may have disconnected while inside a home
          this.homeInterior?.removeOtherPlayer(playerId);
        },
        onPlayerMoved: (playerId, lng, lat) => {
          this.otherPlayers?.movePlayer(playerId, lng, lat);
        },
        onPlayerNameChanged: (playerId, name) => {
          console.log(`📛 Player ${playerId} changed name to "${name}"`);
          this.otherPlayers?.updatePlayerName(playerId, name);
          this.homeInterior?.updateOtherPlayerName(playerId, name);
          this.buildingManager?.updateOwnerName(playerId, name);
        },
        onResourceCollected: (resourceId, playerId) => {
          console.log(`🌲 Resource ${resourceId} collected by ${playerId}`);
          this.collectedResourceIds.add(resourceId);
          this.removeResourceById(resourceId);
        },
        onBuildingPlaced: (building) => {
          // Skip our own building echoes (we already added it locally)
          const myId = this.network.getPlayerId();
          if (building.ownerId === myId) {
            console.log(`🏠 Skipping own building echo: ${building.type}`);
            return;
          }
          console.log(`🏠 Building ${building.type} placed by ${building.ownerId}`);
          this.buildingManager?.addBuilding(building);
        },
        onBuildingRotated: (buildingId, rotation) => {
          console.log(`🔄 Building ${buildingId} rotated to ${rotation.toFixed(2)} rad`);
          this.buildingManager?.rotateBuilding(buildingId, rotation);
          // Update rotation handle if this is the selected building
          if (buildingId === this.buildingActionState.selectedBuildingId) {
            updateRotationHandlePosition(this.buildingActionState, this.getBuildingDeps());
          }
        },
        onBuildingMoved: (buildingId, lng, lat) => {
          console.log(`📍 Building ${buildingId} moved to ${lng.toFixed(5)}, ${lat.toFixed(5)}`);
          this.buildingManager?.moveBuilding(buildingId, lng, lat);
          if (buildingId === this.buildingActionState.selectedBuildingId) {
            updateRotationHandlePosition(this.buildingActionState, this.getBuildingDeps());
          }
        },
        onBuildingDeleted: (buildingId) => {
          console.log(`🗑️ Building ${buildingId} deleted by another player`);
          this.buildingManager?.removeBuilding(buildingId);
        },
        onHomeStyleUpdated: (buildingId, emoji, tint) => {
          const b = this.buildingManager?.getBuildings().get(buildingId);
          if (b) {
            if (emoji) b.text.text = emoji;
            if (tint) b.text.tint = parseInt(tint.replace('#', ''), 16);
            console.log(`🎨 Home ${buildingId} style updated: emoji=${emoji} tint=${tint}`);
          }
        },
        // Combat sync
        onMobKilled: (mobId, killedBy) => {
          console.log(`⚔️ Mob ${mobId} killed by ${killedBy}`);
          this.mobManager?.damageMob(mobId, 99999); // Remove mob for us too
        },
        onCombatStarted: (mobId, playerId) => {
          console.log(`⚔️ Player ${playerId} started combat with mob ${mobId}`);
          this.mobManager?.aggroMob(mobId); // Aggro the mob on our screen too
        },
        // Territory sync
        onTerritoryClaimed: (playerId, playerName, cells, color) => {
          this.territoryManager?.onTerritoryClaimed(playerId, playerName, cells, color);
        },
        // Sprite change
        onSpriteChanged: (playerId, spriteNum) => {
          console.log(`👤 Player ${playerId} changed sprite to ${spriteNum}`);
          this.otherPlayers?.changeSprite(playerId, spriteNum);
        },
        // Furniture sync
        onFurniturePlaced: (homeId, item) => {
          if (this.homeInterior?.isInside() && this.homeInterior.getCurrentHomeId() === homeId) {
            this.homeInterior.addFurnitureFromNetwork(item);
          }
        },
        onFurnitureDeleted: (homeId, furnitureId) => {
          if (this.homeInterior?.isInside() && this.homeInterior.getCurrentHomeId() === homeId) {
            this.homeInterior.removeFurnitureFromNetwork(furnitureId);
          }
        },
        onFurnitureMoved: (homeId, furnitureId, x, y, rotation, scale) => {
          if (this.homeInterior?.isInside() && this.homeInterior.getCurrentHomeId() === homeId) {
            this.homeInterior.moveFurnitureFromNetwork(furnitureId, x, y, rotation, scale);
          }
        },
        // Home room presence
        onPlayerEnteredHome: (playerId, homeId, spriteNum, playerName) => {
          if (this.homeInterior?.isInside() && this.homeInterior.getCurrentHomeId() === homeId) {
            // Skip our own entry
            if (playerId !== this.network.getPlayerId()) {
              this.homeInterior.addOtherPlayer(playerId, spriteNum, playerName);
            }
          }
        },
        onPlayerExitedHome: (playerId, homeId) => {
          if (this.homeInterior?.isInside() && this.homeInterior.getCurrentHomeId() === homeId) {
            this.homeInterior.removeOtherPlayer(playerId);
          }
        },
        onPlayerHomeMoved: (playerId, homeId, x, y) => {
          if (playerId === this.network.getPlayerId()) return; // Skip own movement
          if (this.homeInterior?.isInside() && this.homeInterior.getCurrentHomeId() === homeId) {
            this.homeInterior.moveOtherPlayer(playerId, x, y);
          }
        },
        onChatMessage: (message) => {
          this.chatManager?.addMessage(message);
        },
        // Pixel drawing from other players
        onPixelPlaced: (x, y, color, authorId, authorName) => {
          this.pixelDrawingManager?.onPixelPlaced(x, y, color, authorId, authorName);
        },
        onPixelErased: (x, y) => {
          this.pixelDrawingManager?.onPixelErased(x, y);
        },
        onPixelBatchPlaced: (pixels, authorId, authorName) => {
          this.pixelDrawingManager?.onPixelBatchPlaced(pixels, authorId, authorName);
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

      // Send join message with auth name so server uses it
      const pos = this.player?.getPosition();
      if (pos) {
        const user = authService.getUser();
        const authName = user?.name || '';
        const authId = user?.id || '';
        console.log(`📤 Sending join message with sprite: ${this.playerSpriteNum}, name: ${authName}, authId: ${authId}`);
        this.network.join(pos.lng, pos.lat, this.playerSpriteNum, authName, authId);
      }
    } catch (error) {
      console.error('Failed to connect to server:', error);
      // Use the name from auth service (guest or authenticated)
      if (!this.playerName) {
        const user = authService.getUser();
        this.playerName = user?.name || 'Explorer';
        this.player?.setName(this.playerName);
        console.log(`📛 Using auth name: "${this.playerName}"`);
      }
    }
  }

  // Create name input UI - empty input, type to change your server-assigned name
  private createNameInputUI(): void {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('player-name-input') as HTMLInputElement;
    const setBtn = document.getElementById('set-name-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-name-btn') as HTMLButtonElement;
    const editBtn = document.getElementById('edit-name-btn') as HTMLButtonElement;
    if (!modal || !input || !setBtn || !editBtn) return;

    const openModal = () => {
      input.value = '';
      input.placeholder = this.playerName || 'Enter name...';
      modal.style.display = 'flex';
      setTimeout(() => input.focus(), 100);
    };

    const closeModal = () => {
      modal.style.display = 'none';
    };

    const setName = () => {
      const name = input.value.trim();
      if (name) {
        this.playerName = name;
        this.player?.setName(name);
        this.network.setName(name);
        this.chatManager?.setPlayerName(name);
        this.homeInterior?.updateLocalPlayerName(name);
        // Update own building name tags (ownerId stored as authUserId or 'local')
        const ownBuildingId = authService.getUser()?.id || 'local';
        this.buildingManager?.updateOwnerName(ownBuildingId, name);
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = name;
        localStorage.setItem('gallax_guest_name', name);
        closeModal();
      }
    };

    editBtn.addEventListener('click', openModal);
    setBtn.addEventListener('click', setName);
    cancelBtn?.addEventListener('click', closeModal);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); setName(); }
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Build the deps object for BuildingActions module functions
  private getBuildingDeps(): BuildingDeps {
    return {
      mapManager: this.mapManager,
      buildingManager: this.buildingManager,
      inventory: this.inventory,
      network: this.network,
      crafting: this.crafting,
      player: this.player,
      playerName: this.playerName,
      playerSpriteNum: this.playerSpriteNum,
      homeInterior: this.homeInterior,
      isWater: (lng: number, lat: number) => this.isWater(lng, lat),
      saveBuildingToLocalStorage: (building) => this.saveBuildingToLocalStorage(building),
      updateCraftingUI: () => this.craftingUI?.updateBuildingTab(),
      updateMapCursor: () => this.craftingUI?.updateMapCursor(),
    };
  }

  // Check if on mobile (touch device)
  private spawnAtHome(): void {
    const userId = authService.getUser()?.id || 'local';
    const buildings = this.buildingManager?.getBuildings();
    if (!buildings || !this.player) return;

    for (const b of buildings.values()) {
      if (b.type === 'my_home' && b.ownerId === userId) {
        console.log(`🏡 Spawning at home: ${b.lng.toFixed(5)}, ${b.lat.toFixed(5)}`);
        this.player.setPosition(b.lng, b.lat);
        // Also center the map on the home
        this.mapManager.getMap().setCenter([b.lng, b.lat]);
        return;
      }
    }
  }

  private isMobile(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
  }


  // --- Proximity interaction prompts ---

  private updateProximityPrompts(): void {
    if (!this.player) { this.hideProximityPrompt(); return; }
    // Don't show prompts while in combat, dialogue, home, or station mode
    if (this.combatSystem?.getState() === 'IN_COMBAT') { this.hideProximityPrompt(); return; }
    if (this.currentDialogueNPCId) { this.hideProximityPrompt(); return; }
    if (this.homeInterior?.isInside()) { this.hideProximityPrompt(); return; }
    if (this.stationTeleporter?.isInStationMode()) { this.hideProximityPrompt(); return; }

    const pos = this.player.getPosition();
    const r = this.INTERACT_RADIUS;

    // Find nearest mob in range
    let nearestMob: Mob | null = null;
    let nearestMobDist = Infinity;
    if (this.mobManager && !this.combatSystem?.isInvulnerable()) {
      for (const [, mob] of this.mobManager.getAllMobs()) {
        const dx = mob.lng - pos.lng;
        const dy = mob.lat - pos.lat;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r && d < nearestMobDist) {
          nearestMobDist = d;
          nearestMob = mob;
        }
      }
    }

    // Find nearest NPC in range
    let nearestNPC: NPC | null = null;
    let nearestNPCDist = Infinity;
    if (this.npcManager) {
      for (const [, npc] of this.npcManager.getAllNPCs()) {
        if (npc.frozen) continue; // already in dialogue
        const dx = npc.lng - pos.lng;
        const dy = npc.lat - pos.lat;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < r && d < nearestNPCDist) {
          nearestNPCDist = d;
          nearestNPC = npc;
        }
      }
    }

    // Priority: mob (combat) over NPC (talk) — show only one prompt at a time
    if (nearestMob && nearestMob !== this.currentProximityMob) {
      this.currentProximityMob = nearestMob;
      this.currentProximityNPC = null;
      this.showProximityPrompt(
        `⚔️ Fight ${nearestMob.definition.emoji} ${nearestMob.definition.name}`,
        () => this.startCombatWithMob(nearestMob!),
      );
    } else if (!nearestMob && nearestNPC && nearestNPC !== this.currentProximityNPC) {
      this.currentProximityNPC = nearestNPC;
      this.currentProximityMob = null;
      this.showProximityPrompt(
        `💬 Talk to ${nearestNPC.id.split('-').pop() || 'NPC'}`,
        () => this.startNPCDialogue(nearestNPC!),
      );
    } else if (!nearestMob && !nearestNPC) {
      this.currentProximityMob = null;
      this.currentProximityNPC = null;
      this.hideProximityPrompt();
    }
  }

  private showProximityPrompt(label: string, action: () => void): void {
    if (!this.proximityPromptEl) {
      this.proximityPromptEl = document.createElement('div');
      this.proximityPromptEl.id = 'proximity-prompt';
      this.proximityPromptEl.style.cssText = `
        position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
        z-index:150; opacity:0; transition:opacity 0.2s ease;
      `;
      document.body.appendChild(this.proximityPromptEl);
    }

    const btn = document.createElement('button');
    btn.style.cssText = `
      padding:12px 24px; border-radius:14px; border:none;
      background:rgba(20,20,30,0.85);
      backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
      border:1px solid rgba(255,255,255,0.15);
      color:white; font-size:16px; font-weight:600;
      cursor:pointer; white-space:nowrap;
      box-shadow:0 4px 16px rgba(0,0,0,0.3);
    `;
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      action();
      this.hideProximityPrompt();
    });

    this.proximityPromptEl.innerHTML = '';
    this.proximityPromptEl.appendChild(btn);
    this.proximityPromptEl.style.opacity = '1';
  }

  private hideProximityPrompt(): void {
    if (this.proximityPromptEl) {
      this.proximityPromptEl.style.opacity = '0';
    }
    this.currentProximityMob = null;
    this.currentProximityNPC = null;
  }


  // --- Combat Integration ---

  private startCombatWithMob(mob: Mob): void {
    if (!this.combatSystem || !this.combatUI || !this.player) return;
    if (this.combatSystem.getState() !== 'IDLE') return;

    // Aggro the mob so it fights back
    this.mobManager?.aggroMob(mob.id);

    // Notify other players about combat
    this.network.notifyCombatStarted(mob.id);

    const combatMob: CombatMob = {
      id: mob.id,
      type: mob.definition.emoji,
      name: mob.definition.name,
      hp: mob.currentHp,
      maxHp: mob.definition.hp,
      damage: mob.definition.damage,
      defense: mob.definition.defense,
      speed: mob.definition.speed,
      xpReward: mob.definition.xpReward,
    };

    const started = this.combatSystem.startCombat(combatMob);
    if (!started) return;

    this.player.isInCombat = true;
    this.player.cancelTarget();

    // Show combat UI
    const pStats = this.combatSystem.getPlayerStats();
    this.combatUI.show(
      mob.definition.emoji,
      mob.definition.name,
      mob.currentHp,
      mob.definition.hp,
      pStats.currentHp,
      pStats.maxHp
    );
    this.combatUI.showBanner(`⚔️ FIGHT! vs ${mob.definition.emoji} ${mob.definition.name}`, 'fight');

    // Track mob position for UI
    this.updateCombatMobPosition(mob);
  }

  private updateCombatMobPosition(mob: Mob): void {
    if (!this.combatUI || !this.combatSystem) return;
    if (this.combatSystem.getState() !== 'IN_COMBAT') return;

    const screenPos = this.mapManager.project({ lng: mob.lng, lat: mob.lat });
    this.combatUI.updateMobPosition(screenPos.x, screenPos.y);
  }

  private setupCombatCallbacks(): void {
    if (!this.combatSystem || !this.combatUI) return;

    this.combatSystem.setCallbacks({
      onDamageDealt: (target, amount, isCrit) => {
        if (!this.combatUI || !this.combatSystem) return;
        const mob = this.combatSystem.getMob();

        if (target === 'mob' && mob) {
          // Damage dealt to mob
          const mobObj = this.mobManager?.getMob(mob.id);
          if (mobObj) {
            const screenPos = this.mapManager.project({ lng: mobObj.lng, lat: mobObj.lat });
            this.combatUI.showDamageNumber(screenPos.x, screenPos.y - 40, amount, 'mob', isCrit);
            // Sync mob HP with MobManager
            this.mobManager?.damageMob(mob.id, 0); // Just update health bar visual
          }
          this.combatUI.updateMobHp(mob.hp, mob.maxHp);
        } else if (target === 'player') {
          // Damage dealt to player
          const pStats = this.combatSystem!.getPlayerStats();
          if (this.player) {
            this.player.currentHp = pStats.currentHp;
            this.player.maxHp = pStats.maxHp;
            const screenPos = this.mapManager.project(this.player.getPosition());
            this.combatUI.showDamageNumber(screenPos.x, screenPos.y - 50, amount, 'player', isCrit);
          }
          this.combatUI.updatePlayerHp(pStats.currentHp, pStats.maxHp);
        }
      },

      onCombatEnd: (result) => {
        if (!this.combatSystem || !this.combatUI || !this.player) return;
        const mob = this.combatSystem.getMob();

        if (result === 'victory' && mob) {
          // Award loot
          const mobObj = this.mobManager?.getMob(mob.id);
          if (mobObj) {
            const loot = this.mobManager!.rollLoot(mobObj.definition);
            for (const item of loot) {
              const amount = Math.floor(Math.random() * (item.max - item.min + 1)) + item.min;
              // Map loot emoji to resource type
              const resourceType = EMOJI_TO_RESOURCE[item.emoji];
              if (resourceType) {
                this.inventory.add(resourceType, amount);
              }
            }
            if (loot.length > 0) {
              const lootStr = loot.map(l => `${l.emoji} ${l.name}`).join(', ');
              notificationSystem.show(`🎒 Loot: ${lootStr}`, 'info');
            }
          }

          // Award XP
          const progression = (window as any).progression;
          if (progression) {
            const result2 = progression.addXP(mob.xpReward);
            notificationSystem.showXP(mob.xpReward);
            if (result2.leveledUp) {
              notificationSystem.showLevelUp(result2.newLevel);
              this.player.initCombatStats(result2.newLevel);
            }
          }

          // Discover mob emoji
          this.emojiDiscovery.discover(mob.type);

          // Remove defeated mob and notify other players
          this.mobManager?.damageMob(mob.id, 99999);
          this.network.notifyMobKilled(mob.id);

          // Track mobs killed
          const kills = parseInt(localStorage.getItem('gallax_mobs_killed') || '0') + 1;
          localStorage.setItem('gallax_mobs_killed', kills.toString());

          this.combatUI.showBanner(`🏆 VICTORY! +${mob.xpReward} XP`, 'victory');
        } else {
          // Defeat - penalty applied by CombatSystem
          this.player.respawn();
          this.combatUI.showBanner('💀 DEFEAT...', 'defeat');
          notificationSystem.show('💀 You were defeated! Lost some resources.', 'info');
        }

        this.player.isInCombat = false;

        // Hide combat UI after a short delay
        setTimeout(() => {
          this.combatUI?.hide();
        }, 1500);

        this.craftingUI?.updateBuildingTab();
      },

      onAbilityUsed: (slot) => {
        // Update UI cooldowns
        if (!this.combatSystem || !this.combatUI) return;
        const abilities = this.combatSystem.getAbilities();
        const a = abilities[slot];
        if (a) {
          this.combatUI.updateAbilityCooldown(slot, a.currentCooldown * 1000, a.cooldown * 1000);
        }
      },
    });

    // Wire up UI ability buttons
    this.combatUI.onAbilityClick((slot) => {
      this.combatSystem?.useAbility(slot);
    });

    this.combatUI.onFleeClick(() => {
      this.combatSystem?.flee();
      this.player!.isInCombat = false;
      setTimeout(() => this.combatUI?.hide(), 500);
    });

    // Mob interaction is handled by proximity prompts (not click-to-target)

    // Auto-engage: when an aggroed mob reaches the player, start combat automatically
    this.mobManager?.onMobReachPlayer((mob) => {
      if (this.player && !this.player.isInCombat && !this.combatSystem?.isInvulnerable() && this.combatSystem?.getState() === 'IDLE') {
        console.log(`⚔️ ${mob.definition.emoji} ${mob.definition.name} attacks you!`);
        notificationSystem.show(`${mob.definition.emoji} ${mob.definition.name} attacks!`, 'info');
        this.startCombatWithMob(mob);
      }
    });
  }


  /** Get territory system for external access */
  getTerritorySystem(): TerritorySystem | null {
    return this.territoryManager?.getSystem() ?? null;
  }

  stop(): void {
    this.isRunning = false;
    this.territoryManager?.stop();
    this.network.disconnect();
  }
}

