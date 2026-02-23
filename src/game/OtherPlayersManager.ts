import { Application, Sprite, Assets, Text, TextStyle } from 'pixi.js';
import { MapManager } from '../map/MapManager';
import { NetworkPlayer } from '../network/NetworkManager';

interface OtherPlayer {
  id: string;
  sprite: Sprite;
  nameTag: Text;
  lng: number;
  lat: number;
  targetLng: number;
  targetLat: number;
  spriteNum: number;
  name: string;
}

export class OtherPlayersManager {
  private players: Map<string, OtherPlayer> = new Map();
  private mapManager: MapManager;
  private app: Application;
  private readonly baseZoom = 16;
  private readonly baseScale = 0.75;

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  async addPlayer(player: NetworkPlayer): Promise<void> {
    if (this.players.has(player.id)) return;

    try {
      const texture = await Assets.load(`/sprites/${player.spriteNum}.png`);
      texture.source.scaleMode = 'nearest';

      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      sprite.roundPixels = true;

      // Name tag
      const nameStyle = new TextStyle({
        fontSize: 12,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        fontFamily: 'Arial',
      });
      const nameTag = new Text({ text: player.name, style: nameStyle });
      nameTag.anchor.set(0.5, 1);

      this.app.stage.addChild(sprite);
      this.app.stage.addChild(nameTag);

      const otherPlayer: OtherPlayer = {
        id: player.id,
        sprite,
        nameTag,
        lng: player.lng,
        lat: player.lat,
        targetLng: player.lng,
        targetLat: player.lat,
        spriteNum: player.spriteNum,
        name: player.name,
      };

      this.players.set(player.id, otherPlayer);
      this.updatePlayerPosition(otherPlayer);
    } catch (error) {
      console.error(`Failed to load sprite for player ${player.id}:`, error);
    }
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.sprite.destroy();
      player.nameTag.destroy();
      this.players.delete(playerId);
    }
  }

  movePlayer(playerId: string, lng: number, lat: number): void {
    const player = this.players.get(playerId);
    if (player) {
      player.targetLng = lng;
      player.targetLat = lat;
    }
  }

  updatePlayerName(playerId: string, name: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.name = name;
      player.nameTag.text = name;
    }
  }

  update(deltaTime: number): void {
    // Interpolate player positions for smooth movement
    for (const player of this.players.values()) {
      const dx = player.targetLng - player.lng;
      const dy = player.targetLat - player.lat;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.000001) {
        const lerpSpeed = 0.15;
        player.lng += dx * lerpSpeed;
        player.lat += dy * lerpSpeed;

        // Flip sprite based on direction
        if (dx !== 0) {
          player.sprite.scale.x = dx < 0 
            ? -Math.abs(player.sprite.scale.x) 
            : Math.abs(player.sprite.scale.x);
        }
      }

      this.updatePlayerPosition(player);
    }
  }

  private updatePlayerPosition(player: OtherPlayer): void {
    const screenPos = this.mapManager.project({ lng: player.lng, lat: player.lat });
    
    player.sprite.x = Math.round(screenPos.x);
    player.sprite.y = Math.round(screenPos.y);

    // Scale based on zoom
    const zoom = this.mapManager.getZoom();
    const scale = this.baseScale * Math.pow(2, zoom - this.baseZoom);
    const direction = player.sprite.scale.x < 0 ? -1 : 1;
    player.sprite.scale.set(scale * direction, scale);

    // Position name tag above player
    player.nameTag.x = player.sprite.x;
    player.nameTag.y = player.sprite.y - player.sprite.height - 5;
  }

  updateAllPositions(): void {
    for (const player of this.players.values()) {
      this.updatePlayerPosition(player);
    }
  }

  getPlayer(playerId: string): OtherPlayer | undefined {
    return this.players.get(playerId);
  }
}

