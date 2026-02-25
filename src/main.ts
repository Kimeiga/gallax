import { TextureStyle } from 'pixi.js';
import { MapManager } from './map/MapManager';
import { Game } from './game/Game';
import { authService, User } from './auth/AuthService';

// Set default texture scaling to nearest-neighbor for crisp pixel art
TextureStyle.defaultOptions.scaleMode = 'nearest';

// Mapbox access token - loaded from environment variable
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

function setupAuthUI() {
  const loginContainer = document.getElementById('login-container');
  const userContainer = document.getElementById('user-container');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;
  const userName = document.getElementById('user-name');

  if (!loginContainer || !userContainer || !googleLoginBtn || !logoutBtn || !userAvatar || !userName) {
    console.error('Auth UI elements not found');
    return;
  }

  // Handle login button
  googleLoginBtn.addEventListener('click', () => {
    authService.login();
  });

  // Handle logout button
  logoutBtn.addEventListener('click', () => {
    authService.logout();
  });

  // Update UI based on auth state
  authService.onAuthChange((user: User | null) => {
    if (user) {
      loginContainer.style.display = 'none';
      userContainer.style.display = 'flex';
      userAvatar.src = user.avatarUrl || '';
      userName.textContent = user.name || 'User';
    } else {
      loginContainer.style.display = 'flex';
      userContainer.style.display = 'none';
    }
  });
}

async function main() {
  if (!MAPBOX_TOKEN) {
    console.error('Missing VITE_MAPBOX_TOKEN environment variable');
    document.body.innerHTML = '<h1>Missing Mapbox token. Please set VITE_MAPBOX_TOKEN in .env</h1>';
    return;
  }

  // Initialize auth
  setupAuthUI();
  await authService.init();

  // Check for login redirect params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('login') || urlParams.has('error')) {
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
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

