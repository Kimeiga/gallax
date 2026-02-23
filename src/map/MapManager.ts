import mapboxgl from 'mapbox-gl';

export interface MapEvents {
  onMove: (center: { lng: number; lat: number }) => void;
  onZoom: (zoom: number) => void;
  onRender: () => void;
}

type EventCallbacks = {
  [K in keyof MapEvents]: MapEvents[K][];
};

export class MapManager {
  private map: mapboxgl.Map;
  private events: EventCallbacks = {
    onMove: [],
    onZoom: [],
    onRender: []
  };

  constructor(container: string, accessToken: string) {
    mapboxgl.accessToken = accessToken;

    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-73.965, 40.782], // Central Park, Manhattan
      zoom: 16,
      pitch: 0,
      bearing: 0,
      antialias: true
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    this.map.on('move', () => {
      const center = this.map.getCenter();
      this.events.onMove.forEach(cb => cb({ lng: center.lng, lat: center.lat }));
    });

    this.map.on('zoom', () => {
      this.events.onZoom.forEach(cb => cb(this.map.getZoom()));
    });

    this.map.on('render', () => {
      this.events.onRender.forEach(cb => cb());
    });
  }

  on<K extends keyof MapEvents>(event: K, callback: MapEvents[K]): void {
    this.events[event].push(callback as any);
  }

  getMap(): mapboxgl.Map {
    return this.map;
  }

  getZoom(): number {
    return this.map.getZoom();
  }

  getCenter(): { lng: number; lat: number } {
    const center = this.map.getCenter();
    return { lng: center.lng, lat: center.lat };
  }

  // Convert lng/lat to screen pixel coordinates
  project(lngLat: { lng: number; lat: number }): { x: number; y: number } {
    const point = this.map.project([lngLat.lng, lngLat.lat]);
    return { x: point.x, y: point.y };
  }

  // Convert screen pixel to lng/lat
  unproject(point: { x: number; y: number }): { lng: number; lat: number } {
    const lngLat = this.map.unproject([point.x, point.y]);
    return { lng: lngLat.lng, lat: lngLat.lat };
  }

  // Get meters per pixel at current zoom and latitude
  getMetersPerPixel(latitude: number): number {
    const zoom = this.map.getZoom();
    return 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  }

  // Query map features at a point (for resource spawning)
  queryFeatures(point: { x: number; y: number }, layers?: string[]): mapboxgl.MapboxGeoJSONFeature[] {
    return this.map.queryRenderedFeatures([point.x, point.y], {
      layers
    });
  }

  onLoad(callback: () => void): void {
    if (this.map.loaded()) {
      callback();
    } else {
      this.map.on('load', callback);
    }
  }

  resize(): void {
    this.map.resize();
  }
}

