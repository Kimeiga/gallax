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

  // Setup player stats UI
  setupPlayerStatsUI(progression);

  // Setup achievements UI
  setupAchievementsUI(achievements, progression);

  // Setup daily rewards UI
  setupDailyRewardsUI(dailyRewards, progression);

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

main().catch(console.error);

