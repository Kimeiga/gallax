import geckos, { GeckosServer, ServerChannel, Data } from '@geckos.io/server';
import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation';
import http from 'http';

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

// Game state
const players = new Map<string, Player>();
const collectedResources = new Map<string, number>(); // resourceId -> timestamp
const buildings = new Map<string, Building>();
const channels = new Map<string, ServerChannel>();

const RESOURCE_RESPAWN_TIME = 5 * 60 * 1000; // 5 minutes
const SNAPSHOT_RATE = 15; // 15 snapshots per second (~66ms)
const isProduction = process.env.NODE_ENV === 'production';

// Snapshot interpolation
const SI = new SnapshotInterpolation(SNAPSHOT_RATE);

// Create HTTP server
const server = http.createServer((req, res) => {
  // Log all WebRTC-related requests for debugging
  if (req.url?.includes('.wrtc')) {
    console.log(`📡 WebRTC request: ${req.method} ${req.url}`);
  }

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: players.size }));
    return;
  }
  res.writeHead(200);
  res.end('Gallax Game Server');
});

// Open Relay TURN servers (free) for when UDP is blocked
const openRelayIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// Create geckos.io server with TURN servers for reliable connectivity
// On Vultr VPS, we have full UDP port access - no need for multiplex
const io: GeckosServer = geckos({
  iceServers: openRelayIceServers,
  cors: {
    origin: '*',
    allowAuthorization: true
  },
  // Bind to 0.0.0.0 to accept connections from anywhere
  bindAddress: '0.0.0.0',
  // On traditional VPS, use port range for better WebRTC connectivity
  portRange: {
    min: 10000,
    max: 20000
  }
});

io.addServer(server);

console.log(`🔧 Environment: ${isProduction ? 'production' : 'development'}`);

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Generate a fun random name for players that's unique in the lobby
function generateUniqueRandomName(): string {
  const adjectives = [
    'Swift', 'Brave', 'Clever', 'Lucky', 'Wild', 'Noble', 'Cosmic', 'Mystic',
    'Fierce', 'Gentle', 'Silent', 'Golden', 'Crystal', 'Shadow', 'Storm',
    'Frozen', 'Blazing', 'Ancient', 'Mighty', 'Sneaky', 'Happy', 'Chill',
    'Epic', 'Pixel', 'Turbo', 'Ultra', 'Mega', 'Super', 'Hyper', 'Neon'
  ];
  const nouns = [
    'Fox', 'Wolf', 'Bear', 'Eagle', 'Tiger', 'Lion', 'Dragon', 'Phoenix',
    'Knight', 'Wizard', 'Ninja', 'Pirate', 'Ranger', 'Scout', 'Hunter',
    'Owl', 'Hawk', 'Raven', 'Panda', 'Koala', 'Otter', 'Penguin', 'Cat',
    'Explorer', 'Voyager', 'Wanderer', 'Nomad', 'Traveler', 'Seeker'
  ];

  // Get all existing names in the lobby
  const existingNames = new Set(Array.from(players.values()).map(p => p.name));

  // Try to generate a unique name (max 100 attempts to avoid infinite loop)
  for (let i = 0; i < 100; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    const name = `${adj}${noun}${num}`;

    if (!existingNames.has(name)) {
      return name;
    }
  }

  // Fallback: use timestamp to guarantee uniqueness
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}${Date.now() % 10000}`;
}

function cleanupExpiredResources(): void {
  const now = Date.now();
  for (const [id, timestamp] of collectedResources.entries()) {
    if (now - timestamp > RESOURCE_RESPAWN_TIME) {
      collectedResources.delete(id);
    }
  }
}

// Create world state snapshot for interpolation
function createSnapshot() {
  const state = Array.from(players.values()).map(p => ({
    id: p.id,
    x: p.lng,
    y: p.lat,
  }));
  return SI.snapshot.create(state);
}

// Broadcast snapshots at fixed rate
setInterval(() => {
  if (players.size > 0) {
    const snapshot = createSnapshot();
    io.emit('snapshot', snapshot, { reliable: false });
  }
}, 1000 / SNAPSHOT_RATE);

io.onConnection((channel: ServerChannel) => {
  const playerId = channel.id || generateId();
  channels.set(playerId, channel);
  console.log(`👤 Player ${playerId} connected (${channels.size} total)`);

  // Handle join - server always assigns a unique name
  channel.on('join', (data: Data) => {
    const msg = data as { spriteNum?: number; lng: number; lat: number };

    // Server assigns a unique name (ignore any client-provided name)
    const assignedName = generateUniqueRandomName();

    const player: Player = {
      id: playerId,
      spriteNum: msg.spriteNum || Math.floor(Math.random() * 125) + 1,
      lng: msg.lng,
      lat: msg.lat,
      name: assignedName,
    };
    players.set(playerId, player);
    cleanupExpiredResources();

    // Send init (reliable) - includes the assigned name
    channel.emit('init', {
      playerId,
      players: Array.from(players.values()),
      collectedResources: Array.from(collectedResources.keys()),
      buildings: Array.from(buildings.values()),
    }, { reliable: true });

    // Notify others
    channel.broadcast.emit('player_joined', { player }, { reliable: true });
    console.log(`🎮 ${player.name} joined (${players.size} players)`);
  });

  // Handle movement (unreliable for speed)
  channel.on('move', (data: Data) => {
    const msg = data as { lng: number; lat: number };
    const player = players.get(playerId);
    if (player) {
      player.lng = msg.lng;
      player.lat = msg.lat;
    }
  });

  // Handle resource collection (reliable)
  channel.on('collect', (data: Data) => {
    const msg = data as { resourceId: string };
    cleanupExpiredResources();
    if (!collectedResources.has(msg.resourceId)) {
      collectedResources.set(msg.resourceId, Date.now());
      io.emit('resource_collected', { resourceId: msg.resourceId, playerId }, { reliable: true });
    }
  });

  // Handle building placement (reliable)
  channel.on('place_building', (data: Data) => {
    const msg = data as { buildingType: string; lng: number; lat: number };
    const building: Building = {
      id: generateId(),
      type: msg.buildingType,
      lng: msg.lng,
      lat: msg.lat,
      ownerId: playerId,
      placedAt: Date.now(),
    };
    buildings.set(building.id, building);
    io.emit('building_placed', { building }, { reliable: true });
  });

  // Handle name change (reliable)
  channel.on('set_name', (data: Data) => {
    const msg = data as { name: string };
    const player = players.get(playerId);
    if (player) {
      player.name = msg.name || '';
      io.emit('player_name_changed', { playerId, name: player.name }, { reliable: true });
    }
  });

  // Handle disconnect
  channel.onDisconnect(() => {
    players.delete(playerId);
    channels.delete(playerId);
    io.emit('player_left', { playerId }, { reliable: true });
    console.log(`👋 Player ${playerId} left (${channels.size} remaining)`);
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`🎮 Gallax geckos.io server running on port ${PORT}`);
});

