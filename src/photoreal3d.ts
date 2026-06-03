type LatLngAltitude = {
  lat: number;
  lng: number;
  altitude?: number;
};

type Orientation3D = {
  heading?: number;
  tilt?: number;
  roll?: number;
};

type Maps3DLibrary = {
  Map3DElement: new (options?: Record<string, unknown>) => Map3DElementLike;
  Model3DElement: new (options?: Record<string, unknown>) => Model3DElementLike;
  Model3DInteractiveElement?: new (options?: Record<string, unknown>) => Model3DElementLike;
  Marker3DElement?: new (options?: Record<string, unknown>) => Marker3DElementLike;
  Polyline3DElement?: new (options?: Record<string, unknown>) => Polyline3DElementLike;
  MapMode?: Record<string, string>;
};

type GoogleMapsNamespace = {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
  };
};

type Map3DElementLike = HTMLElement & {
  center: LatLngAltitude;
  heading: number;
  range: number;
  tilt: number;
  mode?: string;
};

type Model3DElementLike = HTMLElement & {
  altitudeMode?: string;
  orientation?: Orientation3D;
  position: LatLngAltitude;
  scale?: number | { x: number; y: number; z: number };
  src: string;
};

type Marker3DElementLike = HTMLElement & {
  label?: string;
  position?: LatLngAltitude;
  drawsWhenOccluded?: boolean;
};

type Polyline3DElementLike = HTMLElement & {
  path?: LatLngAltitude[];
  strokeColor?: string;
  strokeWidth?: number;
};

type JobDef = {
  id: string;
  pickupName: string;
  pickup: LatLngAltitude;
  dropoffName: string;
  dropoff: LatLngAltitude;
  reward: number;
  bonusSeconds: number;
};

type BoostDef = {
  id: string;
  name: string;
  position: LatLngAltitude;
  seconds: number;
  score: number;
};

type GamePhase = 'ready' | 'pickup' | 'dropoff' | 'complete' | 'failed';

type CourierState = {
  lat: number;
  lng: number;
  heading: number;
  cameraMode: 'follow' | 'orbit' | 'free' | 'manual';
  mapMode: 'HYBRID' | 'SATELLITE';
  pressed: Set<string>;
  lastFrame: number;
  orbit: number;
  cameraHeading: number;
  cameraTilt: number;
  cameraRange: number;
  moving: boolean;
  phase: GamePhase;
  jobIndex: number;
  score: number;
  delivered: number;
  timeLeft: number;
  boostLeft: number;
  message: string;
  consumedBoosts: Set<string>;
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    gm_authFailure?: () => void;
    __gallaxGoogleMapsLoaded?: () => void;
    __p3dGame?: {
      state: CourierState;
      hold: (key: string, ms?: number) => void;
      dragCamera: (dx: number, dy: number) => void;
      teleportToTarget: () => void;
      start: () => void;
    };
  }
}

const KEY_STORAGE = 'gallax_google_maps_api_key';
const SCRIPT_ID = 'google-maps-3d-js';
const PLAYER_MODEL_URL = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
const DEBUG_MODEL_URL = 'https://maps-docs-team.web.app/assets/windmill.glb';
const SHIFT_SECONDS = 120;
const INTERACT_DISTANCE_METERS = 28;
const STARTING_HEADING = 36;

const TIMES_SQUARE = {
  lat: 40.758896,
  lng: -73.98513,
};

const COMPANIONS = [
  { name: 'Kai', lat: 40.75852, lng: -73.98484, heading: 35 },
  { name: 'Mina', lat: 40.75924, lng: -73.98555, heading: 210 },
  { name: 'Noa', lat: 40.75821, lng: -73.98562, heading: 125 },
];

const MIDTOWN_BOUNDS = {
  north: 40.7657,
  south: 40.7526,
  east: -73.9774,
  west: -73.9929,
};

const JOBS: JobDef[] = [
  {
    id: 'tkts-radio-city',
    pickupName: 'TKTS Times Square',
    pickup: { lat: 40.75807, lng: -73.98552, altitude: 18 },
    dropoffName: 'Radio City',
    dropoff: { lat: 40.75998, lng: -73.98001, altitude: 18 },
    reward: 140,
    bonusSeconds: 10,
  },
  {
    id: 'bryant-park-grand-central',
    pickupName: 'Bryant Park',
    pickup: { lat: 40.75365, lng: -73.98323, altitude: 18 },
    dropoffName: 'Grand Central',
    dropoff: { lat: 40.75273, lng: -73.97722, altitude: 18 },
    reward: 165,
    bonusSeconds: 12,
  },
  {
    id: 'broadway-moma',
    pickupName: 'Broadway 49th',
    pickup: { lat: 40.76111, lng: -73.98456, altitude: 18 },
    dropoffName: 'MoMA',
    dropoff: { lat: 40.76143, lng: -73.97762, altitude: 18 },
    reward: 180,
    bonusSeconds: 12,
  },
  {
    id: 'library-rockefeller',
    pickupName: 'NY Public Library',
    pickup: { lat: 40.75318, lng: -73.98225, altitude: 18 },
    dropoffName: 'Rockefeller Center',
    dropoff: { lat: 40.75874, lng: -73.97867, altitude: 18 },
    reward: 190,
    bonusSeconds: 14,
  },
  {
    id: 'port-authority-empire',
    pickupName: 'Port Authority',
    pickup: { lat: 40.75728, lng: -73.98978, altitude: 18 },
    dropoffName: 'Empire State',
    dropoff: { lat: 40.74844, lng: -73.98566, altitude: 18 },
    reward: 220,
    bonusSeconds: 18,
  },
];

const BOOSTS: BoostDef[] = [
  { id: 'coffee-46th', name: 'Coffee', position: { lat: 40.75877, lng: -73.98291, altitude: 16 }, seconds: 9, score: 25 },
  { id: 'slice-bryant', name: 'Slice', position: { lat: 40.75485, lng: -73.98408, altitude: 16 }, seconds: 7, score: 20 },
  { id: 'metro-card', name: 'MetroCard', position: { lat: 40.75668, lng: -73.98705, altitude: 16 }, seconds: 11, score: 35 },
];

export async function initPhotoreal3D(): Promise<void> {
  const apiKey = resolveApiKey();
  resetDocument();
  injectStyles();

  const root = document.createElement('main');
  root.id = 'photoreal-3d-root';
  document.body.appendChild(root);

  if (!apiKey) {
    renderKeyGate(root);
    return;
  }

  renderLoading(root);

  try {
    await loadGoogleMaps(apiKey);
    const maps3d = await window.google!.maps.importLibrary('maps3d') as Maps3DLibrary;
    mountPrototype(root, maps3d);
  } catch (error) {
    console.error('Failed to initialize Google Photoreal 3D prototype:', error);
    renderError(root, error instanceof Error ? error.message : 'Google Maps 3D failed to load.');
  }
}

function resolveApiKey(): string {
  const params = new URLSearchParams(window.location.search);
  const queryKey = params.get('key') || params.get('googleMapsKey');
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (queryKey?.trim()) {
    localStorage.setItem(KEY_STORAGE, queryKey.trim());
    params.delete('key');
    params.delete('googleMapsKey');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);
    return queryKey.trim();
  }

  return envKey?.trim() || localStorage.getItem(KEY_STORAGE)?.trim() || '';
}

function resetDocument(): void {
  document.title = 'Photoreal 3D NYC - gallax';
  document.body.innerHTML = '';
  document.documentElement.classList.add('photoreal-3d-page');
}

function renderKeyGate(root: HTMLElement): void {
  root.innerHTML = `
    <section class="p3d-key-gate">
      <form class="p3d-key-card">
        <div class="p3d-brand">Photoreal 3D NYC</div>
        <label class="p3d-key-label" for="p3d-key-input">Google Maps API key</label>
        <input id="p3d-key-input" class="p3d-key-input" type="password" autocomplete="off" spellcheck="false" />
        <button class="p3d-key-submit" type="submit">Open 3D Scene</button>
        <a class="p3d-back-link" href="/">Back to 2D game</a>
      </form>
    </section>
  `;

  const form = root.querySelector('form');
  const input = root.querySelector<HTMLInputElement>('#p3d-key-input');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input?.value.trim();
    if (!value) return;
    localStorage.setItem(KEY_STORAGE, value);
    void initPhotoreal3D();
  });
}

function renderLoading(root: HTMLElement): void {
  root.innerHTML = `
    <section class="p3d-loading">
      <div class="p3d-spinner"></div>
      <div class="p3d-loading-title">Loading photoreal NYC</div>
    </section>
  `;
}

function renderError(root: HTMLElement, message: string): void {
  root.innerHTML = `
    <section class="p3d-key-gate">
      <div class="p3d-key-card">
        <div class="p3d-brand">Photoreal 3D NYC</div>
        <div class="p3d-error">${escapeHtml(message)}</div>
        <button id="p3d-clear-key" class="p3d-key-submit" type="button">Use a different key</button>
        <a class="p3d-back-link" href="/">Back to 2D game</a>
      </div>
    </section>
  `;

  root.querySelector('#p3d-clear-key')?.addEventListener('click', () => {
    localStorage.removeItem(KEY_STORAGE);
    void initPhotoreal3D();
  });
}

async function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return;

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load.')), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Timed out loading Google Maps.')), 20000);

    window.__gallaxGoogleMapsLoaded = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    window.gm_authFailure = () => {
      window.clearTimeout(timeout);
      reject(new Error('Google Maps rejected the API key. Check API enablement and HTTP referrer restrictions.'));
    };

    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=beta&libraries=maps3d&loading=async&callback=__gallaxGoogleMapsLoaded`;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Google Maps script failed to load.'));
    };
    document.head.appendChild(script);
  });
}

function mountPrototype(root: HTMLElement, maps3d: Maps3DLibrary): void {
  root.innerHTML = '';

  const map = new maps3d.Map3DElement({
    center: { ...TIMES_SQUARE, altitude: 95 },
    heading: STARTING_HEADING,
    tilt: 42,
    range: 430,
    mode: maps3d.MapMode?.HYBRID || 'HYBRID',
    gestureHandling: 'GREEDY',
  });
  map.className = 'p3d-map';
  root.appendChild(map);

  const state: CourierState = {
    lat: TIMES_SQUARE.lat,
    lng: TIMES_SQUARE.lng,
    heading: STARTING_HEADING,
    cameraMode: 'follow',
    mapMode: 'HYBRID',
    pressed: new Set<string>(),
    lastFrame: performance.now(),
    orbit: STARTING_HEADING,
    cameraHeading: STARTING_HEADING,
    cameraTilt: 42,
    cameraRange: 430,
    moving: false,
    phase: 'ready',
    jobIndex: 0,
    score: 0,
    delivered: 0,
    timeLeft: SHIFT_SECONDS,
    boostLeft: 0,
    message: 'Deliver five real Midtown drops before time runs out.',
    consumedBoosts: new Set<string>(),
  };

  const ModelCtor = maps3d.Model3DInteractiveElement || maps3d.Model3DElement;
  const player = new ModelCtor({
    src: PLAYER_MODEL_URL,
    position: { lat: state.lat, lng: state.lng, altitude: 0 },
    orientation: { heading: state.heading, tilt: 0, roll: 0 },
    scale: 2.15,
    altitudeMode: 'CLAMP_TO_GROUND',
  });
  player.className = 'p3d-player-model';
  map.appendChild(player);

  addCompanions(map, maps3d, ModelCtor);
  const gameScene = createGameScene(map, maps3d, state);
  addDebugModel(map, maps3d);

  const hud = renderHud(root, state);
  bindControls(hud, state, gameScene);
  bindKeyboard(state);
  updateObjectiveScene(state, gameScene);
  updateHud(state);
  window.__p3dGame = {
    state,
    hold: (key: string, ms = 1000) => {
      state.pressed.add(key);
      window.setTimeout(() => state.pressed.delete(key), ms);
    },
    dragCamera: (dx: number, dy: number) => {
      state.cameraMode = 'manual';
      state.cameraHeading = (state.cameraHeading - dx * 0.35 + 360) % 360;
      state.cameraTilt = clamp(state.cameraTilt + dy * 0.12, 24, 62);
    },
    teleportToTarget: () => {
      const target = getCurrentTarget(state);
      if (!target) return;
      state.lat = target.lat;
      state.lng = target.lng;
      resolveObjective(state, gameScene);
      updateObjectiveScene(state, gameScene);
      updateHud(state);
    },
    start: () => startShift(state, gameScene),
  };

  let lastTickAt = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;
    lastTickAt = now;
    updatePlayer(state, player, map, gameScene, dt);
    updateHud(state);
  };

  const animationTick = (now: number) => {
    tick(now);
    requestAnimationFrame(animationTick);
  };
  requestAnimationFrame(animationTick);
  window.setInterval(() => {
    const now = performance.now();
    if (now - lastTickAt > 120) tick(now);
  }, 50);
}

function addCompanions(
  map: Map3DElementLike,
  maps3d: Maps3DLibrary,
  ModelCtor: new (options?: Record<string, unknown>) => Model3DElementLike,
): void {
  for (const companion of COMPANIONS) {
    const model = new ModelCtor({
      src: PLAYER_MODEL_URL,
      position: { lat: companion.lat, lng: companion.lng, altitude: 0 },
      orientation: { heading: companion.heading, tilt: 0, roll: 0 },
      scale: 1.35,
      altitudeMode: 'CLAMP_TO_GROUND',
    });
    map.appendChild(model);

    if (maps3d.Marker3DElement) {
      const marker = new maps3d.Marker3DElement({
        position: { lat: companion.lat, lng: companion.lng, altitude: 22 },
        altitudeMode: 'RELATIVE_TO_GROUND',
        label: companion.name,
        extruded: true,
        sizePreserved: true,
        zIndex: 10,
      });
      map.appendChild(marker);
    }
  }
}

type GameScene = {
  playerMarker: Marker3DElementLike | null;
  playerSpriteMarker: Marker3DElementLike | null;
  activePickup: Marker3DElementLike | null;
  activeDropoff: Marker3DElementLike | null;
  boostMarkers: Map<string, Marker3DElementLike>;
  routeLine: Polyline3DElementLike | null;
  maps3d: Maps3DLibrary;
  map: Map3DElementLike;
};

function createGameScene(map: Map3DElementLike, maps3d: Maps3DLibrary, state: CourierState): GameScene {
  const scene: GameScene = {
    playerMarker: null,
    playerSpriteMarker: null,
    activePickup: null,
    activeDropoff: null,
    boostMarkers: new Map(),
    routeLine: null,
    maps3d,
    map,
  };

  if (maps3d.Marker3DElement) {
    const playerMarker = new maps3d.Marker3DElement({
      position: { lat: state.lat, lng: state.lng, altitude: 18 },
      altitudeMode: 'RELATIVE_TO_GROUND',
      label: 'YOU',
      extruded: true,
      sizePreserved: true,
      zIndex: 999,
      collisionBehavior: 'REQUIRED',
    });
    playerMarker.classList.add('p3d-player-beacon');
    map.appendChild(playerMarker);
    scene.playerMarker = playerMarker;

    const playerSpriteMarker = new maps3d.Marker3DElement({
      position: { lat: state.lat, lng: state.lng, altitude: 2 },
      altitudeMode: 'RELATIVE_TO_GROUND',
      sizePreserved: true,
      zIndex: 998,
      collisionBehavior: 'REQUIRED',
    });
    playerSpriteMarker.classList.add('p3d-player-sprite-marker');
    playerSpriteMarker.appendChild(createSpriteMarkerTemplate('/sprites/1.png'));
    map.appendChild(playerSpriteMarker);
    scene.playerSpriteMarker = playerSpriteMarker;

    for (const boost of BOOSTS) {
      const marker = new maps3d.Marker3DElement({
        position: boost.position,
        altitudeMode: 'RELATIVE_TO_GROUND',
        label: boost.name,
        drawsWhenOccluded: true,
        extruded: true,
        sizePreserved: true,
        zIndex: 30,
      });
      marker.classList.add('p3d-boost-marker');
      map.appendChild(marker);
      scene.boostMarkers.set(boost.id, marker);
    }
  }

  if (maps3d.Polyline3DElement) {
    const line = new maps3d.Polyline3DElement({
      path: [
        { ...TIMES_SQUARE, altitude: 8 },
        { ...TIMES_SQUARE, altitude: 8 },
      ],
      strokeColor: '#7dd3fc',
      strokeWidth: 8,
      altitudeMode: 'RELATIVE_TO_GROUND',
      drawsOccludedSegments: true,
    });
    line.classList.add('p3d-route-line');
    map.appendChild(line);
    scene.routeLine = line;
  }

  return scene;
}

function createSpriteMarkerTemplate(src: string): HTMLTemplateElement {
  const template = document.createElement('template');
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.width = 64;
  img.height = 64;
  img.style.imageRendering = 'pixelated';
  img.style.filter = 'drop-shadow(0 8px 8px rgba(0, 0, 0, 0.55))';
  template.content.appendChild(img);
  return template;
}

function updateObjectiveScene(state: CourierState, scene: GameScene): void {
  scene.activePickup?.remove();
  scene.activeDropoff?.remove();
  scene.activePickup = null;
  scene.activeDropoff = null;

  const job = getCurrentJob(state);
  if (!job) {
    if (scene.routeLine) {
      scene.routeLine.path = [
        { lat: state.lat, lng: state.lng, altitude: 8 },
        { lat: state.lat, lng: state.lng, altitude: 8 },
      ];
    }
    return;
  }

  const markerCtor = scene.maps3d.Marker3DElement;
  if (markerCtor && (state.phase === 'pickup' || state.phase === 'dropoff')) {
    scene.activePickup = new markerCtor({
      position: job.pickup,
      altitudeMode: 'RELATIVE_TO_GROUND',
      label: state.phase === 'pickup' ? 'PICKUP' : 'Picked',
      drawsWhenOccluded: true,
      extruded: true,
      sizePreserved: true,
      zIndex: state.phase === 'pickup' ? 80 : 25,
    });
    scene.activePickup.classList.add(state.phase === 'pickup' ? 'p3d-target-marker' : 'p3d-muted-marker');
    scene.map.appendChild(scene.activePickup);

    scene.activeDropoff = new markerCtor({
      position: job.dropoff,
      altitudeMode: 'RELATIVE_TO_GROUND',
      label: 'DROP',
      drawsWhenOccluded: true,
      extruded: true,
      sizePreserved: true,
      zIndex: state.phase === 'dropoff' ? 90 : 25,
    });
    scene.activeDropoff.classList.add(state.phase === 'dropoff' ? 'p3d-target-marker' : 'p3d-muted-marker');
    scene.map.appendChild(scene.activeDropoff);
  }

  if (scene.routeLine) {
    const target = getCurrentTarget(state);
    scene.routeLine.path = target
      ? [
          { lat: state.lat, lng: state.lng, altitude: 8 },
          { lat: target.lat, lng: target.lng, altitude: 8 },
        ]
      : [
          { lat: state.lat, lng: state.lng, altitude: 8 },
          { lat: state.lat, lng: state.lng, altitude: 8 },
        ];
  }

}

function addSceneMarkers(map: Map3DElementLike, maps3d: Maps3DLibrary): void {
  if (!maps3d.Marker3DElement) return;

  const markers = [
    { label: 'Drop', lat: 40.75912, lng: -73.9842, altitude: 16 },
    { label: 'Shop', lat: 40.75796, lng: -73.98595, altitude: 16 },
    { label: 'Gate', lat: 40.75862, lng: -73.98625, altitude: 16 },
  ];

  for (const markerDef of markers) {
    const marker = new maps3d.Marker3DElement({
      position: markerDef,
      altitudeMode: 'RELATIVE_TO_GROUND',
      label: markerDef.label,
      extruded: true,
      sizePreserved: true,
      zIndex: 20,
    });
    map.appendChild(marker);
  }
}

function addDebugModel(map: Map3DElementLike, maps3d: Maps3DLibrary): void {
  const model = new maps3d.Model3DElement({
    src: DEBUG_MODEL_URL,
    position: { lat: 40.75883, lng: -73.98455, altitude: 0 },
    orientation: { heading: 35, tilt: 270, roll: 90 },
    scale: 0.08,
    altitudeMode: 'CLAMP_TO_GROUND',
  });
  map.appendChild(model);
}

function renderHud(root: HTMLElement, state: CourierState): HTMLElement {
  const hud = document.createElement('section');
  hud.className = 'p3d-hud';
  hud.innerHTML = `
    <div class="p3d-topbar">
      <a class="p3d-icon-btn" href="/" aria-label="Back to 2D game">←</a>
      <div class="p3d-title">
        <span>Midtown Rush 3D</span>
        <span id="p3d-status">Ready in Times Square</span>
      </div>
      <button class="p3d-icon-btn" data-action="mode" aria-label="Toggle map mode">◐</button>
      <button class="p3d-icon-btn" data-action="camera" aria-label="Toggle camera">${state.cameraMode === 'follow' ? '◎' : '◌'}</button>
    </div>
    <div class="p3d-scorebar">
      <div class="p3d-stat">
        <span>Time</span>
        <strong id="p3d-time">2:00</strong>
      </div>
      <div class="p3d-stat">
        <span>Score</span>
        <strong id="p3d-score">0</strong>
      </div>
      <div class="p3d-stat">
        <span>Drops</span>
        <strong id="p3d-drops">0/${JOBS.length}</strong>
      </div>
      <button class="p3d-start-btn" data-action="start">Start</button>
    </div>
    <div class="p3d-objective" id="p3d-objective">
      <div id="p3d-objective-kicker">Courier Shift</div>
      <strong id="p3d-objective-main">Complete five drops around real Midtown.</strong>
      <span id="p3d-objective-sub">Use the controls or WASD. Pickups and dropoffs trigger when close.</span>
    </div>
    <div class="p3d-target-pointer" id="p3d-target-pointer" aria-hidden="true">
      <span id="p3d-target-arrow">↑</span>
      <strong id="p3d-target-distance">0m</strong>
    </div>
    <div class="p3d-pad" aria-label="Movement controls">
      <button class="p3d-pad-btn" data-hold="up" aria-label="Move north">↑</button>
      <button class="p3d-pad-btn" data-hold="left" aria-label="Move west">←</button>
      <button class="p3d-pad-core" data-action="pulse" aria-label="Ping character">●</button>
      <button class="p3d-pad-btn" data-hold="right" aria-label="Move east">→</button>
      <button class="p3d-pad-btn" data-hold="down" aria-label="Move south">↓</button>
    </div>
    <div class="p3d-toast" id="p3d-toast"></div>
  `;
  root.appendChild(hud);
  return hud;
}

function bindControls(
  hud: HTMLElement,
  state: CourierState,
  scene: GameScene,
): void {
  const cameraButton = hud.querySelector<HTMLButtonElement>('[data-action="camera"]');
  const modeButton = hud.querySelector<HTMLButtonElement>('[data-action="mode"]');
  const startButton = hud.querySelector<HTMLButtonElement>('[data-action="start"]');

  cameraButton?.addEventListener('click', () => {
    state.cameraMode = state.cameraMode === 'follow' ? 'orbit' : state.cameraMode === 'orbit' ? 'free' : 'follow';
    cameraButton.textContent = state.cameraMode === 'follow' ? '◎' : state.cameraMode === 'orbit' ? '◌' : state.cameraMode === 'manual' ? '↻' : '◇';
  });

  modeButton?.addEventListener('click', () => {
    state.mapMode = state.mapMode === 'HYBRID' ? 'SATELLITE' : 'HYBRID';
  });

  startButton?.addEventListener('click', () => {
    if (state.phase === 'pickup' || state.phase === 'dropoff') {
      resetShift(state, scene);
    } else {
      startShift(state, scene);
    }
  });

  hud.querySelector<HTMLElement>('[data-action="pulse"]')?.addEventListener('click', () => {
    state.message = getCurrentTarget(state)
      ? `Target is ${Math.round(distanceMeters(state, getCurrentTarget(state)!))}m away.`
      : 'Start the shift to reveal the first delivery.';
    updateHud(state);
  });

  bindCameraDrag(state, cameraButton);

  hud.querySelectorAll<HTMLElement>('[data-hold]').forEach((button) => {
    const key = button.dataset.hold;
    if (!key) return;

    const press = (event: Event) => {
      event.preventDefault();
      state.pressed.add(key);
      button.classList.add('is-active');
    };
    const release = (event: Event) => {
      event.preventDefault();
      state.pressed.delete(key);
      button.classList.remove('is-active');
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('mousedown', press);
    button.addEventListener('mouseup', release);
    button.addEventListener('mouseleave', release);
    button.addEventListener('touchstart', press, { passive: false });
    button.addEventListener('touchend', release);
    button.addEventListener('touchcancel', release);
  });
}

function bindCameraDrag(state: CourierState, cameraButton: HTMLButtonElement | null): void {
  let drag: { id: number; x: number; y: number; started: boolean } | null = null;
  const ignoreSelector = 'button, a, input, .p3d-topbar, .p3d-scorebar, .p3d-pad, .p3d-toast';

  window.addEventListener('pointerdown', (event) => {
    const target = event.target as Element | null;
    if (target?.closest(ignoreSelector)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, started: false };
  }, { capture: true });

  window.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.started && Math.hypot(dx, dy) < 4) return;

    drag.started = true;
    event.preventDefault();
    state.cameraMode = 'manual';
    state.cameraHeading = (state.cameraHeading - dx * 0.35 + 360) % 360;
    state.cameraTilt = clamp(state.cameraTilt + dy * 0.12, 24, 62);
    cameraButton && (cameraButton.textContent = '↻');
    drag.x = event.clientX;
    drag.y = event.clientY;
  }, { capture: true });

  window.addEventListener('pointerup', (event) => {
    if (drag?.id === event.pointerId) drag = null;
  }, { capture: true });

  window.addEventListener('pointercancel', (event) => {
    if (drag?.id === event.pointerId) drag = null;
  }, { capture: true });

  window.addEventListener('wheel', (event) => {
    const target = event.target as Element | null;
    if (target?.closest(ignoreSelector)) return;
    event.preventDefault();
    state.cameraMode = 'manual';
    state.cameraRange = clamp(state.cameraRange + event.deltaY * 0.35, 260, 720);
    cameraButton && (cameraButton.textContent = '↻');
  }, { passive: false, capture: true });
}

function bindKeyboard(state: { pressed: Set<string> }): void {
  const mapKey = (key: string): string | null => {
    switch (key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        return 'up';
      case 'arrowdown':
      case 's':
        return 'down';
      case 'arrowleft':
      case 'a':
        return 'left';
      case 'arrowright':
      case 'd':
        return 'right';
      default:
        return null;
    }
  };

  window.addEventListener('keydown', (event) => {
    const mapped = mapKey(event.key);
    if (!mapped) return;
    event.preventDefault();
    state.pressed.add(mapped);
  });

  window.addEventListener('keyup', (event) => {
    const mapped = mapKey(event.key);
    if (!mapped) return;
    event.preventDefault();
    state.pressed.delete(mapped);
  });
}

function updatePlayer(
  state: CourierState,
  player: Model3DElementLike,
  map: Map3DElementLike,
  scene: GameScene,
  dt: number,
): void {
  const dx = (state.pressed.has('right') ? 1 : 0) - (state.pressed.has('left') ? 1 : 0);
  const dy = (state.pressed.has('up') ? 1 : 0) - (state.pressed.has('down') ? 1 : 0);
  const length = Math.hypot(dx, dy);

  if (length > 0) {
    const speedMetersPerSecond = state.boostLeft > 0 ? 39 : 25;
    const moveMeters = speedMetersPerSecond * dt;
    const nx = dx / length;
    const ny = dy / length;
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(state.lat * Math.PI / 180);
    const north = ny;
    const east = nx;

    state.lat = clamp(state.lat + (north * moveMeters) / metersPerDegreeLat, MIDTOWN_BOUNDS.south, MIDTOWN_BOUNDS.north);
    state.lng = clamp(state.lng + (east * moveMeters) / metersPerDegreeLng, MIDTOWN_BOUNDS.west, MIDTOWN_BOUNDS.east);
    state.heading = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    state.moving = true;
  } else {
    state.moving = false;
  }

  if (state.phase === 'pickup' || state.phase === 'dropoff') {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.boostLeft = Math.max(0, state.boostLeft - dt);
    if (state.timeLeft <= 0) {
      state.phase = 'failed';
      state.message = `Shift over. ${state.delivered}/${JOBS.length} delivered for ${state.score} points.`;
      updateObjectiveScene(state, scene);
    } else {
      resolveBoosts(state, scene);
      resolveObjective(state, scene);
    }
  }

  player.position = { lat: state.lat, lng: state.lng, altitude: 0 };
  player.orientation = { heading: state.heading, tilt: 0, roll: 0 };
  player.scale = state.moving ? 2.25 + Math.sin(performance.now() / 90) * 0.08 : 2.15;
  if (scene.playerMarker) {
    scene.playerMarker.position = {
      lat: state.lat,
      lng: state.lng,
      altitude: state.moving ? 22 : 18,
    };
  }
  if (scene.playerSpriteMarker) {
    scene.playerSpriteMarker.position = {
      lat: state.lat,
      lng: state.lng,
      altitude: state.moving ? 5 : 2,
    };
  }

  if (state.cameraMode === 'orbit') {
    state.orbit = (state.orbit + dt * 12) % 360;
    state.cameraHeading = state.orbit;
  } else if (state.cameraMode === 'follow') {
    state.cameraHeading = smoothAngle(state.cameraHeading || state.heading, state.heading, 0.08);
    state.cameraTilt = 42;
    state.cameraRange = 430;
  } else if (state.cameraMode === 'free') {
    state.cameraTilt = 34;
    state.cameraRange = 650;
  }

  map.heading = state.cameraHeading;
  map.center = { lat: state.lat, lng: state.lng, altitude: cameraAltitudeFor(state.cameraTilt, state.cameraRange) };
  map.range = state.cameraRange;
  map.tilt = state.cameraTilt;
  map.mode = state.mapMode;

  if (scene.routeLine) {
    const target = getCurrentTarget(state);
    scene.routeLine.path = target
      ? [
          { lat: state.lat, lng: state.lng, altitude: 8 },
          { lat: target.lat, lng: target.lng, altitude: 8 },
        ]
      : [
          { lat: state.lat, lng: state.lng, altitude: 8 },
          { lat: state.lat, lng: state.lng, altitude: 8 },
        ];
  }

}

function startShift(state: CourierState, scene: GameScene): void {
  state.phase = 'pickup';
  state.jobIndex = 0;
  state.score = 0;
  state.delivered = 0;
  state.timeLeft = SHIFT_SECONDS;
  state.boostLeft = 0;
  state.consumedBoosts.clear();
  state.message = `Pickup waiting at ${JOBS[0].pickupName}.`;
  for (const marker of scene.boostMarkers.values()) {
    marker.style.display = '';
  }
  updateObjectiveScene(state, scene);
  updateHud(state);
}

function resetShift(state: CourierState, scene: GameScene): void {
  state.phase = 'ready';
  state.jobIndex = 0;
  state.score = 0;
  state.delivered = 0;
  state.timeLeft = SHIFT_SECONDS;
  state.boostLeft = 0;
  state.message = 'Shift reset. Complete five real Midtown drops before time runs out.';
  state.consumedBoosts.clear();
  for (const marker of scene.boostMarkers.values()) {
    marker.style.display = '';
  }
  updateObjectiveScene(state, scene);
  updateHud(state);
}

function resolveObjective(state: CourierState, scene: GameScene): void {
  const job = getCurrentJob(state);
  const target = getCurrentTarget(state);
  if (!job || !target) return;

  const distance = distanceMeters(state, target);
  if (distance > INTERACT_DISTANCE_METERS) return;

  if (state.phase === 'pickup') {
    state.phase = 'dropoff';
    state.score += 30;
    state.message = `Package picked up. Deliver to ${job.dropoffName}.`;
    updateObjectiveScene(state, scene);
    return;
  }

  if (state.phase === 'dropoff') {
    state.delivered += 1;
    state.score += job.reward + Math.ceil(state.timeLeft * 0.6);
    state.timeLeft += job.bonusSeconds;
    state.jobIndex += 1;

    if (state.jobIndex >= JOBS.length) {
      state.phase = 'complete';
      state.message = `All drops complete. Final score ${state.score}.`;
    } else {
      const next = JOBS[state.jobIndex];
      state.phase = 'pickup';
      state.message = `Delivered to ${job.dropoffName}. Next pickup: ${next.pickupName}.`;
    }
    updateObjectiveScene(state, scene);
  }
}

function resolveBoosts(state: CourierState, scene: GameScene): void {
  for (const boost of BOOSTS) {
    if (state.consumedBoosts.has(boost.id)) continue;
    if (distanceMeters(state, boost.position) > INTERACT_DISTANCE_METERS) continue;

    state.consumedBoosts.add(boost.id);
    state.boostLeft = Math.max(state.boostLeft, boost.seconds);
    state.score += boost.score;
    state.message = `${boost.name} boost: faster movement for ${boost.seconds}s.`;
    const marker = scene.boostMarkers.get(boost.id);
    if (marker) marker.style.display = 'none';
  }
}

function getCurrentJob(state: CourierState): JobDef | null {
  return JOBS[state.jobIndex] || null;
}

function getCurrentTarget(state: CourierState): LatLngAltitude | null {
  const job = getCurrentJob(state);
  if (!job) return null;
  if (state.phase === 'pickup') return job.pickup;
  if (state.phase === 'dropoff') return job.dropoff;
  return null;
}

function updateHud(state: CourierState): void {
  setText('p3d-time', formatTime(state.timeLeft));
  setText('p3d-score', String(Math.max(0, Math.round(state.score))));
  setText('p3d-drops', `${state.delivered}/${JOBS.length}`);
  setText('p3d-status', state.phase === 'ready' ? 'Ready in Times Square' : `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`);

  const startButton = document.querySelector<HTMLButtonElement>('[data-action="start"]');
  if (startButton) {
    startButton.textContent = state.phase === 'pickup' || state.phase === 'dropoff' ? 'Reset' : state.phase === 'ready' ? 'Start' : 'Again';
  }

  const currentJob = getCurrentJob(state);
  const target = getCurrentTarget(state);
  const kicker = document.getElementById('p3d-objective-kicker');
  const main = document.getElementById('p3d-objective-main');
  const sub = document.getElementById('p3d-objective-sub');
  const toast = document.getElementById('p3d-toast');
  const objective = document.getElementById('p3d-objective');

  if (kicker && main && sub && objective) {
    objective.classList.toggle('is-finished', state.phase === 'complete');
    objective.classList.toggle('is-failed', state.phase === 'failed');

    if (state.phase === 'ready') {
      kicker.textContent = 'Courier Shift';
      main.textContent = 'Complete five drops around real Midtown.';
      sub.textContent = 'Start, then reach pickup and dropoff markers before time expires.';
    } else if (state.phase === 'pickup' && currentJob && target) {
      kicker.textContent = `Job ${state.jobIndex + 1} of ${JOBS.length}: Pickup`;
      main.textContent = currentJob.pickupName;
      sub.textContent = `${Math.round(distanceMeters(state, target))}m away. Reward ${currentJob.reward}.`;
    } else if (state.phase === 'dropoff' && currentJob && target) {
      kicker.textContent = `Job ${state.jobIndex + 1} of ${JOBS.length}: Dropoff`;
      main.textContent = currentJob.dropoffName;
      sub.textContent = `${Math.round(distanceMeters(state, target))}m away. Package onboard.`;
    } else if (state.phase === 'complete') {
      kicker.textContent = 'Shift Complete';
      main.textContent = `Final score ${Math.round(state.score)}`;
      sub.textContent = 'All Midtown drops delivered.';
    } else if (state.phase === 'failed') {
      kicker.textContent = 'Shift Failed';
      main.textContent = `${state.delivered}/${JOBS.length} delivered`;
      sub.textContent = `Final score ${Math.round(state.score)}.`;
    }
  }

  if (toast) {
    toast.textContent = state.boostLeft > 0
      ? `${state.message} Boost ${Math.ceil(state.boostLeft)}s`
      : state.message;
    toast.classList.toggle('is-visible', state.message.length > 0);
  }

  const pointer = document.getElementById('p3d-target-pointer');
  const arrow = document.getElementById('p3d-target-arrow');
  const distance = document.getElementById('p3d-target-distance');
  if (pointer && arrow && distance) {
    pointer.classList.toggle('is-visible', !!target);
    pointer.style.display = target ? 'flex' : 'none';
    pointer.style.setProperty('opacity', target ? '1' : '0', 'important');
    if (target) {
      const bearing = bearingDegrees(state, target);
      arrow.style.transform = `rotate(${bearing}deg)`;
      distance.textContent = `${Math.round(distanceMeters(state, target))}m`;
    }
  }
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadius = 6_371_000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothAngle(current: number, target: number, alpha: number): number {
  const delta = ((target - current + 540) % 360) - 180;
  return (current + delta * alpha + 360) % 360;
}

function cameraAltitudeFor(tilt: number, range: number): number {
  return clamp(38 + (62 - tilt) * 2.2 + range * 0.025, 70, 150);
}

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .photoreal-3d-page,
    .photoreal-3d-page body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #05070a;
      color: #fff;
      overscroll-behavior: none;
      touch-action: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #photoreal-3d-root {
      position: fixed;
      inset: 0;
      background: #05070a;
    }

    .p3d-map {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      background: #05070a;
    }

    .p3d-loading,
    .p3d-key-gate {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      background: radial-gradient(circle at 50% 30%, rgba(43, 89, 116, 0.38), rgba(5, 7, 10, 0.96) 58%);
    }

    .p3d-spinner {
      width: 34px;
      height: 34px;
      border: 3px solid rgba(255, 255, 255, 0.18);
      border-top-color: #fff;
      border-radius: 50%;
      animation: p3d-spin 0.8s linear infinite;
      margin: 0 auto 14px;
    }

    @keyframes p3d-spin {
      to { transform: rotate(360deg); }
    }

    .p3d-loading-title {
      font-size: 14px;
      opacity: 0.86;
      text-align: center;
    }

    .p3d-key-card {
      width: min(360px, 100%);
      background: rgba(10, 14, 19, 0.82);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      padding: 18px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
    }

    .p3d-brand {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 14px;
    }

    .p3d-key-label {
      display: block;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
      margin-bottom: 6px;
    }

    .p3d-key-input {
      width: 100%;
      height: 42px;
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      padding: 0 10px;
      outline: none;
    }

    .p3d-key-submit,
    .p3d-back-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 42px;
      margin-top: 10px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 14px;
    }

    .p3d-key-submit {
      border: 0;
      color: #041018;
      background: #7dd3fc;
      font-weight: 700;
      cursor: pointer;
    }

    .p3d-back-link {
      color: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.16);
    }

    .p3d-error {
      padding: 10px 12px;
      border-radius: 6px;
      background: rgba(248, 113, 113, 0.16);
      border: 1px solid rgba(248, 113, 113, 0.34);
      color: #fecaca;
      font-size: 13px;
      line-height: 1.4;
    }

    .p3d-hud {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 20;
    }

    .p3d-topbar {
      position: absolute;
      top: max(10px, env(safe-area-inset-top));
      left: 10px;
      right: 10px;
      min-height: 46px;
      display: grid;
      grid-template-columns: 44px 1fr 44px 44px;
      gap: 8px;
      align-items: center;
      pointer-events: auto;
    }

    .p3d-scorebar {
      position: absolute;
      top: calc(max(10px, env(safe-area-inset-top)) + 54px);
      left: 10px;
      right: 10px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)) 74px;
      gap: 8px;
      pointer-events: auto;
    }

    .p3d-stat,
    .p3d-start-btn,
    .p3d-objective,
    .p3d-toast {
      background: rgba(6, 10, 14, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.13);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    }

    .p3d-stat {
      min-width: 0;
      height: 48px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 10px;
    }

    .p3d-stat span {
      color: rgba(255, 255, 255, 0.58);
      font-size: 10px;
      line-height: 1;
      margin-bottom: 5px;
    }

    .p3d-stat strong {
      font-size: 18px;
      line-height: 1;
      color: #fff;
    }

    .p3d-start-btn {
      min-width: 0;
      height: 48px;
      border-radius: 8px;
      color: #041018;
      background: #7dd3fc;
      font-weight: 800;
      cursor: pointer;
      border-color: rgba(255, 255, 255, 0.28);
    }

    .p3d-objective {
      position: absolute;
      top: calc(max(10px, env(safe-area-inset-top)) + 110px);
      left: 10px;
      right: 10px;
      min-height: 78px;
      border-radius: 8px;
      padding: 11px 12px 12px;
      pointer-events: none;
    }

    #p3d-objective-kicker {
      color: #7dd3fc;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
      margin-bottom: 5px;
    }

    #p3d-objective-main {
      display: block;
      font-size: 20px;
      line-height: 1.08;
      margin-bottom: 5px;
    }

    #p3d-objective-sub {
      display: block;
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      line-height: 1.28;
    }

    .p3d-objective.is-finished {
      border-color: rgba(52, 211, 153, 0.55);
    }

    .p3d-objective.is-failed {
      border-color: rgba(248, 113, 113, 0.58);
    }

    .p3d-target-pointer {
      position: absolute;
      left: 50%;
      top: 57%;
      width: 64px;
      min-height: 54px;
      transform: translate(44px, -92%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      border-radius: 8px;
      background: rgba(6, 10, 14, 0.68);
      border: 1px solid rgba(125, 211, 252, 0.45);
      color: #fff;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.16s ease;
      z-index: 13;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .p3d-target-pointer.is-visible {
      opacity: 1;
    }

    #p3d-target-arrow {
      display: block;
      width: 28px;
      height: 28px;
      line-height: 26px;
      border-radius: 50%;
      background: rgba(125, 211, 252, 0.2);
      color: #7dd3fc;
      font-size: 20px;
      font-weight: 900;
      text-align: center;
      transform-origin: center;
    }

    #p3d-target-distance {
      display: block;
      font-size: 11px;
      line-height: 1;
      color: rgba(255, 255, 255, 0.86);
    }

    .p3d-toast {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: calc(max(18px, env(safe-area-inset-bottom)) + 156px);
      min-height: 38px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      color: rgba(255, 255, 255, 0.88);
      font-size: 12px;
      text-align: center;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    .p3d-toast.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .p3d-title {
      min-width: 0;
      height: 44px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 12px;
      border-radius: 8px;
      background: rgba(6, 10, 14, 0.54);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .p3d-title span:first-child {
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #p3d-status {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.62);
      margin-top: 2px;
    }

    .p3d-icon-btn,
    .p3d-pad-btn,
    .p3d-pad-core {
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(6, 10, 14, 0.58);
      color: #fff;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      cursor: pointer;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .p3d-icon-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      font-size: 20px;
    }

    .p3d-pad {
      position: absolute;
      left: 50%;
      bottom: max(18px, env(safe-area-inset-bottom));
      transform: translateX(-50%);
      width: min(238px, calc(100vw - 24px));
      aspect-ratio: 5 / 3;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 8px;
      pointer-events: auto;
    }

    .p3d-pad-btn,
    .p3d-pad-core {
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      font-size: 20px;
    }

    .p3d-pad-btn[data-hold="up"] { grid-column: 3; grid-row: 1; }
    .p3d-pad-btn[data-hold="left"] { grid-column: 2; grid-row: 2; }
    .p3d-pad-core { grid-column: 3; grid-row: 2; color: #7dd3fc; }
    .p3d-pad-btn[data-hold="right"] { grid-column: 4; grid-row: 2; }
    .p3d-pad-btn[data-hold="down"] { grid-column: 3; grid-row: 3; }

    .p3d-icon-btn:active,
    .p3d-pad-btn.is-active,
    .p3d-pad-btn:active,
    .p3d-pad-core:active {
      background: rgba(125, 211, 252, 0.28);
      border-color: rgba(125, 211, 252, 0.7);
    }

    @media (min-width: 720px) {
      .p3d-topbar {
        left: 16px;
        right: auto;
        width: min(520px, calc(100vw - 32px));
      }

      .p3d-scorebar,
      .p3d-objective,
      .p3d-toast {
        left: 16px;
        right: auto;
        width: min(520px, calc(100vw - 32px));
      }

      .p3d-pad {
        left: 24px;
        bottom: 24px;
        transform: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
