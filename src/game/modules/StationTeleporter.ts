import mapboxgl from 'mapbox-gl';
import { MapManager } from '../../map/MapManager';
import { Player } from '../Player';
import { GeckosNetworkManager } from '../../network/GeckosNetworkManager';
import { notificationSystem } from '../NotificationSystem';
import {
  findNearestMajorStation,
  getIntercityStations,
  getSameCityMajorStations,
} from '../data/stations';

interface LocalStation {
  name: string;
  lng: number;
  lat: number;
}

export interface StationTarget {
  name: string;
  lng: number;
  lat: number;
}

export class StationTeleporter {
  private mapManager: MapManager;
  private getPlayer: () => Player | null;
  private network: GeckosNetworkManager;
  private sendPositionUpdate: () => void;

  private inStationMode = false;
  private enteredStation: { name: string; lng: number; lat: number; city?: string } | null = null;
  private markers: mapboxgl.Marker[] = [];
  private teleportCooldown = 0; // prevent re-entering station mode immediately after teleport

  constructor(
    mapManager: MapManager,
    getPlayer: () => Player | null,
    network: GeckosNetworkManager,
    sendPositionUpdate: () => void,
  ) {
    this.mapManager = mapManager;
    this.getPlayer = getPlayer;
    this.network = network;
    this.sendPositionUpdate = sendPositionUpdate;
  }

  isInStationMode(): boolean { return this.inStationMode; }

  /**
   * Called from the map click handler when a transit-label feature is found.
   * Returns a StationTarget if the player should walk to the station first,
   * or null if it was handled (e.g. exiting station mode).
   */
  handleStationClick(
    feature: mapboxgl.GeoJSONFeature | null,
    clickLng: number,
    clickLat: number,
  ): { handled: boolean; walkTo?: StationTarget } {
    // If already in station mode, clicking empty space exits
    if (this.inStationMode) {
      this.exitStationMode();
      return { handled: true };
    }

    if (!feature) return { handled: false };

    // Cooldown after teleport to prevent instant re-entry
    if (Date.now() < this.teleportCooldown) return { handled: false };

    const name = feature.properties?.name || feature.properties?.name_en || 'Station';
    const geom = feature.geometry as GeoJSON.Point;
    const [lng, lat] = geom.coordinates;

    // Return the station as a walk target — Game.ts will set the player walking
    // and call enterStationMode() when they arrive
    return {
      handled: true,
      walkTo: { name, lng, lat },
    };
  }

  /**
   * Called by Game.ts when the player physically arrives at the station.
   */
  enterStationMode(name: string, lng: number, lat: number): void {
    if (this.inStationMode) return;
    this.inStationMode = true;

    const majorStation = findNearestMajorStation(lng, lat, 500);
    const city = majorStation?.city;
    this.enteredStation = { name, lng, lat, city };

    notificationSystem.show(
      `🚉 ${name} — tap a station to teleport${city ? ', gold stations go to other cities' : ''}`,
      'info', 4000,
    );

    // Collect destinations
    const destinations: { name: string; lng: number; lat: number; type: 'local' | 'major' | 'intercity' }[] = [];

    // 1. Local stations from Mapbox
    const localStations = this.queryLocalStations();
    for (const s of localStations) {
      if (Math.abs(s.lng - lng) < 0.0005 && Math.abs(s.lat - lat) < 0.0005) continue;
      destinations.push({ ...s, type: 'local' });
    }

    // 2. Same-city major stations
    if (city) {
      for (const s of getSameCityMajorStations(city)) {
        if (Math.abs(s.lng - lng) < 0.0005 && Math.abs(s.lat - lat) < 0.0005) continue;
        if (!destinations.find(d => Math.abs(d.lng - s.lng) < 0.001 && Math.abs(d.lat - s.lat) < 0.001)) {
          destinations.push({ name: s.name, lng: s.lng, lat: s.lat, type: 'major' });
        }
      }
    }

    // 3. Intercity stations
    if (majorStation) {
      for (const s of getIntercityStations(city!)) {
        destinations.push({ name: `${s.name} (${s.city})`, lng: s.lng, lat: s.lat, type: 'intercity' });
      }
    }

    // Add markers
    const map = this.mapManager.getMap();
    for (const dest of destinations) {
      const el = this.createMarkerElement(dest.name, dest.type);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.teleportTo(dest.name, dest.lng, dest.lat);
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dest.lng, dest.lat])
        .addTo(map);
      this.markers.push(marker);
    }

    // Intercity destinations are shown as map markers only (no side panel)
  }

  exitStationMode(): void {
    this.inStationMode = false;
    this.enteredStation = null;
    this.clearMarkers();
  }

  // ─── Teleport ──────────────────────────────────────────────────────────────

  private teleportTo(name: string, lng: number, lat: number): void {
    const map = this.mapManager.getMap();
    const player = this.getPlayer();
    if (!player) return;

    this.exitStationMode();

    // Set position immediately
    player.setPosition(lng, lat);
    player.cancelTarget();
    this.sendPositionUpdate();

    // Cooldown: don't re-enter station mode for 2s after arriving
    // (gives tiles time to load + prevents accidental instant re-entry)
    this.teleportCooldown = Date.now() + 2000;

    // Fly camera
    map.flyTo({
      center: [lng, lat],
      zoom: 16,
      speed: 1.5,
      curve: 1.8,
      essential: true,
    });

    notificationSystem.show(`🚉 Arrived at ${name}`, 'success', 3000);
  }

  // ─── Local station query ───────────────────────────────────────────────────

  private queryLocalStations(): LocalStation[] {
    const map = this.mapManager.getMap();
    const stations: LocalStation[] = [];
    const seen = new Set<string>();

    try {
      const features = map.queryRenderedFeatures(undefined as any, {
        layers: ['transit-label'],
      });

      for (const f of features) {
        const maki = (f.properties?.maki || '') as string;
        const type = (f.properties?.type || '') as string;
        const stop = (f.properties?.stop_type || '') as string;
        if (!maki.includes('rail') && !type.includes('station') && !stop.includes('station')) continue;

        const name = f.properties?.name || f.properties?.name_en || 'Station';
        const geom = f.geometry as GeoJSON.Point;
        const [sLng, sLat] = geom.coordinates;

        const key = `${name}-${sLng.toFixed(3)}-${sLat.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        stations.push({ name, lng: sLng, lat: sLat });
      }
    } catch { /* queryRenderedFeatures can fail */ }

    return stations;
  }

  // ─── Marker rendering ──────────────────────────────────────────────────────

  private createMarkerElement(name: string, type: 'local' | 'major' | 'intercity'): HTMLDivElement {
    const el = document.createElement('div');
    const isIntercity = type === 'intercity';
    const isMajor = type === 'major';
    const bgColor = isIntercity ? 'rgba(255,193,7,0.9)' : isMajor ? 'rgba(78,205,196,0.9)' : 'rgba(100,149,237,0.85)';
    const borderColor = isIntercity ? '#ffc107' : isMajor ? '#4ECDC4' : '#6495ED';
    const emoji = isIntercity ? '🌍' : '🚉';
    const size = isIntercity ? 14 : 12;

    el.style.cssText = `
      cursor:pointer;pointer-events:auto;z-index:50;
      display:flex;flex-direction:column;align-items:center;gap:2px;
      transform:translate(-50%,-100%);
    `;
    el.innerHTML = `
      <div style="
        background:${bgColor};border:2px solid ${borderColor};
        border-radius:12px;padding:3px 8px;
        font-size:${size}px;font-weight:600;color:#fff;
        white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.5);
        display:flex;align-items:center;gap:4px;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        animation:station-pulse 2s ease-in-out infinite;
      "><span>${emoji}</span><span>${name}</span></div>
      <div style="width:8px;height:8px;border-radius:50%;background:${borderColor};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
    `;
    return el;
  }

  private clearMarkers(): void {
    for (const m of this.markers) m.remove();
    this.markers = [];
  }

  destroy(): void { this.exitStationMode(); }
}
