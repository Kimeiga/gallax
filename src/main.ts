import { TextureStyle } from 'pixi.js';
import { MapManager } from './map/MapManager';
import { Game } from './game/Game';
import { authService, User } from './auth/AuthService';
import { missionsAPI, PublicSpace, Mission, PlayerMission } from './api/MissionsAPI';
import { ProgressionSystem } from './game/ProgressionSystem';
import { notificationSystem } from './game/NotificationSystem';
import { AchievementSystem } from './game/AchievementSystem';
// Daily rewards removed - replaced by combat system
import { EmojiDiscoverySystem, EMOJI_CATALOG, type EmojiCategory } from './game/EmojiDiscoverySystem';
import { WeatherEffects } from './game/WeatherEffects';

// Set default texture scaling to nearest-neighbor for crisp pixel art
TextureStyle.defaultOptions.scaleMode = 'nearest';

// Register service worker for caching (network-first)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

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

  const levelBadge = document.getElementById('user-level-badge');
  const coinsBadge = document.getElementById('user-coins-badge');

  const updateBadges = () => {
    const prog = (window as any).progression;
    if (prog) {
      const stats = prog.getStats();
      if (levelBadge) levelBadge.textContent = `L${stats.level}`;
      if (coinsBadge) coinsBadge.textContent = `💰 ${stats.totalCoins}`;
    }
  };
  setInterval(updateBadges, 5000);

  // Update UI based on auth state
  authService.onAuthChange((user: User | null) => {
    if (user) {
      if (user.isGuest) {
        loginContainer.style.display = 'flex';
        logoutBtn.style.display = 'none';
      } else {
        loginContainer.style.display = 'none';
        logoutBtn.style.display = 'block';
      }
      userContainer.style.display = 'flex';
      userAvatar.src = user.avatarUrl || '';
      userName.textContent = user.name || 'User';
      updateBadges();
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
          ${authService.hasUser()
            ? `<button class="mission-btn mission-btn-primary" data-mission-id="${mission.id}">Accept Mission</button>`
            : `<button class="mission-btn mission-btn-secondary" data-login-required="true">Login to Accept</button>`
          }
        </div>
      </div>
    `).join('');

    if (authService.hasUser()) {
      // Add event listeners for accept buttons (works for both authenticated and guest users)
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
  if (window.location.pathname === '/cesium-3d') {
    const { initCesium3D } = await import('./cesium3d');
    await initCesium3D();
    return;
  }

  if (window.location.pathname === '/photoreal-3d') {
    const { initPhotoreal3D } = await import('./photoreal3d');
    await initPhotoreal3D();
    return;
  }

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

  // Daily rewards removed

  // Initialize weather system
  const { weatherSystem } = await import('./game/WeatherSystem');
  (window as any).weatherSystem = weatherSystem;

  // Initialize resource production system
  const { resourceProductionSystem } = await import('./game/ResourceProductionSystem');
  (window as any).resourceProductionSystem = resourceProductionSystem;

  // Initialize leaderboard system
  const { leaderboardSystem } = await import('./game/LeaderboardSystem');
  (window as any).leaderboardSystem = leaderboardSystem;

  // Setup unified settings (cog icon + tabbed modal) and compact weather
  setupSettingsAndWeather(progression, achievements);

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

function setupSettingsAndWeather(progression: ProgressionSystem, achievements: AchievementSystem): void {
  const zoneTopRight = document.getElementById('zone-top-right');
  if (!zoneTopRight) return;

  // --- Settings cog button (rightmost) ---
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'settings-btn';
  settingsBtn.textContent = '⚙️';
  settingsBtn.className = 'action-btn';
  zoneTopRight.appendChild(settingsBtn);

  // --- Missions button (below settings) ---
  const missionsBtn = document.createElement('button');
  missionsBtn.id = 'missions-btn';
  missionsBtn.textContent = '🎯';
  missionsBtn.className = 'action-btn';
  missionsBtn.style.position = 'relative';
  zoneTopRight.appendChild(missionsBtn);

  // Missions badge
  const missionsBadge = document.createElement('span');
  missionsBadge.id = 'missions-badge';
  missionsBadge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:10px;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;';
  missionsBadge.textContent = '3';
  missionsBtn.appendChild(missionsBadge);

  missionsBtn.addEventListener('click', () => {
    showMissionsModal();
  });

  // --- Weather circle button (stacked emoji + temp) ---
  const weatherEl = document.createElement('div');
  weatherEl.id = 'weather-indicator';
  weatherEl.className = 'action-btn';
  weatherEl.style.cssText = `
    flex-direction: column;
    gap: 0;
    line-height: 1;
    cursor: pointer;
    font-size: 12px;
  `;
  weatherEl.innerHTML = '<span style="font-size:14px;line-height:1;">☀️</span><span style="font-size:10px;">18°C</span>';

  weatherEl.addEventListener('click', () => showWeatherModal(getTemperature));
  zoneTopRight.appendChild(weatherEl);

  // Temperature simulation (fluctuates throughout the day)
  const getTemperature = () => {
    const hour = new Date().getHours();
    const base = 16;
    const amplitude = 8;
    const offset = Math.sin((hour - 5) / 24 * 2 * Math.PI) * amplitude;
    // Deterministic "variance" based on the current hour (same for all players)
    const dayOfYear = Math.floor(Date.now() / 86400000);
    const variance = ((dayOfYear * 7 + hour * 13) % 5) - 2; // -2 to +2
    return Math.round(base + offset + variance);
  };

  // Weather visual effects
  const weatherEffects = new WeatherEffects();
  (window as any).weatherEffects = weatherEffects;

  // Update weather periodically
  const updateWeather = async () => {
    const ws = (window as any).weatherSystem;
    const temp = getTemperature();
    if (ws) {
      const weather = ws.getCurrentWeather();
      if (weather) {
        weatherEl.innerHTML = `<span style="font-size:14px;line-height:1;">${weather.emoji}</span><span style="font-size:10px;color:rgba(255,255,255,0.8);">${temp}°C</span>`;
        // Sync visual effects with weather type
        weatherEffects.setWeather(weather.type);
        return;
      }
    }
    weatherEl.innerHTML = `<span style="font-size:14px;line-height:1;">☀️</span><span style="font-size:10px;">${temp}°C</span>`;
    weatherEffects.setWeather('clear');
  };
  setInterval(updateWeather, 10000);
  setTimeout(updateWeather, 1000);

  // Dev mode: weather test panel (only on localhost)
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    const devPanel = document.createElement('div');
    devPanel.style.cssText = 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;gap:4px;background:rgba(0,0,0,0.8);padding:6px 10px;border-radius:10px;';
    ['clear', 'rain', 'snow', 'fog', 'storm'].forEach(type => {
      const btn = document.createElement('button');
      btn.textContent = { clear: '☀️', rain: '🌧️', snow: '❄️', fog: '🌫️', storm: '⛈️' }[type] || type;
      btn.style.cssText = 'background:rgba(255,255,255,0.15);border:none;color:white;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:14px;';
      btn.addEventListener('click', () => {
        const ws = (window as any).weatherSystem;
        if (ws) {
          ws.forceWeatherChange(type);
          updateWeather();
        }
      });
      devPanel.appendChild(btn);
    });
    document.body.appendChild(devPanel);
  }

  // --- Settings modal with tabs ---
  const modal = document.getElementById('settings-modal')!;
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10000;
    justify-content: center;
    align-items: center;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background: rgba(25, 25, 35, 0.55);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 0;
    max-width: 500px;
    width: 92%;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    color: white;
    display: flex;
    flex-direction: column;
  `;

  // Tab bar (horizontally scrollable)
  const tabBar = document.createElement('div');
  tabBar.style.cssText = `
    display: flex;
    overflow-x: auto;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  `;
  const tabs = [
    { id: 'skins', label: '👤 Skins' },
    { id: 'missions', label: '🎯 Missions' },
    { id: 'codex', label: '📖 Emoji-pedia' },
    { id: 'achievements', label: '🏆 Achievements' },
    { id: 'profile', label: '📊 Stats' },
  ];

  const tabContent = document.createElement('div');
  tabContent.style.cssText = `flex: 1; overflow-y: auto; padding: 16px;`;

  // Close button
  const closeRow = document.createElement('div');
  closeRow.style.cssText = `display:flex;justify-content:flex-end;padding:8px 12px 0;flex-shrink:0;`;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `background:rgba(255,255,255,0.1);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;`;
  closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  closeRow.appendChild(closeBtn);

  let activeTab = 'skins';

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    btn.style.cssText = `
      flex-shrink: 0;
      padding: 10px 16px;
      border: none;
      background: transparent;
      color: rgba(255,255,255,0.5);
      font-size: 13px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
    `;
    btn.addEventListener('click', () => {
      activeTab = tab.id;
      tabBar.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
        (b as HTMLElement).style.borderBottomColor = 'transparent';
      });
      btn.style.color = 'white';
      btn.style.borderBottomColor = '#6366f1';
      renderTabContent(tab.id);
    });
    if (tab.id === activeTab) {
      btn.style.color = 'white';
      btn.style.borderBottomColor = '#6366f1';
    }
    tabBar.appendChild(btn);
  });

  panel.appendChild(closeRow);
  panel.appendChild(tabBar);
  panel.appendChild(tabContent);
  modal.appendChild(panel);

  // Open modal
  settingsBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    renderTabContent(activeTab);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  function renderTabContent(tabId: string) {
    switch (tabId) {
      case 'skins': renderSkinsTab(); break;
      case 'missions': renderMissionsTab(); break;
      case 'codex': renderCodexTab(); break;
      case 'achievements': renderAchievementsTab(); break;
      case 'profile': renderProfileTab(); break;
    }
  }

  function renderMissionsTab() {
    const tracker = document.getElementById('active-missions-tracker');
    const activeMissions = tracker?.innerHTML || '';
    const hasActive = activeMissions.trim().length > 0;

    tabContent.innerHTML = `
      <h3 style="margin:0 0 12px;font-size:16px;">🎯 Active Missions</h3>
      ${hasActive ? activeMissions : '<p style="opacity:0.5;font-size:13px;margin-bottom:16px;">No active missions right now.</p>'}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:13px;font-weight:500;margin-bottom:8px;">📍 Visit landmarks to find missions:</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:12px;opacity:0.7;">🏛️ The Metropolitan Museum of Art</div>
          <div style="font-size:12px;opacity:0.7;">🌃 Times Square</div>
          <div style="font-size:12px;opacity:0.7;">🌳 Central Park</div>
          <div style="font-size:12px;opacity:0.7;">🗽 Statue of Liberty</div>
          <div style="font-size:12px;opacity:0.7;">🌉 Brooklyn Bridge</div>
          <div style="font-size:12px;opacity:0.7;">🏙️ Empire State Building</div>
          <div style="font-size:12px;opacity:0.7;">🎭 Broadway</div>
          <div style="font-size:12px;opacity:0.7;">🏟️ Madison Square Garden</div>
        </div>
      </div>
    `;
  }

  function renderCodexTab() {
    const discovery: EmojiDiscoverySystem = (window as any).emojiDiscovery;
    if (!discovery) {
      tabContent.innerHTML = '<p style="opacity:0.6">Start playing to discover emojis!</p>';
      return;
    }

    const progress = discovery.getAllCategoryProgress();
    const total = discovery.getTotalCount();
    const found = discovery.getDiscoveredCount();
    const pct = total > 0 ? Math.round((found / total) * 100) : 0;

    const CATEGORY_NAMES: Record<string, string> = {
      japanese: '🈹 Japanese', mystical: '🔮 Mystical', nature: '🌿 Nature',
      marine: '🐟 Marine', creatures: '🦊 Creatures', food: '🍕 Food',
      buildings: '🏠 Buildings', transport: '🚕 Transport', celestial: '☀️ Celestial',
      tools: '🔨 Tools', music: '🎷 Music', sports: '⚾ Sports',
      hearts: '❤️ Hearts', symbols: '💎 Symbols',
    };
    const RARITY_COLORS: Record<string, string> = {
      common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
    };

    let html = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span>${found} / ${total} discovered</span>
          <span style="color:#f59e0b;font-weight:bold;">${pct}%</span>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:3px;"></div>
        </div>
      </div>
    `;

    for (const catProgress of progress) {
      const catName = CATEGORY_NAMES[catProgress.category] || catProgress.category;
      const catEmojis = discovery.getByCategory(catProgress.category as EmojiCategory);

      html += `
        <div style="margin-bottom:12px;background:rgba(255,255,255,0.05);border-radius:8px;padding:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:bold;font-size:13px;">${catName}</span>
            <span style="font-size:11px;opacity:0.7;">${catProgress.discovered}/${catProgress.total}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:3px;">
      `;
      for (const entry of catEmojis) {
        const isFound = discovery.isDiscovered(entry.emoji);
        const rarityColor = RARITY_COLORS[entry.rarity];
        html += `<span title="${isFound ? `${entry.name}: ${entry.meaning}` : '???'}" style="
          font-size:18px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          border-radius:4px;border:1px solid ${isFound ? rarityColor : 'rgba(255,255,255,0.1)'};
          background:${isFound ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)'};
          ${isFound ? '' : 'filter:grayscale(1) brightness(0.3);'}
        ">${entry.emoji}</span>`;
      }
      html += '</div></div>';
    }

    tabContent.innerHTML = html;
  }

  function renderAchievementsTab() {
    const allAch = achievements.getAchievements();
    let html = '';
    for (const ach of allAch) {
      html += `
        <div style="display:flex;gap:10px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,${ach.unlocked ? '0.08' : '0.03'});border-radius:8px;${ach.unlocked ? '' : 'opacity:0.5;'}">
          <span style="font-size:24px;">${ach.icon}</span>
          <div style="flex:1;">
            <div style="font-weight:bold;font-size:13px;">${ach.name}</div>
            <div style="font-size:11px;opacity:0.7;">${ach.description}</div>
            ${ach.unlocked ? '<div style="font-size:10px;color:#22c55e;margin-top:2px;">✅ Unlocked</div>' : ''}
          </div>
          <div style="font-size:11px;opacity:0.5;text-align:right;">
            <div>💰 ${ach.coinReward}</div>
            <div>⭐ ${ach.xpReward} XP</div>
          </div>
        </div>
      `;
    }
    tabContent.innerHTML = html || '<p style="opacity:0.6">No achievements yet.</p>';
  }

  function renderProfileTab() {
    const stats = progression.getStats();
    const user = authService.getUser();
    const pct = stats.xpToNextLevel > 0 ? Math.round((stats.xp / stats.xpToNextLevel) * 100) : 0;

    tabContent.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        ${user?.avatarUrl ? `<img src="${user.avatarUrl}" style="width:48px;height:48px;border-radius:50%;margin-bottom:8px;">` : ''}
        <div style="font-size:18px;font-weight:bold;">${user?.name || 'Guest'}</div>
        <div style="font-size:12px;opacity:0.6;">${user?.isGuest ? 'Guest Player' : user?.email || ''}</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>⭐ Level ${stats.level}</span>
          <span style="font-size:12px;opacity:0.7;">${stats.xp} / ${stats.xpToNextLevel} XP</span>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#6366f1;border-radius:3px;"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;">🌳</div>
          <div style="font-size:16px;font-weight:bold;">${stats.totalResourcesCollected}</div>
          <div style="font-size:11px;opacity:0.6;">Resources</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;">🏠</div>
          <div style="font-size:16px;font-weight:bold;">${stats.totalBuildingsPlaced}</div>
          <div style="font-size:11px;opacity:0.6;">Buildings</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;">🎯</div>
          <div style="font-size:16px;font-weight:bold;">${stats.totalMissionsCompleted}</div>
          <div style="font-size:11px;opacity:0.6;">Missions</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;">💰</div>
          <div style="font-size:16px;font-weight:bold;">${stats.totalCoins}</div>
          <div style="font-size:11px;opacity:0.6;">Coins</div>
        </div>
      </div>
    `;
  }

  function renderSkinsTab() {
    const currentSprite = parseInt(localStorage.getItem('gallax_player_sprite') || '1');
    tabContent.innerHTML = `
      <div style="font-size:13px;margin-bottom:10px;opacity:0.6;">Tap a character to change your skin</div>
      <div id="settings-sprite-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:3px;max-height:60vh;overflow-y:auto;"></div>
    `;

    const grid = document.getElementById('settings-sprite-grid');
    if (grid) {
      for (let i = 1; i <= 125; i++) {
        const btn = document.createElement('button');
        const isSelected = i === currentSprite;
        btn.style.cssText = `
          aspect-ratio:1;width:100%;
          border:${isSelected ? '2px solid #6366f1' : 'none'};
          border-radius:4px;
          background:${isSelected ? 'rgba(99,102,241,0.2)' : 'transparent'};
          cursor:pointer;padding:2px;
        `;
        btn.innerHTML = `<img src="/sprites/${i}.png" loading="lazy" style="width:100%;height:100%;image-rendering:pixelated;object-fit:contain;">`;
        btn.addEventListener('click', () => {
          const game = (window as any).game;
          if (game?.changePlayerSprite) {
            game.changePlayerSprite(i);
            localStorage.setItem('gallax_player_sprite', i.toString());
            renderSkinsTab();
          }
        });
        grid.appendChild(btn);
      }
    }
  }
}

function showMissionsModal(): void {
  document.getElementById('missions-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'missions-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;justify-content:center;align-items:center;';

  const panel = document.createElement('div');
  panel.className = 'glass';
  panel.style.cssText = 'border-radius:20px;padding:0;max-width:420px;width:92%;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,0.08);box-shadow:0 8px 32px rgba(0,0,0,0.2);';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;';
  header.innerHTML = '<span style="font-size:16px;font-weight:600;color:white;">🎯 Missions</span>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:rgba(255,255,255,0.1);border:none;color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;';
  closeBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Tabs
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;';

  const tabs = [
    { id: 'life', label: '🏠 Life Missions' },
    { id: 'world', label: '🌍 World Missions' },
    { id: 'completed', label: '✅ Completed' },
  ];

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;padding:12px;color:white;';

  let activeTab = 'life';

  function renderTab(tabId: string) {
    const lifeMissions = (window as any).lifeMissions;

    if (tabId === 'life') {
      if (!lifeMissions) {
        content.innerHTML = '<p style="opacity:0.5;font-size:13px;">Loading missions...</p>';
        return;
      }
      const active = lifeMissions.getActiveMissions();
      if (active.length === 0) {
        content.innerHTML = '<p style="opacity:0.5;font-size:13px;">🎉 All life missions complete!</p>';
        return;
      }
      content.innerHTML = active.map((m: any) => {
        const progress = lifeMissions.getProgress(m.id);
        const pct = progress.target > 0 ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
        return `
          <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
              <span style="font-size:20px;">${m.emoji}</span>
              <div style="flex:1;">
                <div style="font-weight:600;font-size:13px;">${m.title}</div>
                <div style="font-size:11px;opacity:0.6;">${m.description}</div>
              </div>
              <span style="font-size:11px;color:#fbbf24;">+${m.reward.xp} XP</span>
            </div>
            <div style="width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:#3b82f6;border-radius:2px;transition:width 0.3s;"></div>
            </div>
            <div style="font-size:10px;opacity:0.5;margin-top:3px;">${progress.current} / ${progress.target}</div>
          </div>
        `;
      }).join('');
    } else if (tabId === 'world') {
      content.innerHTML = `
        <p style="opacity:0.5;font-size:13px;margin-bottom:12px;">Visit landmarks to find world missions!</p>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:12px;opacity:0.7;">🏛️ The Metropolitan Museum of Art</div>
          <div style="font-size:12px;opacity:0.7;">🌃 Times Square</div>
          <div style="font-size:12px;opacity:0.7;">🌳 Central Park</div>
          <div style="font-size:12px;opacity:0.7;">🗽 Statue of Liberty</div>
          <div style="font-size:12px;opacity:0.7;">🌉 Brooklyn Bridge</div>
          <div style="font-size:12px;opacity:0.7;">🏙️ Empire State Building</div>
          <div style="font-size:12px;opacity:0.7;">🎭 Broadway</div>
          <div style="font-size:12px;opacity:0.7;">🏟️ Madison Square Garden</div>
        </div>
      `;
    } else if (tabId === 'completed') {
      if (!lifeMissions) {
        content.innerHTML = '<p style="opacity:0.5;">No completed missions yet.</p>';
        return;
      }
      const completed = lifeMissions.getCompletedMissions();
      if (completed.length === 0) {
        content.innerHTML = '<p style="opacity:0.5;font-size:13px;">No completed missions yet.</p>';
        return;
      }
      content.innerHTML = completed.map((c: any) => `
        <div style="display:flex;gap:8px;align-items:center;padding:8px;margin-bottom:4px;opacity:0.6;">
          <span style="font-size:16px;">${c.mission.emoji}</span>
          <div style="flex:1;">
            <div style="font-size:12px;">${c.mission.title}</div>
          </div>
          <span style="font-size:10px;color:#22c55e;">✅</span>
        </div>
      `).join('');
    }
  }

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.style.cssText = `flex:1;padding:8px;border:none;background:transparent;color:${tab.id === activeTab ? 'white' : 'rgba(255,255,255,0.4)'};font-size:12px;cursor:pointer;border-bottom:2px solid ${tab.id === activeTab ? '#3b82f6' : 'transparent'};`;
    btn.addEventListener('click', () => {
      activeTab = tab.id;
      tabBar.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.color = 'rgba(255,255,255,0.4)';
        (b as HTMLElement).style.borderBottomColor = 'transparent';
      });
      btn.style.color = 'white';
      btn.style.borderBottomColor = '#3b82f6';
      renderTab(tab.id);
    });
    tabBar.appendChild(btn);
  });

  panel.appendChild(tabBar);
  panel.appendChild(content);
  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  renderTab(activeTab);
}

function showWeatherModal(getTemp: () => number): void {
  document.getElementById('weather-modal')?.remove();

  const ws = (window as any).weatherSystem;
  if (!ws) return;
  const weather = ws.getCurrentWeather();
  const temp = getTemp();
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour < 20;

  // Simulated environmental stats
  const humidity = 40 + Math.floor(Math.random() * 40);
  const wind = Math.floor(Math.random() * 25);
  const visibility = weather.type === 'fog' ? '2 km' : weather.type === 'storm' ? '5 km' : '15 km';
  const sunrise = '6:15 AM';
  const sunset = '7:42 PM';

  const overlay = document.createElement('div');
  overlay.id = 'weather-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10000;display:flex;justify-content:center;align-items:center;';

  const panel = document.createElement('div');
  panel.className = 'glass';
  panel.style.cssText = 'border-radius:20px;padding:24px;max-width:320px;width:90%;color:white;border:1px solid rgba(255,255,255,0.08);box-shadow:0 8px 32px rgba(0,0,0,0.2);';

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:48px;">${weather.emoji}</div>
      <div style="font-size:24px;font-weight:700;">${temp}°C</div>
      <div style="font-size:14px;opacity:0.7;">${weather.name}</div>
    </div>

    <div style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:10px;padding:10px;margin-bottom:14px;">
      <div style="font-size:12px;font-weight:600;color:#60a5fa;margin-bottom:4px;">⚡ Gameplay Effects</div>
      <div style="font-size:12px;opacity:0.8;">${weather.description}</div>
      ${weather.xpMultiplier > 1 ? `<div style="font-size:11px;color:#fbbf24;margin-top:4px;">XP Multiplier: ${weather.xpMultiplier}x</div>` : ''}
      ${weather.resourceBonus ? `<div style="font-size:11px;color:#22c55e;margin-top:2px;">${weather.resourceBonus.type} spawn rate: ${weather.resourceBonus.multiplier}x</div>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:10px;opacity:0.5;">Humidity</div>
        <div style="font-size:14px;">${humidity}%</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:10px;opacity:0.5;">Wind</div>
        <div style="font-size:14px;">${wind} km/h</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:10px;opacity:0.5;">Visibility</div>
        <div style="font-size:14px;">${visibility}</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;">
        <div style="font-size:10px;opacity:0.5;">Time</div>
        <div style="font-size:14px;">${isDaytime ? '☀️ Day' : '🌙 Night'}</div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;display:flex;justify-content:space-between;font-size:12px;opacity:0.6;">
      <span>🌅 ${sunrise}</span>
      <span>🌇 ${sunset}</span>
    </div>
  `;

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Update missions badge count
function updateMissionsBadge(): void {
  const badge = document.getElementById('missions-badge');
  const lifeMissions = (window as any).lifeMissions;
  if (badge && lifeMissions) {
    const active = lifeMissions.getActiveMissions();
    badge.textContent = active.length.toString();
    badge.style.display = active.length > 0 ? 'flex' : 'none';
  }
}

// Periodically update badge
setInterval(updateMissionsBadge, 5000);

main().catch(console.error);
