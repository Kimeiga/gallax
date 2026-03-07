import { TextureStyle } from 'pixi.js';
import { MapManager } from './map/MapManager';
import { Game } from './game/Game';
import { authService, User } from './auth/AuthService';
import { missionsAPI, PublicSpace, Mission, PlayerMission } from './api/MissionsAPI';
import { ProgressionSystem } from './game/ProgressionSystem';
import { notificationSystem } from './game/NotificationSystem';

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
      updateCoinDisplay();
    } else {
      loginContainer.style.display = 'flex';
      userContainer.style.display = 'none';
    }
  });
}

async function updateCoinDisplay() {
  // Check if user is logged in
  const userContainer = document.getElementById('user-container');
  if (!userContainer || userContainer.style.display === 'none') return;

  const coinCount = document.getElementById('coin-count');
  if (coinCount) {
    // Fetch user data to get coin count
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      coinCount.textContent = data.coins?.toString() || '0';
    }
  }
}

function setupMissionUI() {
  const missionBoardBtn = document.getElementById('mission-board-btn');
  const missionBoard = document.getElementById('mission-board');
  const closeMissionBoard = document.getElementById('close-mission-board');
  const missionTabs = document.querySelectorAll('.mission-tab');
  const missionList = document.getElementById('mission-list');

  if (!missionBoardBtn || !missionBoard || !closeMissionBoard || !missionList) {
    console.error('Mission UI elements not found');
    return;
  }

  let currentSpace: PublicSpace | null = null;
  let currentTab: 'available' | 'active' | 'completed' = 'available';

  // Open mission board
  missionBoardBtn.addEventListener('click', async () => {
    missionBoard.style.display = 'block';
    await loadMissions();
  });

  // Close mission board
  closeMissionBoard.addEventListener('click', () => {
    missionBoard.style.display = 'none';
  });

  // Tab switching
  missionTabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      missionTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.getAttribute('data-tab') as any;
      await loadMissions();
    });
  });

  async function loadMissions() {
    if (!missionList) return;

    missionList.innerHTML = '<div style="color: white; text-align: center;">Loading...</div>';

    try {
      if (currentTab === 'available') {
        if (!currentSpace) {
          missionList.innerHTML = '<div style="color: rgba(255,255,255,0.6); text-align: center;">No public space nearby</div>';
          return;
        }
        const missions = await missionsAPI.getAvailableMissions(currentSpace.id);
        renderAvailableMissions(missions);
      } else {
        const playerMissions = await missionsAPI.getPlayerMissions();
        const filtered = playerMissions.filter(m => {
          if (currentTab === 'active') return m.status === 'active';
          if (currentTab === 'completed') return m.status === 'completed' || m.status === 'claimed';
          return false;
        });
        renderPlayerMissions(filtered);
      }
    } catch (err) {
      console.error('Error loading missions:', err);
      missionList.innerHTML = '<div style="color: red; text-align: center;">Error loading missions</div>';
    }
  }

  function renderAvailableMissions(missions: Mission[]) {
    if (!missionList) return;

    if (missions.length === 0) {
      missionList.innerHTML = '<div style="color: rgba(255,255,255,0.6); text-align: center;">No missions available</div>';
      return;
    }

    missionList.innerHTML = missions.map(mission => `
      <div class="mission-card">
        <div class="mission-card-header">
          <h3 class="mission-title">${mission.title}</h3>
          <span class="mission-reward">💰 ${mission.reward_coins}</span>
        </div>
        <p class="mission-description">${mission.description}</p>
        <div class="mission-actions">
          <button class="mission-btn mission-btn-primary" data-mission-id="${mission.id}">Accept Mission</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    missionList.querySelectorAll('.mission-btn-primary').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const missionId = (e.target as HTMLElement).getAttribute('data-mission-id');
        if (missionId) {
          const success = await missionsAPI.acceptMission(missionId);
          if (success) {
            await loadMissions();
          }
        }
      });
    });
  }

  function renderPlayerMissions(missions: PlayerMission[]) {
    if (!missionList) return;

    if (missions.length === 0) {
      missionList.innerHTML = '<div style="color: rgba(255,255,255,0.6); text-align: center;">No missions</div>';
      return;
    }

    missionList.innerHTML = missions.map(mission => {
      const statusClass = `mission-status-${mission.status}`;
      const showComplete = mission.status === 'active';
      const showClaim = mission.status === 'completed';

      return `
        <div class="mission-card">
          <div class="mission-card-header">
            <h3 class="mission-title">${mission.title}</h3>
            <span class="mission-reward">💰 ${mission.reward_coins}</span>
          </div>
          <p class="mission-description">${mission.description}</p>
          <p class="mission-progress">📍 ${mission.space_name}</p>
          <span class="mission-status ${statusClass}">${mission.status}</span>
          ${showComplete ? `
            <div class="mission-actions">
              <button class="mission-btn mission-btn-success" data-player-mission-id="${mission.id}">Complete</button>
            </div>
          ` : ''}
          ${showClaim ? `
            <div class="mission-actions">
              <button class="mission-btn mission-btn-success" data-claim-mission-id="${mission.id}">Claim Reward</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Add event listeners for complete
    missionList.querySelectorAll('[data-player-mission-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const playerMissionId = (e.target as HTMLElement).getAttribute('data-player-mission-id');
        if (playerMissionId) {
          const result = await missionsAPI.completeMission(playerMissionId);
          if (result.success) {
            await updateCoinDisplay();
            await loadMissions();
          }
        }
      });
    });

    // Add event listeners for claim
    missionList.querySelectorAll('[data-claim-mission-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const playerMissionId = (e.target as HTMLElement).getAttribute('data-claim-mission-id');
        if (playerMissionId) {
          const result = await missionsAPI.completeMission(playerMissionId);
          if (result.success) {
            await updateCoinDisplay();
            await loadMissions();
          }
        }
      });
    });
  }

  // Export function to set current space
  (window as any).setCurrentMissionSpace = (space: PublicSpace | null) => {
    currentSpace = space;
    const missionUI = document.getElementById('mission-ui');
    if (missionUI) {
      missionUI.style.display = space ? 'block' : 'none';
    }
    if (space) {
      const title = document.getElementById('mission-board-title');
      if (title) {
        title.textContent = `${space.name} Missions`;
      }
    }
  };
}

async function main() {
  if (!MAPBOX_TOKEN) {
    console.error('Missing VITE_MAPBOX_TOKEN environment variable');
    document.body.innerHTML = '<h1>Missing Mapbox token. Please set VITE_MAPBOX_TOKEN in .env</h1>';
    return;
  }

  // Initialize auth
  setupAuthUI();
  setupMissionUI();
  await authService.init();

  // Check for login redirect params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('login') || urlParams.has('error')) {
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Initialize map
  const mapManager = new MapManager('map', MAPBOX_TOKEN);

  // Initialize progression system
  const progression = new ProgressionSystem();
  (window as any).progression = progression;

  // Initialize notification system
  notificationSystem.init();

  // Setup player stats UI
  setupPlayerStatsUI(progression);

  // Wait for map to load
  mapManager.onLoad(async () => {
    console.log('Map loaded!');

    // Initialize game
    const game = new Game(mapManager);
    await game.init();

    console.log('Game initialized! Use WASD or arrow keys to move.');
  });
}

function setupPlayerStatsUI(progression: ProgressionSystem) {
  const statsPanel = document.getElementById('player-stats');
  if (!statsPanel) return;

  // Show stats panel when logged in
  authService.onAuthChange((user) => {
    if (user) {
      statsPanel.style.display = 'block';
      updatePlayerStatsDisplay(progression);
    } else {
      statsPanel.style.display = 'none';
    }
  });

  // Update stats display every second
  let currentUser: User | null = null;
  authService.onAuthChange((user) => {
    currentUser = user;
  });

  setInterval(() => {
    if (currentUser) {
      updatePlayerStatsDisplay(progression);
    }
  }, 1000);
}

function updatePlayerStatsDisplay(progression: ProgressionSystem) {
  const stats = progression.getStats();

  const levelEl = document.getElementById('player-level');
  const xpEl = document.getElementById('player-xp');
  const xpNextEl = document.getElementById('player-xp-next');
  const xpBarFill = document.getElementById('xp-bar-fill');
  const coinsEl = document.getElementById('player-coins-stat');
  const resourcesEl = document.getElementById('player-resources');
  const buildingsEl = document.getElementById('player-buildings');
  const missionsEl = document.getElementById('player-missions');

  if (levelEl) levelEl.textContent = stats.level.toString();
  if (xpEl) xpEl.textContent = stats.xp.toString();
  if (xpNextEl) xpNextEl.textContent = stats.xpToNextLevel.toString();
  if (xpBarFill) {
    const percent = (stats.xp / stats.xpToNextLevel) * 100;
    xpBarFill.style.width = `${percent}%`;
  }
  if (coinsEl) coinsEl.textContent = stats.totalCoins.toString();
  if (resourcesEl) resourcesEl.textContent = stats.totalResourcesCollected.toString();
  if (buildingsEl) buildingsEl.textContent = stats.totalBuildingsPlaced.toString();
  if (missionsEl) missionsEl.textContent = stats.totalMissionsCompleted.toString();
}

main().catch(console.error);

