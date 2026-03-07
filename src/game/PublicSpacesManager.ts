import { Application, Text, TextStyle } from 'pixi.js';
import { MapManager } from '../map/MapManager';
import { missionsAPI, PublicSpace } from '../api/MissionsAPI';

interface PlacedSpace {
  id: string;
  name: string;
  text: Text;
  lng: number;
  lat: number;
  radius: number;
}

export class PublicSpacesManager {
  private app: Application;
  private mapManager: MapManager;
  private spaces: Map<string, PlacedSpace> = new Map();
  private baseZoom = 16;

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  async loadPublicSpaces(): Promise<void> {
    try {
      const spaces = await missionsAPI.getPublicSpaces();
      for (const space of spaces) {
        this.addSpace(space);
      }
    } catch (err) {
      console.error('Failed to load public spaces:', err);
    }
  }

  private addSpace(space: PublicSpace): void {
    if (this.spaces.has(space.id)) return;

    const style = new TextStyle({
      fontSize: 40,
      align: 'center',
    });

    // Use different emojis for different landmarks
    const emoji = this.getEmojiForSpace(space.id);
    const text = new Text({ text: emoji, style });
    text.anchor.set(0.5, 0.5);

    this.app.stage.addChild(text);

    const placed: PlacedSpace = {
      id: space.id,
      name: space.name,
      text,
      lng: space.lng,
      lat: space.lat,
      radius: space.radius,
    };

    this.spaces.set(space.id, placed);
    this.updateSpacePosition(placed);
  }

  private getEmojiForSpace(id: string): string {
    const emojiMap: Record<string, string> = {
      'met': '🏛️',
      'times-square': '🎭',
      'central-park': '🌳',
      'brooklyn-bridge': '🌉',
      'statue-liberty': '🗽',
    };
    return emojiMap[id] || '📍';
  }

  private updateSpacePosition(space: PlacedSpace): void {
    const screenPos = this.mapManager.project({ lng: space.lng, lat: space.lat });
    space.text.x = Math.round(screenPos.x);
    space.text.y = Math.round(screenPos.y);

    // Scale based on zoom
    const zoom = this.mapManager.getZoom();
    const scale = Math.pow(2, zoom - this.baseZoom) * 1.5;
    space.text.scale.set(scale);
  }

  updateAllPositions(): void {
    for (const space of this.spaces.values()) {
      this.updateSpacePosition(space);
    }
  }

  // Check if player is within radius of any public space
  checkProximity(playerLng: number, playerLat: number): PublicSpace | null {
    for (const space of this.spaces.values()) {
      const distance = this.calculateDistance(
        playerLat, playerLng,
        space.lat, space.lng
      );
      
      if (distance <= space.radius) {
        return {
          id: space.id,
          name: space.name,
          lng: space.lng,
          lat: space.lat,
          radius: space.radius,
          description: '',
        };
      }
    }
    return null;
  }

  // Calculate distance in meters using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  destroy(): void {
    for (const space of this.spaces.values()) {
      space.text.destroy();
    }
    this.spaces.clear();
  }
}

