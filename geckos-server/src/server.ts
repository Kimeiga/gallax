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
  currentHome: string | null;
  homeSprite: number;
}

interface Building {
  id: string;
  type: string;
  lng: number;
  lat: number;
  ownerId: string;
  placedAt: number;
  rotation: number; // Rotation in radians
}

// Game state
const players = new Map<string, Player>();
const collectedResources = new Map<string, number>(); // resourceId -> timestamp
const buildings = new Map<string, Building>();
const channels = new Map<string, ServerChannel>();
const lastProcessedSeq = new Map<string, number>(); // playerId -> last sequence number
const authToPlayer = new Map<string, string>(); // authId -> playerId (for session dedup)

const RESOURCE_RESPAWN_TIME = 5 * 60 * 1000; // 5 minutes
const SNAPSHOT_RATE = 15; // 15 snapshots per second (~66ms)
const POSITION_ACK_RATE = 10; // Send position acks 10 times per second
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
const io: GeckosServer = geckos({
  iceServers: openRelayIceServers,
  cors: {
    origin: '*',
    allowAuthorization: true
  },
  bindAddress: '0.0.0.0',
  portRange: {
    min: 10000,
    max: 20000
  },
  // ordered: true improves iOS Safari WebRTC data channel compatibility
  ordered: true,
});

/**
 * Safe emit wrapper — catches per-channel send failures (e.g. iOS Safari
 * disconnecting mid-broadcast) so one broken channel doesn't kill everyone.
 */
function safeEmit(emitter: any, event: string, data: any, opts?: any): void {
  try {
    emitter.emit(event, data, opts);
  } catch (err: any) {
    console.warn(`⚠️ Emit "${event}" failed: ${err.message || err}`);
  }
}

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
    safeEmit(io,'snapshot', snapshot, { reliable: false });
  }
}, 1000 / SNAPSHOT_RATE);

// Send position acknowledgments to each player for reconciliation
setInterval(() => {
  for (const [playerId, channel] of channels.entries()) {
    const player = players.get(playerId);
    const seq = lastProcessedSeq.get(playerId);

    // Only send if we have a player and a sequence number
    if (player && typeof seq === 'number') {
      safeEmit(channel,'position_ack', {
        lng: player.lng,
        lat: player.lat,
        seq: seq,
      }, { reliable: false });
    }
  }
}, 1000 / POSITION_ACK_RATE);

io.onConnection((channel: ServerChannel) => {
  const playerId = channel.id || generateId();
  channels.set(playerId, channel);
  console.log(`👤 Player ${playerId} connected (${channels.size} total)`);

  // Handle join - use client name if provided, otherwise generate one
  channel.on('join', (data: Data) => {
    const msg = data as { spriteNum?: number; lng: number; lat: number; name?: string; authId?: string };

    const authId = msg.authId || '';
    let resumedPosition: { lng: number; lat: number } | undefined;

    // Session dedup: if this auth ID is already connected, take over that session
    if (authId && authToPlayer.has(authId)) {
      const oldPlayerId = authToPlayer.get(authId)!;
      const oldPlayer = players.get(oldPlayerId);

      if (oldPlayer && oldPlayerId !== playerId) {
        console.log(`🔄 ${msg.name || 'Player'} reconnecting (auth ${authId.slice(0, 8)}...) — taking over from ${oldPlayerId}`);

        // Save the old position so the new client starts where they left off
        resumedPosition = { lng: oldPlayer.lng, lat: oldPlayer.lat };

        // Disconnect the old channel
        const oldChannel = channels.get(oldPlayerId);
        if (oldChannel) {
          safeEmit(oldChannel, 'session_taken_over', {}, { reliable: true });
          try { oldChannel.close(); } catch {}
        }

        // Clean up old player
        channels.delete(oldPlayerId);
        players.delete(oldPlayerId);
        lastProcessedSeq.delete(oldPlayerId);
        safeEmit(channel.broadcast, 'player_left', { playerId: oldPlayerId }, { reliable: true });
      }
    }

    // Use client-provided name if available, otherwise generate a unique one
    const assignedName = msg.name || generateUniqueRandomName();

    const player: Player = {
      id: playerId,
      spriteNum: msg.spriteNum || Math.floor(Math.random() * 125) + 1,
      lng: resumedPosition?.lng ?? msg.lng,
      lat: resumedPosition?.lat ?? msg.lat,
      name: assignedName,
      currentHome: null,
      homeSprite: 1,
    };
    players.set(playerId, player);

    // Track auth ID for future dedup
    if (authId) {
      authToPlayer.set(authId, playerId);
    }

    cleanupExpiredResources();

    // Send init (reliable) - includes the assigned name + resumed position if any
    safeEmit(channel,'init', {
      playerId,
      players: Array.from(players.values()),
      collectedResources: Array.from(collectedResources.keys()),
      buildings: Array.from(buildings.values()),
      resumedPosition,
    }, { reliable: true });

    // Notify others
    safeEmit(channel.broadcast,'player_joined', { player }, { reliable: true });
    console.log(`🎮 ${player.name} joined (${players.size} players)${resumedPosition ? ' [resumed]' : ''}`);
  });

  // Handle movement with sequence tracking for client-side prediction
  channel.on('move', (data: Data) => {
    const msg = data as { lng: number; lat: number; seq?: number };
    const player = players.get(playerId);
    if (player) {
      player.lng = msg.lng;
      player.lat = msg.lat;

      // Track the last processed sequence number for this player
      if (typeof msg.seq === 'number') {
        lastProcessedSeq.set(playerId, msg.seq);
      }
    }
  });

  // Handle resource collection (reliable)
  channel.on('collect', (data: Data) => {
    const msg = data as { resourceId: string };
    cleanupExpiredResources();
    if (!collectedResources.has(msg.resourceId)) {
      collectedResources.set(msg.resourceId, Date.now());
      safeEmit(io,'resource_collected', { resourceId: msg.resourceId, playerId }, { reliable: true });
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
      rotation: 0, // Default rotation
    };
    buildings.set(building.id, building);
    const ownerName = players.get(playerId)?.name;
    safeEmit(io,'building_placed', { building: { ...building, ownerName } }, { reliable: true });
  });

  // Handle building rotation (reliable) - ownership checked when server has the building
  channel.on('rotate_building', (data: Data) => {
    const msg = data as { buildingId: string; rotation: number };
    const building = buildings.get(msg.buildingId);
    if (building) {
      if (building.ownerId !== playerId) return; // reject unauthorized rotation
      building.rotation = msg.rotation;
    }
    // Buildings from previous sessions aren't in memory — relay through (best-effort)
    safeEmit(io,'building_rotated', { buildingId: msg.buildingId, rotation: msg.rotation }, { reliable: true });
  });

  // Handle building movement (reliable) - ownership checked when server has the building
  channel.on('move_building', (data: Data) => {
    const msg = data as { buildingId: string; lng: number; lat: number };
    const building = buildings.get(msg.buildingId);
    if (building) {
      if (building.ownerId !== playerId) return; // reject unauthorized move
      building.lng = msg.lng;
      building.lat = msg.lat;
    }
    safeEmit(io,'building_moved', { buildingId: msg.buildingId, lng: msg.lng, lat: msg.lat }, { reliable: true });
  });

  // Handle building delete (reliable) - ownership checked when server has the building
  channel.on('delete_building', (data: Data) => {
    const msg = data as { buildingId: string };
    const building = buildings.get(msg.buildingId);
    if (building && building.ownerId !== playerId) return; // reject unauthorized delete
    buildings.delete(msg.buildingId);
    safeEmit(io,'building_deleted', { buildingId: msg.buildingId }, { reliable: true });
  });

  // Handle home style change (emoji/tint)
  channel.on('update_home_style', (data: Data) => {
    const msg = data as { buildingId: string; emoji?: string; tint?: string };
    safeEmit(io,'home_style_updated', { ...msg, playerId }, { reliable: true });
  });

  // Handle mob kill (broadcast to all so other clients remove the mob)
  channel.on('mob_killed', (data: Data) => {
    const msg = data as { mobId: string };
    safeEmit(io,'mob_killed', { mobId: msg.mobId, killedBy: playerId }, { reliable: true });
  });

  // Handle combat start (so others can see the combat)
  channel.on('combat_started', (data: Data) => {
    const msg = data as { mobId: string };
    safeEmit(io,'combat_started', { mobId: msg.mobId, playerId }, { reliable: true });
  });

  // Handle home room presence
  channel.on('enter_home', (data: Data) => {
    const msg = data as { homeId: string; spriteNum: number; playerName: string };
    const player = players.get(playerId);
    if (player) {
      // First, tell the entering player about everyone already in this home
      for (const [otherPid, otherPlayer] of players) {
        if (otherPid !== playerId && otherPlayer.currentHome === msg.homeId) {
          safeEmit(channel,'player_entered_home', {
            playerId: otherPid, homeId: msg.homeId,
            spriteNum: otherPlayer.spriteNum,
            playerName: otherPlayer.name,
          }, { reliable: true });
        }
      }

      // Then mark this player as in the home and broadcast to everyone
      player.currentHome = msg.homeId;
      player.homeSprite = msg.spriteNum;
      safeEmit(io,'player_entered_home', {
        playerId, homeId: msg.homeId,
        spriteNum: msg.spriteNum, playerName: msg.playerName,
      }, { reliable: true });
    }
  });

  channel.on('exit_home', (data: Data) => {
    const player = players.get(playerId);
    if (player) {
      const homeId = player.currentHome;
      player.currentHome = null;
      safeEmit(io,'player_exited_home', { playerId, homeId }, { reliable: true });
    }
  });

  channel.on('home_move', (data: Data) => {
    const msg = data as { homeId: string; x: number; y: number };
    const player = players.get(playerId);
    if (!player || player.currentHome !== msg.homeId) return;
    // Broadcast to all players in the same home
    safeEmit(io,'player_home_moved', {
      playerId, homeId: msg.homeId, x: msg.x, y: msg.y,
    }); // unreliable for smooth movement
  });

  // Handle name change (reliable)
  channel.on('set_name', (data: Data) => {
    const msg = data as { name: string };
    const player = players.get(playerId);
    if (player) {
      player.name = msg.name || '';
      safeEmit(io,'player_name_changed', { playerId, name: player.name }, { reliable: true });
    }
  });

  // Handle pixel drawing (reliable) - broadcast to all players
  channel.on('pixel_place', (data: Data) => {
    const msg = data as { x: number; y: number; color: string; authorName: string };
    // Broadcast to everyone (including sender for confirmation)
    safeEmit(io,'pixel_placed', {
      x: msg.x, y: msg.y, color: msg.color,
      authorId: playerId, authorName: msg.authorName
    }, { reliable: true });
  });

  // Handle pixel erase (reliable)
  channel.on('pixel_erase', (data: Data) => {
    const msg = data as { x: number; y: number };
    safeEmit(io,'pixel_erased', { x: msg.x, y: msg.y, authorId: playerId }, { reliable: true });
  });

  // Handle batch pixel drawing (reliable)
  channel.on('pixel_batch', (data: Data) => {
    const msg = data as { pixels: { x: number; y: number; color: string }[]; authorName: string };
    if (msg.pixels && msg.pixels.length <= 500) {
      safeEmit(io,'pixel_batch_placed', {
        pixels: msg.pixels,
        authorId: playerId,
        authorName: msg.authorName,
      }, { reliable: true });
    }
  });

  // Handle chat message (reliable)
  channel.on('chat', (data: Data) => {
    const msg = data as { message: string };
    const player = players.get(playerId);
    if (player && msg.message && msg.message.trim()) {
      const chatMessage = {
        playerId,
        playerName: player.name,
        message: msg.message.trim().slice(0, 200), // Limit message length
        timestamp: Date.now(),
      };
      safeEmit(io,'chat_message', chatMessage, { reliable: true });
      console.log(`💬 ${player.name}: ${chatMessage.message}`);
    }
  });

  // Handle territory claims (reliable) - broadcast to all players
  channel.on('territory_claim', (data: Data) => {
    const msg = data as { cells: string[]; color: string; playerName: string };
    const player = players.get(playerId);
    safeEmit(io,'territory_claimed', {
      playerId,
      playerName: msg.playerName || player?.name || 'Unknown',
      cells: msg.cells,
      color: msg.color,
    }, { reliable: true });
  });

  // Handle sprite change (reliable)
  channel.on('change_sprite', (data: Data) => {
    const msg = data as { spriteNum: number };
    const player = players.get(playerId);
    if (player) {
      player.spriteNum = msg.spriteNum;
      safeEmit(io,'sprite_changed', { playerId, spriteNum: msg.spriteNum }, { reliable: true });
    }
  });

  // Handle furniture placement (reliable) - broadcast to all players
  channel.on('furniture_placed', (data: Data) => {
    const msg = data as { homeId: string; item: { id: string; emoji: string; x: number; y: number } };
    const building = buildings.get(msg.homeId);
    if (!building || building.ownerId !== playerId) return;
    safeEmit(io,'furniture_placed', { homeId: msg.homeId, item: msg.item }, { reliable: true });
  });

  // Handle furniture deletion (reliable) - broadcast to all players
  channel.on('furniture_deleted', (data: Data) => {
    const msg = data as { homeId: string; furnitureId: string };
    const building = buildings.get(msg.homeId);
    if (!building || building.ownerId !== playerId) return;
    safeEmit(io,'furniture_deleted', { homeId: msg.homeId, furnitureId: msg.furnitureId }, { reliable: true });
  });

  // Handle furniture movement (reliable) - broadcast to all players
  channel.on('furniture_moved', (data: Data) => {
    const msg = data as { homeId: string; furnitureId: string; x: number; y: number; rotation?: number; scale?: number };
    const building = buildings.get(msg.homeId);
    if (!building || building.ownerId !== playerId) return;
    safeEmit(io,'furniture_moved', { homeId: msg.homeId, furnitureId: msg.furnitureId, x: msg.x, y: msg.y, rotation: msg.rotation, scale: msg.scale }, { reliable: true });
  });

  // Handle disconnect
  channel.onDisconnect(() => {
    const player = players.get(playerId);
    // If disconnecting player was inside a home, notify others in that home
    const homeId = player?.currentHome;
    if (homeId) {
      safeEmit(io,'player_exited_home', { playerId, homeId }, { reliable: true });
    }
    // Clean up auth mapping if this player owned it
    for (const [authId, pid] of authToPlayer) {
      if (pid === playerId) { authToPlayer.delete(authId); break; }
    }
    players.delete(playerId);
    channels.delete(playerId);
    lastProcessedSeq.delete(playerId);
    safeEmit(io,'player_left', { playerId }, { reliable: true });
    console.log(`👋 Player ${playerId} left (${channels.size} remaining)`);
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`🎮 Gallax geckos.io server running on port ${PORT}`);
});

