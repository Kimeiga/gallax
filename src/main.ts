import { TextureStyle } from 'pixi.js';
import { MapManager } from './map/MapManager';
import { Game } from './game/Game';

// Set default texture scaling to nearest-neighbor for crisp pixel art
TextureStyle.defaultOptions.scaleMode = 'nearest';

// Mapbox access token - loaded from environment variable
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

async function main() {
  if (!MAPBOX_TOKEN) {
    console.error('Missing VITE_MAPBOX_TOKEN environment variable');
    document.body.innerHTML = '<h1>Missing Mapbox token. Please set VITE_MAPBOX_TOKEN in .env</h1>';
    return;
  }

  // Initialize map
  const mapManager = new MapManager('map', MAPBOX_TOKEN);

  // Wait for map to load
  mapManager.onLoad(async () => {
    console.log('Map loaded!');
    
    // Initialize game
    const game = new Game(mapManager);
    await game.init();
    
    console.log('Game initialized! Use WASD or arrow keys to move.');
  });
}

main().catch(console.error);

