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

interface Session {
  id: string;
  ws: WebSocket;
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
export class GameServer extends DurableObject<Env> {
  private sessions: Map<string, Session> = new Map();
  private players: Map<string, Player> = new Map();
  private collectedResources: Set<string> = new Set();
  private buildings: Map<string, Building> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Generate player ID and store session
    const playerId = this.generateId();
    server.serializeAttachment({ playerId });
    this.sessions.set(playerId, { id: playerId, ws: server });

    console.log(`👤 Player ${playerId} connected (${this.sessions.size} total)`);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Called when a message is received from a WebSocket
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const { playerId } = ws.deserializeAttachment() as { playerId: string };
    
    try {
      const data = JSON.parse(message as string);
      this.handleMessage(ws, playerId, data);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }

  // Called when a WebSocket connection is closed
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const { playerId } = ws.deserializeAttachment() as { playerId: string };
    
    this.sessions.delete(playerId);
    this.players.delete(playerId);
    
    this.broadcast({ type: 'player_left', playerId });
    console.log(`👋 Player ${playerId} disconnected (${this.sessions.size} remaining)`);
    
    ws.close(code, reason);
  }

  // Called on WebSocket error
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    const { playerId } = ws.deserializeAttachment() as { playerId: string };
    this.sessions.delete(playerId);
    this.players.delete(playerId);
  }

  private handleMessage(ws: WebSocket, playerId: string, message: any): void {
    switch (message.type) {
      case 'join':
        const player: Player = {
          id: playerId,
          spriteNum: message.spriteNum || Math.floor(Math.random() * 125) + 1,
          lng: message.lng,
          lat: message.lat,
          name: message.name || `Player${playerId.slice(0, 4)}`,
        };
        this.players.set(playerId, player);

        // Send current game state to the new player
        ws.send(JSON.stringify({
          type: 'init',
          playerId,
          players: Array.from(this.players.values()),
          collectedResources: Array.from(this.collectedResources),
          buildings: Array.from(this.buildings.values()),
        }));

        // Notify others
        this.broadcastExcept(playerId, { type: 'player_joined', player });
        break;

      case 'move':
        const p = this.players.get(playerId);
        if (p) {
          p.lng = message.lng;
          p.lat = message.lat;
          this.broadcastExcept(playerId, { type: 'player_moved', playerId, lng: message.lng, lat: message.lat });
        }
        break;

      case 'collect':
        if (!this.collectedResources.has(message.resourceId)) {
          this.collectedResources.add(message.resourceId);
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
        const playerToUpdate = this.players.get(playerId);
        if (playerToUpdate) {
          playerToUpdate.name = message.name || '';
          this.broadcast({ type: 'player_name_changed', playerId, name: playerToUpdate.name });
        }
        break;
    }
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      try {
        session.ws.send(data);
      } catch (e) {
        // Connection might be closed
      }
    }
  }

  private broadcastExcept(excludePlayerId: string, message: any): void {
    const data = JSON.stringify(message);
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      if (session.id !== excludePlayerId) {
        try {
          session.ws.send(data);
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

