import { DurableObject } from 'cloudflare:workers';

// Types
interface Player {
  id: string;
  spriteNum: number;
  lng: number;
  lat: number;
  name: string;
}

interface Building {
  id: string;
  type: string;
  lng: number;
  lat: number;
  ownerId: string;
  placedAt: number;
}

// Attachment stored per WebSocket (survives hibernation)
interface WebSocketAttachment {
  playerId: string;
  player?: Player; // Full player data stored on WebSocket
}

export interface Env {
  GAME_SERVER: DurableObjectNamespace<GameServer>;
  ENVIRONMENT: string;
}

// Main Worker - routes requests to Durable Object
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade requests go to the game server
    // Accept both /websocket path and any WebSocket upgrade
    if (url.pathname === '/websocket' || request.headers.get('Upgrade') === 'websocket') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      // Use a single global Durable Object for the game
      const id = env.GAME_SERVER.idFromName('global-game');
      const stub = env.GAME_SERVER.get(id);
      return stub.fetch(request);
    }

    // All other requests are handled by the static assets (configured in wrangler.toml)
    // This shouldn't be reached as assets are served automatically
    return new Response('Not Found', { status: 404 });
  },
};

// Durable Object - maintains game state and WebSocket connections
// Uses Hibernation API: player data is stored in WebSocket attachments to survive hibernation
export class GameServer extends DurableObject<Env> {
  // These are rebuilt from WebSocket attachments after hibernation
  private collectedResources: Map<string, number> = new Map(); // resourceId -> timestamp (volatile, OK to lose)
  private buildings: Map<string, Building> = new Map(); // TODO: persist to storage for durability
  private readonly RESOURCE_RESPAWN_TIME = 5 * 60 * 1000; // 5 minutes

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // Get all connected players from WebSocket attachments (survives hibernation)
  private getConnectedPlayers(): Player[] {
    const players: Player[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      if (attachment?.player) {
        players.push(attachment.player);
      }
    }
    return players;
  }

  // Get a player by ID from WebSocket attachments
  private getPlayer(playerId: string): { ws: WebSocket; player: Player } | null {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      if (attachment?.playerId === playerId && attachment.player) {
        return { ws, player: attachment.player };
      }
    }
    return null;
  }

  // Update a player's data in the WebSocket attachment
  private updatePlayer(playerId: string, updates: Partial<Player>): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      if (attachment?.playerId === playerId && attachment.player) {
        attachment.player = { ...attachment.player, ...updates };
        ws.serializeAttachment(attachment);
        break;
      }
    }
  }

  private cleanupExpiredResources(): void {
    const now = Date.now();
    for (const [resourceId, timestamp] of this.collectedResources.entries()) {
      if (now - timestamp > this.RESOURCE_RESPAWN_TIME) {
        this.collectedResources.delete(resourceId);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection with hibernation support
    this.ctx.acceptWebSocket(server);

    // Generate player ID and store in attachment (survives hibernation)
    const playerId = this.generateId();
    const attachment: WebSocketAttachment = { playerId };
    server.serializeAttachment(attachment);

    const totalConnections = this.ctx.getWebSockets().length;
    console.log(`👤 Player ${playerId} connected (${totalConnections} total)`);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Called when a message is received from a WebSocket
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    const { playerId } = attachment;

    try {
      const data = JSON.parse(message as string);
      this.handleMessage(ws, playerId, data, attachment);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }

  // Called when a WebSocket connection is closed
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    const { playerId } = attachment;
    const remaining = this.ctx.getWebSockets().length - 1;

    this.broadcast({ type: 'player_left', playerId });
    console.log(`👋 Player ${playerId} disconnected (${remaining} remaining)`);

    ws.close(code, reason);
  }

  // Called on WebSocket error
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  private handleMessage(ws: WebSocket, playerId: string, message: any, attachment: WebSocketAttachment): void {
    switch (message.type) {
      case 'join':
        // Create player and store in WebSocket attachment (survives hibernation)
        const player: Player = {
          id: playerId,
          spriteNum: message.spriteNum || Math.floor(Math.random() * 125) + 1,
          lng: message.lng,
          lat: message.lat,
          name: message.name || `Player${playerId.slice(0, 4)}`,
        };

        // Store player data in attachment
        attachment.player = player;
        ws.serializeAttachment(attachment);

        // Clean up expired resources before sending state
        this.cleanupExpiredResources();

        // Get all connected players (including self)
        const allPlayers = this.getConnectedPlayers();
        console.log(`🎮 Player ${player.name} (${playerId}) joined. Total: ${allPlayers.length} players`);

        ws.send(JSON.stringify({
          type: 'init',
          playerId,
          players: allPlayers,
          collectedResources: Array.from(this.collectedResources.keys()),
          buildings: Array.from(this.buildings.values()),
        }));

        // Notify others
        this.broadcastExcept(playerId, { type: 'player_joined', player });
        break;

      case 'move':
        // Update player position in attachment
        if (attachment.player) {
          attachment.player.lng = message.lng;
          attachment.player.lat = message.lat;
          ws.serializeAttachment(attachment);
          this.broadcastExcept(playerId, { type: 'player_moved', playerId, lng: message.lng, lat: message.lat });
        }
        break;

      case 'collect':
        // Clean up expired resources
        this.cleanupExpiredResources();

        if (!this.collectedResources.has(message.resourceId)) {
          this.collectedResources.set(message.resourceId, Date.now());
          this.broadcast({ type: 'resource_collected', resourceId: message.resourceId, playerId });
        }
        break;

      case 'place_building':
        const building: Building = {
          id: this.generateId(),
          type: message.buildingType,
          lng: message.lng,
          lat: message.lat,
          ownerId: playerId,
          placedAt: Date.now(),
        };
        this.buildings.set(building.id, building);
        this.broadcast({ type: 'building_placed', building });
        break;

      case 'set_name':
        // Update player name in attachment
        if (attachment.player) {
          attachment.player.name = message.name || '';
          ws.serializeAttachment(attachment);
          this.broadcast({ type: 'player_name_changed', playerId, name: attachment.player.name });
        }
        break;
    }
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch (e) {
        // Connection might be closed
      }
    }
  }

  private broadcastExcept(excludePlayerId: string, message: any): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
      if (attachment?.playerId !== excludePlayerId) {
        try {
          ws.send(data);
        } catch (e) {
          // Connection might be closed
        }
      }
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}

