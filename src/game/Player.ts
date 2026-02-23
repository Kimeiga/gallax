import { Application, Sprite, Assets, Text, TextStyle } from 'pixi.js';
import { MapManager } from '../map/MapManager';

export interface TargetResource {
  id: string;
  lng: number;
  lat: number;
  emoji: string;
  type: 'tree' | 'water' | 'terrain';
}

export class Player {
  private sprite: Sprite | null = null;
  private nameTag: Text | null = null;
  private mapManager: MapManager;
  private playerName: string = '';

  // World position (lng/lat)
  public lng: number;
  public lat: number;

  // Movement
  private velocity = { x: 0, y: 0 };
  private readonly moveSpeed = 0.00005; // Degrees per frame (adjusted for zoom)

  // Target-based movement (for tap-to-collect)
  private targetResource: TargetResource | null = null;
  private isAutoWalking = false;
  private readonly collectDistance = 0.0001; // Distance at which we can collect (in degrees, ~10m)

  // Callback when player reaches target
  private onReachTargetCallback: ((target: TargetResource) => void) | null = null;

  // Sprite scaling
  private readonly baseZoom = 16; // Zoom level where sprite is "native" size
  private readonly baseScale = 0.75; // Base sprite scale at baseZoom (smaller)

  constructor(mapManager: MapManager, startLng: number, startLat: number) {
    this.mapManager = mapManager;
    this.lng = startLng;
    this.lat = startLat;
  }

  async init(app: Application, spriteNum?: number): Promise<number> {
    try {
      // Load a random sprite from 1-125, or use provided sprite number
      const actualSpriteNum = spriteNum ?? Math.floor(Math.random() * 125) + 1;

      const texture = await Assets.load(`/sprites/${actualSpriteNum}.png`);

      // Use nearest-neighbor scaling for crisp pixel art
      texture.source.scaleMode = 'nearest';

      this.sprite = new Sprite(texture);
      this.sprite.anchor.set(0.5, 1); // Anchor at bottom center (feet)

      // Disable smoothing for crisp pixels
      this.sprite.roundPixels = true;

      app.stage.addChild(this.sprite);

      // Create name tag (initially empty)
      const style = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      });
      this.nameTag = new Text({ text: '', style });
      this.nameTag.anchor.set(0.5, 1); // Anchor at bottom center
      this.nameTag.visible = false; // Hide until name is set
      app.stage.addChild(this.nameTag);

      this.updatePosition();
      return actualSpriteNum;
    } catch (error) {
      console.error('Failed to load player sprite:', error);
      return 1;
    }
  }

  setName(name: string): void {
    this.playerName = name;
    if (this.nameTag) {
      this.nameTag.text = name;
      this.nameTag.visible = name.length > 0;
    }
  }

  getName(): string {
    return this.playerName;
  }

  setVelocity(x: number, y: number): void {
    this.velocity.x = x;
    this.velocity.y = y;

    // Manual input cancels auto-walk
    if (x !== 0 || y !== 0) {
      this.cancelTarget();
    }
  }

  // Set a target resource to walk towards
  setTarget(target: TargetResource, onReach: (target: TargetResource) => void): void {
    this.targetResource = target;
    this.isAutoWalking = true;
    this.onReachTargetCallback = onReach;
  }

  // Cancel current target
  cancelTarget(): void {
    this.targetResource = null;
    this.isAutoWalking = false;
    this.onReachTargetCallback = null;
  }

  // Check if currently walking to a target
  hasTarget(): boolean {
    return this.targetResource !== null;
  }

  update(deltaTime: number): void {
    if (!this.sprite) return;

    // If auto-walking to target
    if (this.isAutoWalking && this.targetResource) {
      const dx = this.targetResource.lng - this.lng;
      const dy = this.targetResource.lat - this.lat;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if we've reached the target
      if (distance < this.collectDistance) {
        // We've arrived! Trigger callback
        if (this.onReachTargetCallback && this.targetResource) {
          this.onReachTargetCallback(this.targetResource);
        }
        this.cancelTarget();
      } else {
        // Move towards target
        const dirX = dx / distance;
        const dirY = dy / distance;

        this.lng += dirX * this.moveSpeed * deltaTime;
        this.lat += dirY * this.moveSpeed * deltaTime;

        // Flip sprite based on direction
        if (this.sprite) {
          this.sprite.scale.x = dirX < 0 ? -Math.abs(this.sprite.scale.x) : Math.abs(this.sprite.scale.x);
        }
      }
    } else {
      // Regular velocity-based movement
      // Note: negative y = north (higher latitude)
      this.lng += this.velocity.x * this.moveSpeed * deltaTime;
      this.lat -= this.velocity.y * this.moveSpeed * deltaTime;

      // Flip sprite based on velocity
      if (this.sprite && this.velocity.x !== 0) {
        this.sprite.scale.x = this.velocity.x < 0 ? -Math.abs(this.sprite.scale.x) : Math.abs(this.sprite.scale.x);
      }
    }

    this.updatePosition();
  }

  updatePosition(): void {
    if (!this.sprite) return;

    // Project world coords to screen coords
    const screenPos = this.mapManager.project({ lng: this.lng, lat: this.lat });
    this.sprite.x = Math.round(screenPos.x); // Round for pixel-perfect rendering
    this.sprite.y = Math.round(screenPos.y);

    // Scale sprite based on zoom
    const zoom = this.mapManager.getZoom();
    const scale = this.baseScale * Math.pow(2, zoom - this.baseZoom);
    // Preserve direction when scaling
    const direction = this.sprite.scale.x < 0 ? -1 : 1;
    this.sprite.scale.set(scale * direction, scale);

    // Position name tag above sprite
    if (this.nameTag) {
      this.nameTag.x = this.sprite.x;
      // Position above sprite (sprite height varies with scale, estimate ~32px base height)
      this.nameTag.y = this.sprite.y - (32 * scale) - 5;
      // Scale name tag slightly with zoom (but keep it readable)
      const nameScale = Math.max(0.8, Math.min(1.2, scale * 0.8));
      this.nameTag.scale.set(nameScale);
    }
  }

  getPosition(): { lng: number; lat: number } {
    return { lng: this.lng, lat: this.lat };
  }

  getSprite(): Sprite | null {
    return this.sprite;
  }
}

