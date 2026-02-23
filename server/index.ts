import { WebSocketServer, WebSocket } from 'ws';

// Game state
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

interface GameState {
  players: Map<string, Player>;
  collectedResources: Set<string>; // Set of resource IDs that have been collected
  buildings: Map<string, Building>;
}

const state: GameState = {
  players: new Map(),
  collectedResources: new Set(),
  buildings: new Map(),
};

// WebSocket server
const wss = new WebSocketServer({ port: 3005 });

// Map WebSocket to player ID
const wsToPlayer = new Map<WebSocket, string>();

console.log('🎮 Gallax server running on ws://localhost:3005');

wss.on('connection', (ws: WebSocket) => {
  const playerId = generateId();
  wsToPlayer.set(ws, playerId);
  
  console.log(`👤 Player ${playerId} connected (${state.players.size + 1} total)`);

  // Handle messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, playerId, message);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    const player = state.players.get(playerId);
    state.players.delete(playerId);
    wsToPlayer.delete(ws);
    
    // Notify others
    broadcast({ type: 'player_left', playerId });
    console.log(`👋 Player ${playerId} disconnected (${state.players.size} remaining)`);
  });
});

function handleMessage(ws: WebSocket, playerId: string, message: any) {
  switch (message.type) {
    case 'join':
      // Player joining the game
      const player: Player = {
        id: playerId,
        spriteNum: message.spriteNum || Math.floor(Math.random() * 125) + 1,
        lng: message.lng,
        lat: message.lat,
        name: message.name || `Player${playerId.slice(0, 4)}`,
      };
      state.players.set(playerId, player);
      
      // Send current game state to the new player
      ws.send(JSON.stringify({
        type: 'init',
        playerId,
        players: Array.from(state.players.values()),
        collectedResources: Array.from(state.collectedResources),
        buildings: Array.from(state.buildings.values()),
      }));
      
      // Notify others of new player
      broadcastExcept(ws, { type: 'player_joined', player });
      break;

    case 'move':
      // Player moved
      const p = state.players.get(playerId);
      if (p) {
        p.lng = message.lng;
        p.lat = message.lat;
        broadcastExcept(ws, { type: 'player_moved', playerId, lng: message.lng, lat: message.lat });
      }
      break;

    case 'collect':
      // Player collected a resource
      const resourceId = message.resourceId;
      if (!state.collectedResources.has(resourceId)) {
        state.collectedResources.add(resourceId);
        broadcast({ type: 'resource_collected', resourceId, playerId });
      }
      break;

    case 'place_building':
      // Player placed a building
      const building: Building = {
        id: generateId(),
        type: message.buildingType,
        lng: message.lng,
        lat: message.lat,
        ownerId: playerId,
        placedAt: Date.now(),
      };
      state.buildings.set(building.id, building);
      broadcast({ type: 'building_placed', building });
      break;

    case 'set_name':
      // Player changed their name
      console.log(`📛 Player ${playerId} setting name to "${message.name}"`);
      const playerToUpdate = state.players.get(playerId);
      if (playerToUpdate) {
        playerToUpdate.name = message.name || '';
        console.log(`📛 Broadcasting name change for ${playerId}: "${playerToUpdate.name}"`);
        broadcast({ type: 'player_name_changed', playerId, name: playerToUpdate.name });
      } else {
        console.log(`❌ Player ${playerId} not found in state`);
      }
      break;
  }
}

function broadcast(message: any) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function broadcastExcept(excludeWs: WebSocket, message: any) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

