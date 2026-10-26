// Geckos.io network manager for low-latency multiplayer
import { createEventClient, type EventClient as ClientChannel } from 'twinwire/client';
import type { Json as Data } from 'twinwire';
import CONTRACT from '../../geckos-server/src/contract.json';
import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation';

// Define Entity type for snapshot interpolation
interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface NetworkPlayer {
  id: string;
  spriteNum: number;
  lng: number;
  lat: number;
  name: string;
}

export interface NetworkBuilding {
  id: string;
  type: string;
  lng: number;
  lat: number;
  ownerId: string;
  ownerName?: string;
  placedAt: number;
  rotation: number; // Rotation in radians
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// Input record for client-side prediction
interface InputRecord {
  seq: number;           // Sequence number
  timestamp: number;     // When input was applied
  inputX: number;        // Input direction X
  inputY: number;        // Input direction Y
  deltaTime: number;     // Delta time when applied
  predictedLng: number;  // Predicted position after applying
  predictedLat: number;
}

// Position correction callback type
export type PositionCorrectionCallback = (lng: number, lat: number, inputsToReapply: InputRecord[]) => void;

export type MessageHandler = {
  onInit: (playerId: string, players: NetworkPlayer[], collectedResources: string[], buildings: NetworkBuilding[], resumedPosition?: { lng: number; lat: number }) => void;
  onPlayerJoined: (player: NetworkPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerMoved: (playerId: string, lng: number, lat: number) => void;
  onPlayerNameChanged: (playerId: string, name: string) => void;
  onResourceCollected: (resourceId: string, playerId: string) => void;
  onBuildingPlaced: (building: NetworkBuilding) => void;
  onBuildingRotated?: (buildingId: string, rotation: number) => void;
  onBuildingMoved?: (buildingId: string, lng: number, lat: number) => void;
  onBuildingDeleted?: (buildingId: string) => void;
  onHomeStyleUpdated?: (buildingId: string, emoji?: string, tint?: string) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onSnapshot?: (snapshot: unknown) => void;
  onPositionCorrection?: PositionCorrectionCallback;
  onPixelPlaced?: (x: number, y: number, color: string, authorId: string, authorName: string) => void;
  onPixelErased?: (x: number, y: number) => void;
  onPixelBatchPlaced?: (pixels: { x: number; y: number; color: string }[], authorId: string, authorName: string) => void;
  onSpriteChanged?: (playerId: string, spriteNum: number) => void;
  onFurniturePlaced?: (homeId: string, item: any) => void;
  onFurnitureDeleted?: (homeId: string, furnitureId: string) => void;
  onFurnitureMoved?: (homeId: string, furnitureId: string, x: number, y: number, rotation?: number, scale?: number) => void;
  onMobKilled?: (mobId: string, killedBy: string) => void;
  onCombatStarted?: (mobId: string, playerId: string) => void;
  onTerritoryClaimed?: (playerId: string, playerName: string, cells: string[], color: string) => void;
  onPlayerEnteredHome?: (playerId: string, homeId: string, spriteNum: number, playerName: string) => void;
  onPlayerExitedHome?: (playerId: string, homeId: string) => void;
  onPlayerHomeMoved?: (playerId: string, homeId: string, x: number, y: number) => void;
};

const SNAPSHOT_RATE = 15;
const INPUT_BUFFER_SIZE = 128; // Keep last N inputs for reconciliation
const POSITION_TOLERANCE = 0.000005; // ~0.5 meters - threshold for correction

export class TwinwireNetworkManager {
  private channel: ClientChannel | null = null;
  private handlers: MessageHandler | null = null;
  private playerId: string | null = null;
  private serverUrl: string;
  private SI: SnapshotInterpolation;
  private connected = false;

  // Client-side prediction state
  private inputSequence = 0;
  private inputBuffer: InputRecord[] = [];
  private lastAcknowledgedSeq = -1;
  private serverPosition: { lng: number; lat: number } | null = null;

  constructor(serverUrl?: string) {
    this.SI = new SnapshotInterpolation(SNAPSHOT_RATE);

    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else {
      // Production: Use game.kimu.nyc with proper SSL
      const isProduction = window.location.hostname !== 'localhost' &&
                           window.location.hostname !== '127.0.0.1';
      if (isProduction) {
        // Custom domain with Let's Encrypt SSL via Caddy
        this.serverUrl = 'https://game.kimu.nyc';
      } else {
        this.serverUrl = 'http://localhost:3000';
      }
    }
    console.log(`🦎 Geckos URL: ${this.serverUrl}`);
  }

  connect(handlers: MessageHandler): Promise<void> {
    this.handlers = handlers;
    const configured = import.meta.env.VITE_TWINWIRE_URL?.trim();
    const endpoint = new URL(configured || this.serverUrl.replace(/\/?$/, '/') + 'connect');
    if(endpoint.protocol === 'https:') endpoint.protocol = 'wss:';
    if(endpoint.protocol === 'http:') endpoint.protocol = 'ws:';
    this.channel = createEventClient({
      url:endpoint.href, room:CONTRACT.namespace, latest:CONTRACT.latest, stateMaxAgeMs:500,
      rtc:new URLSearchParams(location.search).get('rtc')==='0'?false:undefined,
    });
    this.channel.net.bindPageLifecycle();
    this.channel.onPause = () => { this.connected = false; };
    this.channel.onReset = () => {
      this.SI = new SnapshotInterpolation(SNAPSHOT_RATE);
      this.inputBuffer = [];
    };
    this.channel.onDisconnect(() => { this.connected = false; });
    this.setupListeners();
    return new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(new Error('Connection is still retrying; check the game server')),30000);
      this.channel!.onConnect(error=>{
        if(error){clearTimeout(timer);reject(error);return;}
        this.connected=true;clearTimeout(timer);resolve();
      });
    });
  }

  private setupListeners() {
    if (!this.channel || !this.handlers) return;

    this.channel.on('init', (data: Data) => {
      const msg = data as { playerId: string; players: NetworkPlayer[]; collectedResources: string[]; buildings: NetworkBuilding[]; resumedPosition?: { lng: number; lat: number } };
      this.playerId = msg.playerId;
      this.handlers!.onInit(msg.playerId, msg.players, msg.collectedResources, msg.buildings, msg.resumedPosition);
    });

    this.channel.on('player_joined', (data: Data) => {
      const msg = data as { player: NetworkPlayer };
      this.handlers!.onPlayerJoined(msg.player);
    });

    this.channel.on('player_left', (data: Data) => {
      const msg = data as { playerId: string };
      this.handlers!.onPlayerLeft(msg.playerId);
    });

    this.channel.on('player_name_changed', (data: Data) => {
      const msg = data as { playerId: string; name: string };
      this.handlers!.onPlayerNameChanged(msg.playerId, msg.name);
    });

    this.channel.on('resource_collected', (data: Data) => {
      const msg = data as { resourceId: string; playerId: string };
      this.handlers!.onResourceCollected(msg.resourceId, msg.playerId);
    });

    this.channel.on('building_placed', (data: Data) => {
      const msg = data as { building: NetworkBuilding };
      this.handlers!.onBuildingPlaced(msg.building);
    });

    this.channel.on('building_rotated', (data: Data) => {
      const msg = data as { buildingId: string; rotation: number };
      if (this.handlers!.onBuildingRotated) {
        this.handlers!.onBuildingRotated(msg.buildingId, msg.rotation);
      }
    });

    this.channel.on('building_moved', (data: Data) => {
      const msg = data as { buildingId: string; lng: number; lat: number };
      if (this.handlers!.onBuildingMoved) {
        this.handlers!.onBuildingMoved(msg.buildingId, msg.lng, msg.lat);
      }
    });

    this.channel.on('building_deleted', (data: Data) => {
      const msg = data as { buildingId: string };
      if (this.handlers!.onBuildingDeleted) {
        this.handlers!.onBuildingDeleted(msg.buildingId);
      }
    });

    this.channel.on('home_style_updated', (data: Data) => {
      const msg = data as { buildingId: string; emoji?: string; tint?: string; playerId: string };
      if (this.handlers!.onHomeStyleUpdated) {
        this.handlers!.onHomeStyleUpdated(msg.buildingId, msg.emoji, msg.tint);
      }
    });

    // Chat messages
    this.channel.on('chat_message', (data: Data) => {
      const msg = data as ChatMessage;
      if (this.handlers!.onChatMessage) {
        this.handlers!.onChatMessage(msg);
      }
    });

    // Pixel drawing events
    this.channel.on('pixel_placed', (data: Data) => {
      const msg = data as { x: number; y: number; color: string; authorId: string; authorName: string };
      if (this.handlers!.onPixelPlaced) {
        this.handlers!.onPixelPlaced(msg.x, msg.y, msg.color, msg.authorId, msg.authorName);
      }
    });

    this.channel.on('pixel_erased', (data: Data) => {
      const msg = data as { x: number; y: number };
      if (this.handlers!.onPixelErased) {
        this.handlers!.onPixelErased(msg.x, msg.y);
      }
    });

    this.channel.on('pixel_batch_placed', (data: Data) => {
      const msg = data as { pixels: { x: number; y: number; color: string }[]; authorId: string; authorName: string };
      if (this.handlers!.onPixelBatchPlaced) {
        this.handlers!.onPixelBatchPlaced(msg.pixels, msg.authorId, msg.authorName);
      }
    });

    // Sprite change from other players
    this.channel.on('sprite_changed', (data: Data) => {
      const msg = data as { playerId: string; spriteNum: number };
      if (this.handlers!.onSpriteChanged) {
        this.handlers!.onSpriteChanged(msg.playerId, msg.spriteNum);
      }
    });

    // Furniture sync events
    this.channel.on('furniture_placed', (data: Data) => {
      const msg = data as { homeId: string; item: any };
      if (this.handlers!.onFurniturePlaced) {
        this.handlers!.onFurniturePlaced(msg.homeId, msg.item);
      }
    });

    this.channel.on('furniture_deleted', (data: Data) => {
      const msg = data as { homeId: string; furnitureId: string };
      if (this.handlers!.onFurnitureDeleted) {
        this.handlers!.onFurnitureDeleted(msg.homeId, msg.furnitureId);
      }
    });

    this.channel.on('furniture_moved', (data: Data) => {
      const msg = data as { homeId: string; furnitureId: string; x: number; y: number; rotation?: number; scale?: number };
      if (this.handlers!.onFurnitureMoved) {
        this.handlers!.onFurnitureMoved(msg.homeId, msg.furnitureId, msg.x, msg.y, msg.rotation, msg.scale);
      }
    });

    // Combat events
    this.channel.on('mob_killed', (data: Data) => {
      const msg = data as { mobId: string; killedBy: string };
      if (this.handlers!.onMobKilled) {
        this.handlers!.onMobKilled(msg.mobId, msg.killedBy);
      }
    });

    this.channel.on('combat_started', (data: Data) => {
      const msg = data as { mobId: string; playerId: string };
      if (this.handlers!.onCombatStarted) {
        this.handlers!.onCombatStarted(msg.mobId, msg.playerId);
      }
    });

    // Territory events
    this.channel.on('territory_claimed', (data: Data) => {
      const msg = data as { playerId: string; playerName: string; cells: string[]; color: string };
      if (this.handlers!.onTerritoryClaimed) {
        this.handlers!.onTerritoryClaimed(msg.playerId, msg.playerName, msg.cells, msg.color);
      }
    });

    // Home room presence
    this.channel.on('player_entered_home', (data: Data) => {
      const msg = data as { playerId: string; homeId: string; spriteNum: number; playerName: string };
      if (this.handlers!.onPlayerEnteredHome) {
        this.handlers!.onPlayerEnteredHome(msg.playerId, msg.homeId, msg.spriteNum, msg.playerName);
      }
    });

    this.channel.on('player_exited_home', (data: Data) => {
      const msg = data as { playerId: string; homeId: string };
      if (this.handlers!.onPlayerExitedHome) {
        this.handlers!.onPlayerExitedHome(msg.playerId, msg.homeId);
      }
    });

    this.channel.on('player_home_moved', (data: Data) => {
      const msg = data as { playerId: string; homeId: string; x: number; y: number };
      if (this.handlers!.onPlayerHomeMoved) {
        this.handlers!.onPlayerHomeMoved(msg.playerId, msg.homeId, msg.x, msg.y);
      }
    });

    // Position acknowledgment for client-side prediction reconciliation
    this.channel.on('position_ack', (data: Data) => {
      const msg = data as { lng: number; lat: number; seq: number };
      this.handlePositionAck(msg.lng, msg.lat, msg.seq);
    });

    // Snapshot interpolation for smooth movement
    this.channel.on('snapshot', (data: Data) => {
      const snapshot = data as unknown;
      this.SI.snapshot.add(snapshot as Parameters<typeof this.SI.snapshot.add>[0]);

      // Extract interpolated positions and update players
      const interpolated = this.SI.calcInterpolation('x y');
      if (interpolated?.state) {
        const entities = interpolated.state as unknown as Entity[];
        for (const entity of entities) {
          // Don't update our own position
          if (entity.id !== this.playerId) {
            this.handlers!.onPlayerMoved(entity.id, entity.x, entity.y);
          }
        }
      }

      if (this.handlers!.onSnapshot) {
        this.handlers!.onSnapshot(snapshot);
      }
    });
  }

  // Get interpolated positions from snapshot buffer
  getInterpolatedState(): Entity[] | null {
    if(!this.channel?.ready('snapshot'))return null;
    const snapshot = this.SI.calcInterpolation('x y');
    if (!snapshot?.state) return null;
    // Cast to our Entity type
    return snapshot.state as unknown as Entity[];
  }

  join(lng: number, lat: number, spriteNum: number, name?: string, authId?: string) {
    this.channel?.emit('join', { lng, lat, spriteNum, name, authId });
  }

  // Record input and send move with sequence number for prediction
  move(lng: number, lat: number, inputX: number, inputY: number, deltaTime: number) {
    const seq = this.inputSequence++;

    // Record input for potential reconciliation
    const inputRecord: InputRecord = {
      seq,
      timestamp: Date.now(),
      inputX,
      inputY,
      deltaTime,
      predictedLng: lng,
      predictedLat: lat,
    };

    // Add to buffer, remove old entries
    this.inputBuffer.push(inputRecord);
    if (this.inputBuffer.length > INPUT_BUFFER_SIZE) {
      this.inputBuffer.shift();
    }

    // Send to server with sequence number
    this.channel?.emit('move', { lng, lat, seq });
  }

  // Handle server position acknowledgment and perform reconciliation
  handlePositionAck(serverLng: number, serverLat: number, lastProcessedSeq: number) {
    this.serverPosition = { lng: serverLng, lat: serverLat };

    // Find the acknowledged input in our buffer
    const ackIndex = this.inputBuffer.findIndex(input => input.seq === lastProcessedSeq);

    if (ackIndex === -1) {
      // Server is acknowledging a sequence we already cleared - just update position
      this.lastAcknowledgedSeq = lastProcessedSeq;
      return;
    }

    // Get our predicted position at the time of the acknowledged input
    const ackedInput = this.inputBuffer[ackIndex];

    // Calculate position difference
    const dx = Math.abs(serverLng - ackedInput.predictedLng);
    const dy = Math.abs(serverLat - ackedInput.predictedLat);
    const positionDiff = Math.sqrt(dx * dx + dy * dy);

    // Remove all inputs up to and including the acknowledged one
    const inputsToReapply = this.inputBuffer.slice(ackIndex + 1);
    this.inputBuffer = inputsToReapply;
    this.lastAcknowledgedSeq = lastProcessedSeq;

    // If position differs beyond tolerance, we need to reconcile
    if (positionDiff > POSITION_TOLERANCE) {
      console.log(`🔄 Reconciling: diff=${positionDiff.toFixed(8)}, reapply=${inputsToReapply.length} inputs`);

      // Notify Game.ts to correct position and re-apply inputs
      if (this.handlers?.onPositionCorrection) {
        this.handlers.onPositionCorrection(serverLng, serverLat, inputsToReapply);
      }
    }
  }

  collectResource(resourceId: string) {
    this.channel?.emit('collect', { resourceId });
  }

  placeBuilding(buildingType: string, lng: number, lat: number) {
    this.channel?.emit('place_building', { buildingType, lng, lat });
  }

  rotateBuilding(buildingId: string, rotation: number) {
    this.channel?.emit('rotate_building', { buildingId, rotation });
  }

  moveBuilding(buildingId: string, lng: number, lat: number) {
    this.channel?.emit('move_building', { buildingId, lng, lat });
  }

  deleteBuilding(buildingId: string) {
    this.channel?.emit('delete_building', { buildingId });
  }

  updateHomeStyle(buildingId: string, emoji?: string, tint?: string) {
    this.channel?.emit('update_home_style', { buildingId, emoji, tint });
  }

  // Combat
  notifyMobKilled(mobId: string) {
    this.channel?.emit('mob_killed', { mobId });
  }

  notifyCombatStarted(mobId: string) {
    this.channel?.emit('combat_started', { mobId });
  }

  // Territory
  claimTerritory(cells: string[], color: string, playerName: string) {
    this.channel?.emit('territory_claim', { cells, color, playerName });
  }

  // Home room presence
  enterHome(homeId: string, spriteNum: number, playerName: string) {
    this.channel?.emit('enter_home', { homeId, spriteNum, playerName });
  }

  exitHome() {
    this.channel?.emit('exit_home', {});
  }

  homeMove(homeId: string, x: number, y: number) {
    this.channel?.emit('home_move', { homeId, x, y });
  }

  setName(name: string) {
    this.channel?.emit('set_name', { name });
  }

  // Pixel drawing
  placePixel(x: number, y: number, color: string, authorName: string) {
    this.channel?.emit('pixel_place', { x, y, color, authorName });
  }

  erasePixel(x: number, y: number) {
    this.channel?.emit('pixel_erase', { x, y });
  }

  placePixelBatch(pixels: { x: number; y: number; color: string }[], authorName: string) {
    this.channel?.emit('pixel_batch', { pixels, authorName });
  }

  sendChat(message: string) {
    this.channel?.emit('chat', { message });
  }

  changeSprite(spriteNum: number) {
    this.channel?.emit('change_sprite', { spriteNum });
  }

  placeFurniture(homeId: string, item: { id: string; emoji: string; x: number; y: number }) {
    this.channel?.emit('furniture_placed', { homeId, item });
  }

  deleteFurniture(homeId: string, furnitureId: string) {
    this.channel?.emit('furniture_deleted', { homeId, furnitureId });
  }

  moveFurniture(homeId: string, furnitureId: string, x: number, y: number, rotation?: number, scale?: number) {
    this.channel?.emit('furniture_moved', { homeId, furnitureId, x, y, rotation, scale });
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    this.channel?.close();
    this.connected = false;
  }
}
