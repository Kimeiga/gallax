// Network manager for multiplayer sync

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
  placedAt: number;
}

export type MessageHandler = {
  onInit: (playerId: string, players: NetworkPlayer[], collectedResources: string[], buildings: NetworkBuilding[]) => void;
  onPlayerJoined: (player: NetworkPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerMoved: (playerId: string, lng: number, lat: number) => void;
  onPlayerNameChanged: (playerId: string, name: string) => void;
  onResourceCollected: (resourceId: string, playerId: string) => void;
  onBuildingPlaced: (building: NetworkBuilding) => void;
};

export class NetworkManager {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private playerId: string | null = null;
  private serverUrl: string;

  constructor(serverUrl?: string) {
    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else {
      // Auto-detect based on environment
      const isProduction = window.location.hostname !== 'localhost' &&
                           window.location.hostname !== '127.0.0.1';
      if (isProduction) {
        // In production, use WSS on the same host
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.serverUrl = `${protocol}//${window.location.host}/websocket`;
      } else {
        // In development, use local server
        this.serverUrl = 'ws://localhost:3005';
      }
    }
    console.log(`🔌 WebSocket URL: ${this.serverUrl}`);
  }

  connect(handlers: MessageHandler): Promise<void> {
    this.handlers = handlers;
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('🌐 Connected to game server');
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.ws.onclose = () => {
        console.log('🔌 Disconnected from server');
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  private handleMessage(message: any) {
    if (!this.handlers) return;

    switch (message.type) {
      case 'init':
        this.playerId = message.playerId;
        this.handlers.onInit(
          message.playerId,
          message.players,
          message.collectedResources,
          message.buildings
        );
        break;
      case 'player_joined':
        this.handlers.onPlayerJoined(message.player);
        break;
      case 'player_left':
        this.handlers.onPlayerLeft(message.playerId);
        break;
      case 'player_moved':
        this.handlers.onPlayerMoved(message.playerId, message.lng, message.lat);
        break;
      case 'player_name_changed':
        this.handlers.onPlayerNameChanged(message.playerId, message.name);
        break;
      case 'resource_collected':
        this.handlers.onResourceCollected(message.resourceId, message.playerId);
        break;
      case 'building_placed':
        this.handlers.onBuildingPlaced(message.building);
        break;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      if (this.handlers) {
        this.connect(this.handlers).catch(console.error);
      }
    }, delay);
  }

  // Send join message
  join(lng: number, lat: number, spriteNum: number, name?: string) {
    this.send({ type: 'join', lng, lat, spriteNum, name });
  }

  // Send player position update
  move(lng: number, lat: number) {
    this.send({ type: 'move', lng, lat });
  }

  // Notify resource collection
  collectResource(resourceId: string) {
    this.send({ type: 'collect', resourceId });
  }

  // Place a building
  placeBuilding(buildingType: string, lng: number, lat: number) {
    this.send({ type: 'place_building', buildingType, lng, lat });
  }

  // Update player name
  setName(name: string) {
    this.send({ type: 'set_name', name });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.ws?.close();
  }
}

