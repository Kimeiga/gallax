import { TextureStyle } from 'pixi.js';
import { MapManager } from './map/MapManager';
import { Game } from './game/Game';
import { authService, User } from './auth/AuthService';
import { missionsAPI, PublicSpace, Mission, PlayerMission } from './api/MissionsAPI';
import { ProgressionSystem } from './game/ProgressionSystem';
import { notificationSystem } from './game/NotificationSystem';
import { AchievementSystem } from './game/AchievementSystem';
import { DailyRewardSystem } from './game/DailyRewards';

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

        // Get both available missions and player's active missions
        const [allMissions, playerMissions] = await Promise.all([
          missionsAPI.getAvailableMissions(currentSpace.id),
          missionsAPI.getPlayerMissions()
        ]);

        // Filter out missions that are already accepted (active or completed)
        const acceptedMissionIds = new Set(
          playerMissions
            .filter(pm => pm.status === 'active' || pm.status === 'completed')
            .map(pm => pm.mission_id)
        );

        const availableMissions = allMissions.filter(m => !acceptedMissionIds.has(m.id));
        renderAvailableMissions(availableMissions);
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

    const isLoggedIn = authService.isAuthenticated();

    missionList.innerHTML = missions.map(mission => `
      <div class="mission-card">
        <div class="mission-card-header">
          <h3 class="mission-title">${mission.title}</h3>
          <span class="mission-reward">💰 ${mission.reward_coins}</span>
        </div>
        <p class="mission-description">${mission.description}</p>
        <div class="mission-actions">
          ${isLoggedIn
            ? `<button class="mission-btn mission-btn-primary" data-mission-id="${mission.id}">Accept Mission</button>`
            : `<button class="mission-btn mission-btn-secondary" data-login-required="true">Login to Accept</button>`
          }
        </div>
      </div>
    `).join('');

    if (isLoggedIn) {
      // Add event listeners for accept buttons
      missionList.querySelectorAll('.mission-btn-primary').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.target as HTMLButtonElement;
          const missionId = target.getAttribute('data-mission-id');
          if (missionId) {
            // Disable button and show loading state
            target.disabled = true;
            target.textContent = 'Accepting...';

            const success = await missionsAPI.acceptMission(missionId);
            if (success) {
              notificationSystem.show('✅ Mission Accepted!', 'success');
              await loadMissions();
            } else {
              notificationSystem.show('❌ Failed to accept mission', 'error');
              target.disabled = false;
              target.textContent = 'Accept Mission';
            }
          }
        });
      });
    } else {
      // Add event listeners for login buttons
      missionList.querySelectorAll('[data-login-required]').forEach(btn => {
        btn.addEventListener('click', () => {
          notificationSystem.show('🔐 Please login to accept missions', 'info');
          // Optionally trigger login flow
          const googleLoginBtn = document.getElementById('google-login-btn');
          if (googleLoginBtn) {
            googleLoginBtn.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });
    }
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

  // Initialize achievement system
  const achievements = new AchievementSystem();
  (window as any).achievements = achievements;

  // Initialize daily rewards
  const dailyRewards = new DailyRewardSystem();
  (window as any).dailyRewards = dailyRewards;

  // Initialize weather system
  const { weatherSystem } = await import('./game/WeatherSystem');
  (window as any).weatherSystem = weatherSystem;

  // Initialize resource production system
  const { resourceProductionSystem } = await import('./game/ResourceProductionSystem');
  (window as any).resourceProductionSystem = resourceProductionSystem;

  // Initialize leaderboard system
  const { leaderboardSystem } = await import('./game/LeaderboardSystem');
  (window as any).leaderboardSystem = leaderboardSystem;

  // Setup player stats UI
  setupPlayerStatsUI(progression);

  // Setup achievements UI
  setupAchievementsUI(achievements, progression);

  // Setup daily rewards UI
  setupDailyRewardsUI(dailyRewards, progression);

  // Setup weather UI
  setupWeatherUI();

  // Setup leaderboard UI
  setupLeaderboardUI();

  // Wait for map to load
  mapManager.onLoad(async () => {
    console.log('Map loaded!');

    // Initialize game
    const game = new Game(mapManager);
    await game.init();

    // Expose game globally for settings menu
    (window as any).game = game;

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

function setupAchievementsUI(achievements: AchievementSystem, progression: ProgressionSystem): void {
  const achievementsBtn = document.getElementById('achievements-btn');
  const achievementsPanel = document.getElementById('achievements-panel');
  const closeBtn = document.getElementById('close-achievements');
  const achievementsList = document.getElementById('achievements-list');
  const achievementCount = document.getElementById('achievement-count');
  const achievementProgressFill = document.getElementById('achievement-progress-fill');

  if (!achievementsBtn || !achievementsPanel || !closeBtn || !achievementsList) return;

  // Open achievements panel
  achievementsBtn.addEventListener('click', () => {
    achievementsPanel.style.display = 'block';
    updateAchievementsList();
  });

  // Close achievements panel
  closeBtn.addEventListener('click', () => {
    achievementsPanel.style.display = 'none';
  });

  function updateAchievementsList(): void {
    const allAchievements = achievements.getAchievements();
    achievementsList!.innerHTML = '';

    allAchievements.forEach(ach => {
      const item = document.createElement('div');
      item.className = `achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`;

      item.innerHTML = `
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${ach.name}</div>
          <div class="achievement-description">${ach.description}</div>
          <div class="achievement-reward">
            <span>💰 ${ach.coinReward}</span>
            <span>⭐ ${ach.xpReward} XP</span>
          </div>
        </div>
        ${ach.unlocked ? '<div class="achievement-unlocked-badge">Unlocked</div>' : ''}
      `;

      achievementsList!.appendChild(item);
    });

    // Update progress
    if (achievementCount) {
      achievementCount.textContent = `${achievements.getUnlockedCount()}/${achievements.getTotalCount()}`;
    }
    if (achievementProgressFill) {
      achievementProgressFill.style.width = `${achievements.getProgress()}%`;
    }
  }

  // Check achievements periodically
  setInterval(() => {
    const stats = progression.getStats();
    const newAchievements = achievements.checkAchievements({
      resources: stats.totalResourcesCollected,
      buildings: stats.totalBuildingsPlaced,
      missions: stats.totalMissionsCompleted,
      level: stats.level,
      distance: 0, // TODO: Track distance
      coins: stats.totalCoins,
    });

    // Show notifications for new achievements
    newAchievements.forEach(ach => {
      notificationSystem.show(`🏆 Achievement Unlocked: ${ach.name}!`, 'levelup');
      progression.addXP(ach.xpReward);
      // TODO: Add coins to player account
    });
  }, 2000);

  // Setup settings menu
  setupSettingsMenu();
}

function setupDailyRewardsUI(dailyRewards: DailyRewardSystem, progression: ProgressionSystem): void {
  const modal = document.getElementById('daily-reward-modal');
  const claimBtn = document.getElementById('claim-reward-btn');
  const closeBtn = document.getElementById('close-daily-reward');
  const streakCount = document.getElementById('streak-count');
  const rewardCoins = document.getElementById('reward-coins');
  const rewardXP = document.getElementById('reward-xp');
  const rewardBonus = document.getElementById('reward-bonus');

  if (!modal || !claimBtn || !closeBtn) return;

  // Only show daily reward if user is authenticated and can claim
  const user = authService.getUser();
  if (!user) {
    // Hide modal for unauthenticated users
    modal.style.display = 'none';
    return;
  }

  // Check if user can claim daily reward
  if (dailyRewards.canClaimToday()) {
    // Show modal after a short delay
    setTimeout(() => {
      const nextReward = dailyRewards.getNextReward();
      if (streakCount) streakCount.textContent = nextReward.day.toString();
      if (rewardCoins) rewardCoins.textContent = nextReward.coins.toString();
      if (rewardXP) rewardXP.textContent = nextReward.xp.toString();

      if (nextReward.bonus && rewardBonus) {
        rewardBonus.textContent = nextReward.bonus;
        rewardBonus.style.display = 'block';
      } else if (rewardBonus) {
        rewardBonus.style.display = 'none';
      }

      modal.style.display = 'flex';
    }, 2000);
  }

  // Claim reward
  claimBtn.addEventListener('click', () => {
    const reward = dailyRewards.claimDailyReward();
    if (reward) {
      progression.addXP(reward.xp);
      notificationSystem.show(`🎁 Daily Reward: +${reward.coins} coins, +${reward.xp} XP!`, 'coin');
      // TODO: Add coins to player account
      modal.style.display = 'none';
    }
  });

  // Close modal
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

function setupWeatherUI(): void {
  // Create weather indicator in top-right corner
  const weatherIndicator = document.createElement('div');
  weatherIndicator.id = 'weather-indicator';
  weatherIndicator.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(10px);
  `;
  document.body.appendChild(weatherIndicator);

  // Update weather display
  function updateWeatherDisplay() {
    const weatherSystem = (window as any).weatherSystem;
    if (!weatherSystem) return;

    const weather = weatherSystem.getCurrentWeather();
    weatherIndicator.innerHTML = `
      <span style="font-size: 20px;">${weather.emoji}</span>
      <div>
        <div style="font-weight: bold;">${weather.name}</div>
        <div style="font-size: 11px; opacity: 0.8;">${weather.description}</div>
      </div>
    `;
  }

  updateWeatherDisplay();
  setInterval(updateWeatherDisplay, 5000);
}

function setupLeaderboardUI(): void {
  // Create leaderboard button
  const leaderboardBtn = document.createElement('button');
  leaderboardBtn.id = 'leaderboard-btn';
  leaderboardBtn.innerHTML = '🏆';
  leaderboardBtn.title = 'Leaderboard';
  leaderboardBtn.style.cssText = `
    position: fixed;
    top: 20px;
    left: 280px;
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  `;
  leaderboardBtn.addEventListener('mouseenter', () => {
    leaderboardBtn.style.transform = 'scale(1.1)';
  });
  leaderboardBtn.addEventListener('mouseleave', () => {
    leaderboardBtn.style.transform = 'scale(1)';
  });
  document.body.appendChild(leaderboardBtn);

  // Create leaderboard panel
  const leaderboardPanel = document.createElement('div');
  leaderboardPanel.id = 'leaderboard-panel';
  leaderboardPanel.style.cssText = `
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 20px;
    z-index: 10001;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  `;
  leaderboardPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: white;">🏆 Leaderboard</h2>
      <button id="close-leaderboard" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 18px;">×</button>
    </div>
    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
      <button class="leaderboard-tab active" data-type="level">Level</button>
      <button class="leaderboard-tab" data-type="coins">Coins</button>
      <button class="leaderboard-tab" data-type="resources">Resources</button>
    </div>
    <div id="leaderboard-list" style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;"></div>
    <div id="player-rank" style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; color: white; text-align: center;"></div>
  `;
  document.body.appendChild(leaderboardPanel);

  let currentType = 'level';

  // Tab switching
  leaderboardPanel.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      leaderboardPanel.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentType = tab.getAttribute('data-type') || 'level';
      await updateLeaderboard();
    });
  });

  // Open/close
  leaderboardBtn.addEventListener('click', async () => {
    leaderboardPanel.style.display = 'block';
    await updateLeaderboard();
  });

  const closeBtn = leaderboardPanel.querySelector('#close-leaderboard');
  closeBtn?.addEventListener('click', () => {
    leaderboardPanel.style.display = 'none';
  });

  async function updateLeaderboard() {
    const leaderboardSystem = (window as any).leaderboardSystem;
    if (!leaderboardSystem) return;

    const list = document.getElementById('leaderboard-list');
    const rankEl = document.getElementById('player-rank');
    if (!list) return;

    list.innerHTML = '<div style="color: white; text-align: center;">Loading...</div>';

    const [entries, playerRank] = await Promise.all([
      leaderboardSystem.getLeaderboard(currentType, 10),
      leaderboardSystem.getPlayerRank(currentType)
    ]);

    list.innerHTML = entries.map((entry: any, index: number) => `
      <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-bottom: 8px; color: white;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: bold; font-size: 18px;">${index + 1}</span>
          <div>
            <div style="font-weight: bold;">${entry.username || 'Player'}</div>
            <div style="font-size: 12px; opacity: 0.8;">Level ${entry.level}</div>
          </div>
        </div>
        <div style="font-weight: bold; font-size: 18px;">
          ${currentType === 'level' ? `Lvl ${entry.level}` :
            currentType === 'coins' ? `${entry.total_coins} 💰` :
            currentType === 'resources' ? `${entry.total_resources_collected} 🌳` :
            `${entry.total_buildings_placed} 🏗️`}
        </div>
      </div>
    `).join('');

    if (rankEl && playerRank) {
      rankEl.innerHTML = `Your Rank: #${playerRank}`;
    }
  }
}

function setupSettingsMenu(): void {
  // Create settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'settings-btn';
  settingsBtn.textContent = '⚙️';
  settingsBtn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    width: 50px;
    height: 50px;
    font-size: 24px;
    cursor: pointer;
    z-index: 1000;
    transition: all 0.2s;
  `;
  settingsBtn.onmouseenter = () => {
    settingsBtn.style.background = 'rgba(0, 0, 0, 0.95)';
    settingsBtn.style.transform = 'scale(1.1)';
  };
  settingsBtn.onmouseleave = () => {
    settingsBtn.style.background = 'rgba(0, 0, 0, 0.8)';
    settingsBtn.style.transform = 'scale(1)';
  };
  document.body.appendChild(settingsBtn);

  // Create settings modal
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    justify-content: center;
    align-items: center;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 20px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: white; font-size: 24px;">⚙️ Settings</h2>
      <button id="close-settings" style="background: none; border: none; color: white; font-size: 30px; cursor: pointer; padding: 0; width: 40px; height: 40px;">×</button>
    </div>

    <div style="margin-bottom: 30px;">
      <h3 style="color: white; margin-bottom: 15px;">🎭 Character Customization</h3>
      <div id="character-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 10px;"></div>
      <button id="randomize-character" style="margin-top: 10px; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%;">🎲 Randomize</button>
    </div>
  `;

  modal.appendChild(panel);
  document.body.appendChild(modal);

  // Load character grid
  const grid = panel.querySelector('#character-grid') as HTMLElement;
  const savedSprite = localStorage.getItem('gallax_player_sprite');
  const currentSprite = savedSprite ? parseInt(savedSprite, 10) : 1;

  for (let i = 1; i <= 125; i++) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 50px;
      min-height: 50px;
      border: 3px solid ${i === currentSprite ? '#667eea' : 'transparent'};
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    `;
    btn.innerHTML = `<img src="/sprites/${i}.png" style="width: 100%; height: auto; image-rendering: pixelated; display: block;" />`;
    btn.onclick = async () => {
      // Update sprite in real-time
      const game = (window as any).game;
      if (game) {
        await game.changePlayerSprite(i);
        notificationSystem.show(`✨ Character changed!`, 'coin');
      }

      // Update all borders
      grid.querySelectorAll('button').forEach((b, idx) => {
        (b as HTMLElement).style.border = `3px solid ${idx + 1 === i ? '#667eea' : 'transparent'}`;
      });
    };
    grid.appendChild(btn);
  }

  // Randomize button
  const randomizeBtn = panel.querySelector('#randomize-character') as HTMLButtonElement;
  randomizeBtn.onclick = async () => {
    const random = Math.floor(Math.random() * 125) + 1;

    // Update sprite in real-time
    const game = (window as any).game;
    if (game) {
      await game.changePlayerSprite(random);
      notificationSystem.show(`🎲 Character randomized!`, 'coin');
    }

    grid.querySelectorAll('button').forEach((b, idx) => {
      (b as HTMLElement).style.border = `3px solid ${idx + 1 === random ? '#667eea' : 'transparent'}`;
    });
  };

  // Open/close modal
  settingsBtn.onclick = () => {
    modal.style.display = 'flex';
  };

  const closeBtn = panel.querySelector('#close-settings') as HTMLButtonElement;
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

main().catch(console.error);

