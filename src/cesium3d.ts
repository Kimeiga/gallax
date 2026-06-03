type CesiumGlobal = any;

declare global {
  interface Window {
    Cesium?: CesiumGlobal;
    __cesium3D?: {
      state: CesiumGameState;
      diagnostics: CesiumDiagnostics;
      start: () => void;
      hold: (key: string, ms?: number) => void;
      dragCamera: (dx: number, dy: number) => void;
      teleportToTarget: () => void;
      setPlayer: (lng: number, lat: number) => void;
      moveTo: (lng: number, lat: number) => void;
      zoom: (delta: number) => void;
      fire: () => void;
      visibility: () => VisibilityProbe;
    };
  }
}

type CesiumGamePhase = 'ready' | 'pickup' | 'dropoff' | 'complete' | 'failed';
type TileMode = 'google' | 'osm';

type LngLatHeight = {
  lng: number;
  lat: number;
  height?: number;
};

type CesiumJob = {
  id: string;
  pickupName: string;
  pickup: LngLatHeight;
  dropoffName: string;
  dropoff: LngLatHeight;
  reward: number;
  bonusSeconds: number;
};

type CesiumGameState = {
  lng: number;
  lat: number;
  height: number;
  heading: number;
  cameraHeading: number;
  cameraPitch: number;
  cameraRange: number;
  pressed: Set<string>;
  phase: CesiumGamePhase;
  jobIndex: number;
  score: number;
  delivered: number;
  timeLeft: number;
  message: string;
  lastTick: number;
  moving: boolean;
  moveTarget: LngLatHeight | null;
  stickMove: { x: number; y: number } | null;
  aimVector: { x: number; y: number } | null;
  attackCooldown: number;
  pointerLocked: boolean;
};

type CombatEnemy = {
  id: string;
  lng: number;
  lat: number;
  hp: number;
  entity: any;
};

type CesiumDiagnostics = {
  tileSource: 'google-photorealistic' | 'cesium-osm-buildings' | 'none';
  tileStatus: 'loading' | 'root-loaded' | 'streaming' | 'ready' | 'error';
  tileQueue: number | null;
  tileError: string;
  lod: string;
  depthPickSupported: boolean;
  pickFromRaySupported: boolean;
  lastProbe: VisibilityProbe | null;
};

type VisibilityProbe = {
  screen?: { x: number; y: number };
  cameraDistance?: number;
  hitDistance?: number;
  visible: boolean;
  reason: string;
};

const CESIUM_VERSION = '1.134';
const CESIUM_JS_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js`;
const CESIUM_CSS_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;
const GOOGLE_TILESET_ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json';
const KEY_STORAGE = 'gallax_google_maps_api_key';
const CESIUM_TOKEN_STORAGE = 'gallax_cesium_ion_token';
const PLAYER_SPRITE = '/sprites/1.png';
const PLAYER_SPRITE_NATIVE_WIDTH = 18;
const PLAYER_SPRITE_NATIVE_HEIGHT = 31;
const PLAYER_SPRITE_DISPLAY_HEIGHT = 66;
const PLAYER_SPRITE_DISPLAY_WIDTH = Math.round(
  PLAYER_SPRITE_DISPLAY_HEIGHT * (PLAYER_SPRITE_NATIVE_WIDTH / PLAYER_SPRITE_NATIVE_HEIGHT),
);
const SHIFT_SECONDS = 120;
const INTERACT_DISTANCE_METERS = 28;
const MOVE_SPEED_METERS_PER_SECOND = 34;
const MOVE_TARGET_RADIUS_METERS = 3;
const DESKTOP_SHOOT_DRAG_THRESHOLD_PX = 8;
const MIN_CAMERA_RANGE = 115;
const MAX_CAMERA_RANGE = 980;
const ATTACK_RANGE_METERS = 105;
const ATTACK_HALF_WIDTH_METERS = 10;
const ATTACK_COOLDOWN_SECONDS = 0.45;
const PLAYER_BASE_HEIGHT = 0;
const CAMERA_TARGET_HEIGHT = 18;
const VISIBILITY_PROBE_HEIGHT = 8;

const START = { lat: 40.758896, lng: -73.98513 };

const ENEMY_SPAWNS: Array<Omit<CombatEnemy, 'entity'>> = [
  { id: 'rival-7th', lng: -73.98564, lat: 40.75933, hp: 2 },
  { id: 'rival-46th', lng: -73.98474, lat: 40.75843, hp: 2 },
  { id: 'rival-broadway', lng: -73.98423, lat: 40.75908, hp: 2 },
];

const JOBS: CesiumJob[] = [
  {
    id: 'tkts-radio-city',
    pickupName: 'TKTS Times Square',
    pickup: { lat: 40.75807, lng: -73.98552, height: 5 },
    dropoffName: 'Radio City',
    dropoff: { lat: 40.75998, lng: -73.98001, height: 5 },
    reward: 140,
    bonusSeconds: 10,
  },
  {
    id: 'bryant-park-grand-central',
    pickupName: 'Bryant Park',
    pickup: { lat: 40.75365, lng: -73.98323, height: 5 },
    dropoffName: 'Grand Central',
    dropoff: { lat: 40.75273, lng: -73.97722, height: 5 },
    reward: 165,
    bonusSeconds: 12,
  },
  {
    id: 'broadway-moma',
    pickupName: 'Broadway 49th',
    pickup: { lat: 40.76111, lng: -73.98456, height: 5 },
    dropoffName: 'MoMA',
    dropoff: { lat: 40.76143, lng: -73.97762, height: 5 },
    reward: 180,
    bonusSeconds: 12,
  },
];

export async function initCesium3D(): Promise<void> {
  const googleKey = resolveKey('key', 'googleMapsKey', 'VITE_GOOGLE_MAPS_API_KEY', KEY_STORAGE);
  const cesiumToken = resolveKey('cesiumToken', 'token', 'VITE_CESIUM_ION_TOKEN', CESIUM_TOKEN_STORAGE);
  const tileMode = resolveTileMode();

  resetDocument();
  injectStyles();

  const root = document.createElement('main');
  root.id = 'cesium-3d-root';
  document.body.appendChild(root);

  if (!googleKey && tileMode === 'google') {
    renderKeyGate(root);
    return;
  }

  root.innerHTML = '<section class="c3d-loading"><div class="c3d-spinner"></div><span>Loading Cesium 3D tiles</span></section>';

  try {
    await loadCesium();
    mountCesiumGame(root, googleKey, cesiumToken, tileMode);
  } catch (error) {
    console.error('Failed to initialize Cesium 3D route:', error);
    root.innerHTML = `<section class="c3d-error">${escapeHtml(error instanceof Error ? error.message : String(error))}</section>`;
  }
}

function resolveTileMode(): TileMode {
  const mode = new URLSearchParams(window.location.search).get('tiles');
  return mode === 'osm' ? 'osm' : 'google';
}

function resolveKey(queryName: string, altQueryName: string, envName: keyof ImportMetaEnv, storageKey: string): string {
  const params = new URLSearchParams(window.location.search);
  const queryKey = params.get(queryName) || params.get(altQueryName);
  if (queryKey?.trim()) {
    localStorage.setItem(storageKey, queryKey.trim());
    params.delete(queryName);
    params.delete(altQueryName);
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);
    return queryKey.trim();
  }
  const envValue = import.meta.env[envName];
  return typeof envValue === 'string' && envValue.trim() ? envValue.trim() : localStorage.getItem(storageKey)?.trim() || '';
}

function resetDocument(): void {
  document.title = 'Cesium 3D Midtown - gallax';
  document.body.innerHTML = '';
  document.documentElement.classList.add('cesium-3d-page');
}

function renderKeyGate(root: HTMLElement): void {
  root.innerHTML = `
    <section class="c3d-key-gate">
      <form class="c3d-key-card">
        <strong>Cesium 3D Midtown</strong>
        <label for="c3d-google-key">Google Maps API key with Map Tiles API enabled</label>
        <input id="c3d-google-key" type="password" autocomplete="off" />
        <label for="c3d-cesium-token">Cesium ion token, optional</label>
        <input id="c3d-cesium-token" type="password" autocomplete="off" />
        <button type="submit">Open Cesium Scene</button>
      </form>
    </section>
  `;

  root.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const googleKey = root.querySelector<HTMLInputElement>('#c3d-google-key')?.value.trim();
    const cesiumToken = root.querySelector<HTMLInputElement>('#c3d-cesium-token')?.value.trim();
    if (!googleKey) return;
    localStorage.setItem(KEY_STORAGE, googleKey);
    if (cesiumToken) localStorage.setItem(CESIUM_TOKEN_STORAGE, cesiumToken);
    void initCesium3D();
  });
}

async function loadCesium(): Promise<void> {
  if (window.Cesium) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CESIUM_CSS_URL;
  document.head.appendChild(link);

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CESIUM_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Cesium failed to load from CDN.'));
    document.head.appendChild(script);
  });
}

function mountCesiumGame(root: HTMLElement, googleKey: string, cesiumToken: string, tileMode: TileMode): void {
  const Cesium = window.Cesium!;
  Cesium.Ion.defaultAccessToken = cesiumToken || '';
  const isGoogleMode = tileMode === 'google';

  root.innerHTML = `
    <div id="cesium-container"></div>
    <div class="c3d-scene-veil" id="c3d-scene-veil"></div>
    <section class="c3d-hud">
      <div class="c3d-topbar">
        <a href="/" class="c3d-icon" aria-label="Back">←</a>
        <div><strong>Cesium Midtown</strong><span id="c3d-status">Pulse brawler prototype</span></div>
        <button id="c3d-start">Start</button>
      </div>
      <div class="c3d-stats">
        <div><span>Time</span><strong id="c3d-time">2:00</strong></div>
        <div><span>Score</span><strong id="c3d-score">0</strong></div>
        <div><span>Drops</span><strong id="c3d-drops">0/${JOBS.length}</strong></div>
      </div>
      <div class="c3d-objective">
        <span id="c3d-kicker">Courier Shift</span>
        <strong id="c3d-main">Tag rival signals between Times Square towers.</strong>
        <em id="c3d-sub">Courier drops stay active while the city streams.</em>
      </div>
      <div class="c3d-stream" id="c3d-stream"><i></i></div>
      <div class="c3d-aim-line" id="c3d-aim-line"><i></i></div>
      <div class="c3d-crosshair" id="c3d-crosshair" aria-hidden="true"></div>
      <div class="c3d-player-outline" id="c3d-player-outline" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="c3d-mobile-stick-zone" aria-hidden="true"><i></i></div>
      <div class="c3d-stick c3d-stick-move" id="c3d-stick-move"><i></i></div>
      <button class="c3d-fire-button" id="c3d-fire-button" aria-label="Fire"></button>
      <div class="c3d-toast" id="c3d-toast"></div>
    </section>
  `;

  const viewer = new Cesium.Viewer('cesium-container', {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: isGoogleMode ? Cesium.IonGeocodeProviderType?.GOOGLE ?? false : false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    fullscreenButton: false,
    baseLayer: isGoogleMode ? false : undefined,
    globe: isGoogleMode ? false : undefined,
    useDefaultRenderLoop: false,
  });

  if (isGoogleMode && viewer.scene.globe) viewer.scene.globe.show = false;
  if (isGoogleMode && viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
  if (isGoogleMode && viewer.scene.skyBox) viewer.scene.skyBox.show = false;
  viewer.scene.backgroundColor = Cesium.Color.BLACK;
  const cameraController = viewer.scene.screenSpaceCameraController;
  cameraController.enableCollisionDetection = false;
  cameraController.enableRotate = false;
  cameraController.enableTranslate = false;
  cameraController.enableZoom = false;
  cameraController.enableTilt = false;
  cameraController.enableLook = false;
  viewer.scene.pickTranslucentDepth = true;
  setStreamVisual(0.08, true);

  const state: CesiumGameState = {
    lng: START.lng,
    lat: START.lat,
    height: PLAYER_BASE_HEIGHT,
    heading: 0,
    cameraHeading: Cesium.Math.toRadians(25),
    cameraPitch: Cesium.Math.toRadians(-46),
    cameraRange: 360,
    pressed: new Set(),
    phase: 'ready',
    jobIndex: 0,
    score: 0,
    delivered: 0,
    timeLeft: SHIFT_SECONDS,
    message: 'Sprite is a Cesium billboard with depth testing on.',
    lastTick: performance.now(),
    moving: false,
    moveTarget: null,
    stickMove: null,
    aimVector: null,
    attackCooldown: 0,
    pointerLocked: false,
  };
  const diagnostics: CesiumDiagnostics = {
    tileSource: 'none',
    tileStatus: 'loading',
    tileQueue: null,
    tileError: '',
    lod: 'balanced',
    depthPickSupported: !!viewer.scene.pickPositionSupported,
    pickFromRaySupported: typeof viewer.scene.pickFromRay === 'function',
    lastProbe: null,
  };

  const playerEntity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height),
    billboard: {
      image: PLAYER_SPRITE,
      width: PLAYER_SPRITE_DISPLAY_WIDTH,
      height: PLAYER_SPRITE_DISPLAY_HEIGHT,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: isGoogleMode
        ? Cesium.HeightReference.RELATIVE_TO_3D_TILE ?? Cesium.HeightReference.NONE
        : Cesium.HeightReference.CLAMP_TO_GROUND ?? Cesium.HeightReference.NONE,
      disableDepthTestDistance: 0,
      scaleByDistance: new Cesium.NearFarScalar(80, 1.15, 900, 0.55),
    },
    label: {
      text: 'YOU',
      font: '700 13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -PLAYER_SPRITE_DISPLAY_HEIGHT - 12),
      disableDepthTestDistance: 0,
      heightReference: isGoogleMode
        ? Cesium.HeightReference.RELATIVE_TO_3D_TILE ?? Cesium.HeightReference.NONE
        : Cesium.HeightReference.CLAMP_TO_GROUND ?? Cesium.HeightReference.NONE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    },
  });

  const targetEntity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(JOBS[0].pickup.lng, JOBS[0].pickup.lat, 22),
    point: {
      pixelSize: 14,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: 0,
    },
    label: {
      text: 'TARGET',
      font: '700 13px sans-serif',
      fillColor: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -28),
      disableDepthTestDistance: 0,
    },
  });

  const moveTargetEntity = viewer.entities.add({
    show: false,
    position: Cesium.Cartesian3.fromDegrees(state.lng, state.lat, 2),
    point: {
      pixelSize: 11,
      color: Cesium.Color.YELLOW.withAlpha(0.86),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: 0,
      heightReference: isGoogleMode
        ? Cesium.HeightReference.CLAMP_TO_3D_TILE ?? Cesium.HeightReference.NONE
        : Cesium.HeightReference.CLAMP_TO_GROUND ?? Cesium.HeightReference.NONE,
    },
  });

  const enemies = createEnemies(Cesium, viewer, isGoogleMode);
  const attackEntity = viewer.entities.add({
    show: false,
    position: Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height + 8),
    point: {
      pixelSize: 13,
      color: Cesium.Color.CYAN.withAlpha(0.96),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: 0,
    },
    polyline: {
      positions: [],
      width: 6,
      material: Cesium.Color.CYAN.withAlpha(0.74),
      clampToGround: false,
    },
  });

  setupCesiumControls(Cesium, state, viewer, moveTargetEntity, enemies, attackEntity);
  updateTargetEntity(Cesium, targetEntity, state);
  updateCamera(Cesium, viewer, state);
  updateHud(state);
  void loadSceneTiles(Cesium, viewer, googleKey, cesiumToken, tileMode, state, diagnostics);
  window.addEventListener('resize', () => {
    viewer.resize();
    updateCamera(Cesium, viewer, state);
  });

  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - state.lastTick) / 1000);
    state.lastTick = now;
    updateGame(Cesium, viewer, state, playerEntity, targetEntity, moveTargetEntity, dt);
    try {
      viewer.render();
    } catch (error) {
      console.error('Cesium render failed:', error);
      state.message = `Cesium render failed. ${error instanceof Error ? error.message : String(error)}`;
      updateHud(state);
      return;
    }
  };
  frame();
  window.setInterval(frame, 1000 / 30);

  window.__cesium3D = {
    state,
    diagnostics,
    start: () => startShift(state, targetEntity),
    hold: (key: string, ms = 1000) => {
      state.pressed.add(key);
      window.setTimeout(() => state.pressed.delete(key), ms);
    },
    dragCamera: (dx: number, dy: number) => {
      state.cameraHeading -= dx * 0.006;
      state.cameraPitch = clamp(state.cameraPitch + dy * 0.003, Cesium.Math.toRadians(-70), Cesium.Math.toRadians(-20));
    },
    teleportToTarget: () => {
      const target = getCurrentTarget(state);
      if (!target) return;
      state.lng = target.lng;
      state.lat = target.lat;
      resolveObjective(state, targetEntity);
    },
    setPlayer: (lng: number, lat: number) => {
      state.lng = lng;
      state.lat = lat;
      clearMoveTarget(state, moveTargetEntity);
    },
    moveTo: (lng: number, lat: number) => {
      setMoveTarget(Cesium, state, moveTargetEntity, { lng, lat });
    },
    zoom: (delta: number) => {
      zoomCamera(Cesium, viewer, state, delta);
    },
    fire: () => {
      fireForwardAttack(Cesium, viewer, state, enemies, attackEntity);
    },
    visibility: () => {
      const probe = probeVisibility(Cesium, viewer, state);
      diagnostics.lastProbe = probe;
      return probe;
    },
  };
}

async function loadSceneTiles(
  Cesium: any,
  viewer: any,
  googleKey: string,
  cesiumToken: string,
  tileMode: TileMode,
  state: CesiumGameState,
  diagnostics: CesiumDiagnostics,
): Promise<void> {
  if (tileMode === 'osm') {
    await loadOsmBuildingFallback(Cesium, viewer, state, diagnostics, true);
    return;
  }

  try {
    state.message = 'Loading Google photorealistic 3D tiles.';
    setStreamVisual(0.16, true);
    updateHud(state);

    if (Cesium.GoogleMaps) Cesium.GoogleMaps.defaultApiKey = googleKey;
    const tileset = await createGoogleTileset(Cesium, googleKey, cesiumToken);

    viewer.scene.primitives.add(tileset);
    diagnostics.tileSource = 'google-photorealistic';
    diagnostics.tileStatus = 'root-loaded';
    state.message = 'Google 3D tiles connected. Streaming Midtown geometry.';
    setStreamVisual(0.34, true);
    attachTilesetDiagnostics(tileset, viewer, state, diagnostics);
    updateHud(state);
  } catch (error) {
    diagnostics.tileSource = 'none';
    diagnostics.tileStatus = 'error';
    diagnostics.tileError = error instanceof Error ? error.message : String(error);
    console.error('Google Photorealistic 3D tiles failed:', error);
    state.message = `Google 3D tiles failed. ${diagnostics.tileError}`;
    setStreamVisual(0.2, true);
    updateHud(state);
    await loadOsmBuildingFallback(Cesium, viewer, state, diagnostics);
  }
}

async function createGoogleTileset(Cesium: any, googleKey: string, cesiumToken: string): Promise<any> {
  const tilesetOptions = {
    showCreditsOnScreen: true,
    maximumScreenSpaceError: 10,
    dynamicScreenSpaceError: true,
    dynamicScreenSpaceErrorDensity: 0.0026,
    dynamicScreenSpaceErrorFactor: 18,
    skipLevelOfDetail: true,
    baseScreenSpaceError: 1024,
    skipScreenSpaceErrorFactor: 16,
    skipLevels: 1,
    immediatelyLoadDesiredLevelOfDetail: false,
    loadSiblings: false,
  };

  if (typeof Cesium.createGooglePhotorealistic3DTileset === 'function') {
    const ionOptions = { onlyUsingWithGoogleGeocoder: true };
    if (cesiumToken) {
      try {
        return await Cesium.createGooglePhotorealistic3DTileset(ionOptions, tilesetOptions);
      } catch (error) {
        console.warn('Cesium ion Google Photorealistic 3D Tiles failed, trying Google key directly:', error);
      }
    }

    return Cesium.createGooglePhotorealistic3DTileset(
      { key: googleKey, onlyUsingWithGoogleGeocoder: true },
      tilesetOptions,
    );
  }

  return Cesium.Cesium3DTileset.fromUrl(`${GOOGLE_TILESET_ROOT}?key=${encodeURIComponent(googleKey)}`, tilesetOptions);
}

async function loadOsmBuildingFallback(
  Cesium: any,
  viewer: any,
  state: CesiumGameState,
  diagnostics: CesiumDiagnostics,
  explicitMode = false,
): Promise<void> {
  if (typeof Cesium.createOsmBuildingsAsync !== 'function') return;

  try {
    state.message = explicitMode
      ? 'Loading Cesium ion OSM buildings for occlusion testing.'
      : 'Falling back to Cesium ion OSM buildings for occlusion testing.';
    setStreamVisual(0.18, true);
    updateHud(state);
    const tileset = await Cesium.createOsmBuildingsAsync({
      style: new Cesium.Cesium3DTileStyle({
        color: "color('white', 0.82)",
      }),
    });
    viewer.scene.primitives.add(tileset);
    diagnostics.tileSource = 'cesium-osm-buildings';
    diagnostics.tileStatus = 'root-loaded';
    diagnostics.tileError = '';
    setStreamVisual(0.42, true);
    attachTilesetDiagnostics(tileset, viewer, state, diagnostics);
    updateHud(state);
  } catch (error) {
    diagnostics.tileStatus = 'error';
    diagnostics.tileError = error instanceof Error ? error.message : String(error);
    console.error('Cesium OSM building fallback failed:', error);
    state.message = `No 3D geometry loaded. ${diagnostics.tileError}`;
    setStreamVisual(1, false);
    updateHud(state);
  }
}

function attachTilesetDiagnostics(
  tileset: any,
  viewer: any,
  state: CesiumGameState,
  diagnostics: CesiumDiagnostics,
): void {
  diagnostics.lod = 'dynamic screen-space error';
  tileset.initialTilesLoaded?.addEventListener?.(() => {
    diagnostics.tileStatus = 'ready';
    diagnostics.tileQueue = 0;
    state.message = diagnostics.tileSource === 'google-photorealistic'
      ? 'Photorealistic Midtown geometry is loaded.'
      : 'Cesium building geometry is loaded for occlusion testing.';
    setStreamVisual(1, false);
    updateHud(state);
    viewer.scene.requestRender();
  });

  tileset.tileLoadProgressEvent?.addEventListener?.((queued: number) => {
    diagnostics.tileQueue = queued;
    diagnostics.tileStatus = queued === 0 ? 'ready' : 'streaming';
    if (queued > 0) {
      state.message = `Streaming 3D geometry. ${queued} tile${queued === 1 ? '' : 's'} queued.`;
      setStreamVisual(clamp(0.72 - Math.min(queued, 40) * 0.008, 0.38, 0.72), true);
      updateHud(state);
    } else {
      setStreamVisual(1, false);
    }
  });
}

function setupCesiumControls(
  Cesium: any,
  state: CesiumGameState,
  viewer: any,
  moveTargetEntity: any,
  enemies: CombatEnemy[],
  attackEntity: any,
): void {
  document.getElementById('c3d-start')?.addEventListener('click', () => startShift(state));
  document.getElementById('c3d-fire-button')?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    button.classList.add('is-active');
    window.setTimeout(() => button.classList.remove('is-active'), 120);
    fireForwardAttack(Cesium, viewer, state, enemies, attackEntity);
  });
  document.querySelector('[data-action="probe"]')?.addEventListener('click', () => {
    const probe = window.__cesium3D?.visibility();
    state.message = probe ? `${probe.reason}${probe.hitDistance ? ` hit ${probe.hitDistance.toFixed(1)}m` : ''}` : 'No probe available.';
    updateHud(state);
  });

  document.querySelectorAll<HTMLElement>('[data-hold]').forEach((button) => {
    const key = button.dataset.hold;
    if (!key) return;
    const press = (event: Event) => {
      event.preventDefault();
      clearMoveTarget(state, moveTargetEntity);
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
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      fireForwardAttack(Cesium, viewer, state, enemies, attackEntity);
      return;
    }
    const mapped = keyToDirection(event.key);
    if (!mapped) return;
    event.preventDefault();
    clearMoveTarget(state, moveTargetEntity);
    state.pressed.add(mapped);
  });
  window.addEventListener('keyup', (event) => {
    const mapped = keyToDirection(event.key);
    if (!mapped) return;
    event.preventDefault();
    state.pressed.delete(mapped);
  });

  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: number; shootOnRelease: boolean } | null = null;
  let pinch: { distance: number; range: number } | null = null;
  let moveStick: { id: number; originX: number; originY: number } | null = null;
  let aimStick: { id: number; originX: number; originY: number } | null = null;
  const canvas = viewer.scene.canvas;
  canvas.addEventListener('contextmenu', (event: MouseEvent) => event.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    document.body.classList.toggle('c3d-pointer-locked', state.pointerLocked);
  });
  document.addEventListener('mousemove', (event: MouseEvent) => {
    if (document.pointerLockElement !== canvas) return;
    rotateCamera(Cesium, viewer, state, event.movementX, event.movementY);
  });

  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    event.preventDefault();

    if (event.pointerType === 'mouse') {
      if (event.button === 0 && document.pointerLockElement === canvas) {
        fireForwardAttack(Cesium, viewer, state, enemies, attackEntity);
        return;
      }
      if (event.button === 0) requestPointerLock(canvas);
    }

    const combatRole = getCombatPointerRole(event);
    if (combatRole === 'move') {
      clearMoveTarget(state, moveTargetEntity);
      moveStick = { id: event.pointerId, originX: event.clientX, originY: event.clientY };
      state.stickMove = { x: 0, y: 0 };
      updateStickVisual('c3d-stick-move', moveStick.originX, moveStick.originY, 0, 0, true);
      capturePointer(canvas, event.pointerId);
      return;
    }
    if (combatRole === 'aim') {
      aimStick = { id: event.pointerId, originX: event.clientX, originY: event.clientY };
      state.aimVector = aimVectorFromPoints(aimStick.originX, aimStick.originY, event.clientX, event.clientY) || state.aimVector || { x: 0, y: 1 };
      updateStickVisual('c3d-stick-aim', aimStick.originX, aimStick.originY, 0, 0, true);
      updateAimVisual(Cesium, viewer, state, true);
      capturePointer(canvas, event.pointerId);
      return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: 0,
        shootOnRelease: event.pointerType === 'mouse' && event.button === 0,
      };
      pinch = null;
    } else if (pointers.size === 2) {
      drag = null;
      pinch = {
        distance: pointerDistance(pointers),
        range: state.cameraRange,
      };
    }
    capturePointer(canvas, event.pointerId);
  });
  canvas.addEventListener('pointermove', (event: PointerEvent) => {
    event.preventDefault();
    if (moveStick?.id === event.pointerId) {
      const next = stickVector(moveStick.originX, moveStick.originY, event.clientX, event.clientY);
      state.stickMove = next;
      updateStickVisual('c3d-stick-move', moveStick.originX, moveStick.originY, next.x, -next.y, true);
      return;
    }
    if (aimStick?.id === event.pointerId) {
      const next = stickVector(aimStick.originX, aimStick.originY, event.clientX, event.clientY);
      state.aimVector = next.x === 0 && next.y === 0 ? state.aimVector : next;
      updateStickVisual('c3d-stick-aim', aimStick.originX, aimStick.originY, next.x, -next.y, true);
      updateAimVisual(Cesium, viewer, state, true);
      return;
    }

    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinch && pointers.size >= 2) {
      const nextDistance = pointerDistance(pointers);
      if (nextDistance > 0 && pinch.distance > 0) {
        const scale = pinch.distance / nextDistance;
        state.cameraRange = clamp(pinch.range * scale, MIN_CAMERA_RANGE, MAX_CAMERA_RANGE);
        updateCamera(Cesium, viewer, state);
        viewer.render();
      }
      return;
    }

    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
    rotateCamera(Cesium, viewer, state, dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('pointerup', (event: PointerEvent) => {
    event.preventDefault();
    if (moveStick?.id === event.pointerId) {
      moveStick = null;
      state.stickMove = null;
      updateStickVisual('c3d-stick-move', 0, 0, 0, 0, false);
      return;
    }
    if (aimStick?.id === event.pointerId) {
      aimStick = null;
      updateStickVisual('c3d-stick-aim', 0, 0, 0, 0, false);
      fireForwardAttack(Cesium, viewer, state, enemies, attackEntity);
      updateAimVisual(Cesium, viewer, state, false);
      return;
    }

    const shouldShoot = drag?.id === event.pointerId && drag.shootOnRelease && drag.moved <= DESKTOP_SHOOT_DRAG_THRESHOLD_PX;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    drag = null;
    if (shouldShoot) fireForwardAttack(Cesium, viewer, state, enemies, attackEntity);
  });
  canvas.addEventListener('pointercancel', (event: PointerEvent) => {
    if (moveStick?.id === event.pointerId) {
      moveStick = null;
      state.stickMove = null;
      updateStickVisual('c3d-stick-move', 0, 0, 0, 0, false);
      return;
    }
    if (aimStick?.id === event.pointerId) {
      aimStick = null;
      updateStickVisual('c3d-stick-aim', 0, 0, 0, 0, false);
      updateAimVisual(Cesium, viewer, state, false);
      return;
    }
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    drag = null;
  });
  canvas.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();
    zoomCamera(Cesium, viewer, state, event.deltaY * 0.36);
  }, { passive: false });
}

function getCombatPointerRole(event: PointerEvent): 'move' | null {
  if (event.pointerType === 'touch' && isMobileMoveZone(event.clientX, event.clientY)) {
    return 'move';
  }
  return null;
}

function isMobileMoveZone(x: number, y: number): boolean {
  const zoneWidth = Math.min(210, window.innerWidth * 0.48);
  const zoneHeight = Math.min(260, window.innerHeight * 0.42);
  return x <= zoneWidth && y >= window.innerHeight - zoneHeight;
}

function requestPointerLock(canvas: HTMLCanvasElement): void {
  try {
    const lockRequest = canvas.requestPointerLock?.();
    if (lockRequest && typeof lockRequest.catch === 'function') lockRequest.catch(() => {});
  } catch {
    // Pointer lock can be denied outside a trusted click; drag rotation still works.
  }
}

function rotateCamera(Cesium: any, viewer: any, state: CesiumGameState, dx: number, dy: number): void {
  state.cameraHeading -= dx * 0.006;
  state.cameraPitch = clamp(state.cameraPitch + dy * 0.003, -1.22, -0.35);
  updateCamera(Cesium, viewer, state);
  viewer.render();
}

function capturePointer(canvas: HTMLCanvasElement, pointerId: number): void {
  try {
    canvas.setPointerCapture?.(pointerId);
  } catch {
    // Synthetic pointer events in tests are not always eligible for capture.
  }
}

function stickVector(originX: number, originY: number, x: number, y: number): { x: number; y: number } {
  const maxDistance = 74;
  const dx = x - originX;
  const dy = y - originY;
  const length = Math.hypot(dx, dy);
  if (length < 7) return { x: 0, y: 0 };
  const scale = Math.min(1, length / maxDistance);
  return {
    x: (dx / length) * scale,
    y: (-dy / length) * scale,
  };
}

function aimVectorFromPoints(originX: number, originY: number, x: number, y: number): { x: number; y: number } | null {
  const dx = x - originX;
  const dy = originY - y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return null;
  return { x: dx / length, y: dy / length };
}

function updateStickVisual(id: string, x: number, y: number, knobX: number, knobY: number, active: boolean): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.setProperty('--c3d-stick-x', `${x}px`);
  el.style.setProperty('--c3d-stick-y', `${y}px`);
  el.style.setProperty('--c3d-stick-knob-x', `${knobX * 28}px`);
  el.style.setProperty('--c3d-stick-knob-y', `${knobY * 28}px`);
  el.classList.toggle('is-active', active);
}

function updateMouseAim(Cesium: any, viewer: any, state: CesiumGameState, clientX: number, clientY: number): void {
  const screen = playerScreenPosition(Cesium, viewer, state);
  if (!screen) return;
  const aim = aimVectorFromPoints(screen.x, screen.y, clientX, clientY);
  if (!aim) return;
  state.aimVector = aim;
  updateAimVisual(Cesium, viewer, state, true);
}

function updateAimVisual(Cesium: any, viewer: any, state: CesiumGameState, active: boolean): void {
  const line = document.getElementById('c3d-aim-line');
  if (!line) return;
  const aim = state.aimVector;
  const screen = playerScreenPosition(Cesium, viewer, state);
  if (!active || !aim || !screen) {
    line.classList.remove('is-active');
    return;
  }
  const length = 132;
  const angle = Math.atan2(-aim.y, aim.x);
  line.style.setProperty('--c3d-aim-x', `${screen.x}px`);
  line.style.setProperty('--c3d-aim-y', `${screen.y}px`);
  line.style.setProperty('--c3d-aim-angle', `${angle}rad`);
  line.style.setProperty('--c3d-aim-length', `${length}px`);
  line.classList.add('is-active');
}

function playerScreenPosition(Cesium: any, viewer: any, state: CesiumGameState): { x: number; y: number } | null {
  const player = Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height + VISIBILITY_PROBE_HEIGHT);
  const screen = viewer.scene.cartesianToCanvasCoordinates(player);
  if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null;
  return { x: screen.x, y: screen.y };
}

function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const pair = [...pointers.values()];
  if (pair.length < 2) return 0;
  return Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
}

function setMoveTarget(Cesium: any, state: CesiumGameState, moveTargetEntity: any, target: LngLatHeight): void {
  state.moveTarget = target;
  state.message = 'Moving to selected point.';
  moveTargetEntity.show = true;
  moveTargetEntity.position = Cesium.Cartesian3.fromDegrees(target.lng, target.lat, 2);
  updateHud(state);
}

function clearMoveTarget(state: CesiumGameState, moveTargetEntity: any): void {
  state.moveTarget = null;
  moveTargetEntity.show = false;
}

function zoomCamera(Cesium: any, viewer: any, state: CesiumGameState, delta: number): void {
  state.cameraRange = clamp(state.cameraRange + delta, MIN_CAMERA_RANGE, MAX_CAMERA_RANGE);
  updateCamera(Cesium, viewer, state);
  viewer.render();
}

function createEnemies(Cesium: any, viewer: any, isGoogleMode: boolean): CombatEnemy[] {
  return ENEMY_SPAWNS.map((spawn) => {
    const entity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(spawn.lng, spawn.lat, 4),
      point: {
        pixelSize: 16,
        color: Cesium.Color.ORANGERED.withAlpha(0.95),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: 0,
        heightReference: isGoogleMode
          ? Cesium.HeightReference.RELATIVE_TO_3D_TILE ?? Cesium.HeightReference.NONE
          : Cesium.HeightReference.CLAMP_TO_GROUND ?? Cesium.HeightReference.NONE,
      },
      label: {
        text: 'RIVAL',
        font: '700 11px sans-serif',
        fillColor: Cesium.Color.ORANGERED,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -28),
        disableDepthTestDistance: 0,
        heightReference: isGoogleMode
          ? Cesium.HeightReference.RELATIVE_TO_3D_TILE ?? Cesium.HeightReference.NONE
          : Cesium.HeightReference.CLAMP_TO_GROUND ?? Cesium.HeightReference.NONE,
      },
    });
    return { ...spawn, entity };
  });
}

function localInputToWorld(state: CesiumGameState, x: number, y: number): { x: number; y: number } {
  const heading = state.cameraHeading;
  return {
    x: x * Math.cos(heading) + y * Math.sin(heading),
    y: -x * Math.sin(heading) + y * Math.cos(heading),
  };
}

function fireForwardAttack(Cesium: any, viewer: any, state: CesiumGameState, enemies: CombatEnemy[], attackEntity: any): void {
  fireAttack(Cesium, viewer, state, enemies, attackEntity, { x: 0, y: 1 });
}

function fireAttack(
  Cesium: any,
  viewer: any,
  state: CesiumGameState,
  enemies: CombatEnemy[],
  attackEntity: any,
  localAim?: { x: number; y: number },
): void {
  if (state.attackCooldown > 0) return;

  const aim = localAim || state.aimVector || { x: 0, y: 1 };
  const worldAim = localInputToWorld(state, aim.x, aim.y);
  const length = Math.hypot(worldAim.x, worldAim.y) || 1;
  const dir = { x: worldAim.x / length, y: worldAim.y / length };
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(state.lat * Math.PI / 180);
  const start = {
    lng: state.lng,
    lat: state.lat,
    height: state.height + 10,
  };
  const end = {
    lng: state.lng + (dir.x * ATTACK_RANGE_METERS) / metersPerDegreeLng,
    lat: state.lat + (dir.y * ATTACK_RANGE_METERS) / metersPerDegreeLat,
    height: state.height + 10,
  };

  attackEntity.show = true;
  attackEntity.position = Cesium.Cartesian3.fromDegrees(start.lng, start.lat, start.height);
  attackEntity.polyline.positions = [
    Cesium.Cartesian3.fromDegrees(start.lng, start.lat, start.height),
    Cesium.Cartesian3.fromDegrees(end.lng, end.lat, end.height),
  ];
  animateProjectile(Cesium, viewer, attackEntity, start, end);
  window.setTimeout(() => {
    if (attackEntity._shotId === undefined) attackEntity.show = false;
  }, 170);

  const hit = findAttackHit(Cesium, viewer, state, enemies, dir);
  if (hit) {
    hit.hp -= 1;
    if (hit.hp <= 0) {
      hit.entity.show = false;
      state.score += 50;
      state.message = 'Rival signal broken.';
    } else {
      state.score += 10;
      state.message = 'Rival tagged.';
    }
  } else {
    state.message = 'Pulse fired.';
  }

  state.attackCooldown = ATTACK_COOLDOWN_SECONDS;
  updateHud(state);
}

function animateProjectile(Cesium: any, viewer: any, attackEntity: any, start: LngLatHeight, end: LngLatHeight): void {
  const shotId = (attackEntity._shotId || 0) + 1;
  attackEntity._shotId = shotId;
  const startedAt = performance.now();
  const duration = 210;

  const step = (now: number) => {
    if (attackEntity._shotId !== shotId) return;
    const t = clamp((now - startedAt) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    const lng = start.lng + (end.lng - start.lng) * eased;
    const lat = start.lat + (end.lat - start.lat) * eased;
    const height = (start.height || 0) + ((end.height || 0) - (start.height || 0)) * eased;
    attackEntity.position = Cesium.Cartesian3.fromDegrees(lng, lat, height);
    viewer.scene.requestRender();

    if (t < 1) {
      window.requestAnimationFrame(step);
    } else if (attackEntity._shotId === shotId) {
      window.setTimeout(() => {
        if (attackEntity._shotId !== shotId) return;
        attackEntity.show = false;
        attackEntity._shotId = undefined;
        viewer.scene.requestRender();
      }, 70);
    }
  };

  window.requestAnimationFrame(step);
}

function findAttackHit(
  Cesium: any,
  viewer: any,
  state: CesiumGameState,
  enemies: CombatEnemy[],
  dir: { x: number; y: number },
): CombatEnemy | null {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(state.lat * Math.PI / 180);
  let best: { enemy: CombatEnemy; along: number } | null = null;

  enemies.forEach((enemy) => {
    if (enemy.hp <= 0 || enemy.entity.show === false) return;
    const dx = (enemy.lng - state.lng) * metersPerDegreeLng;
    const dy = (enemy.lat - state.lat) * metersPerDegreeLat;
    const along = dx * dir.x + dy * dir.y;
    if (along < 0 || along > ATTACK_RANGE_METERS) return;
    const perpendicular = Math.abs(dx * dir.y - dy * dir.x);
    if (perpendicular > ATTACK_HALF_WIDTH_METERS) return;
    const blocked = isLineBlocked(Cesium, viewer, state, enemy, along);
    if (blocked) return;
    if (!best || along < best.along) best = { enemy, along };
  });

  return best?.enemy || null;
}

function isLineBlocked(Cesium: any, viewer: any, state: CesiumGameState, enemy: CombatEnemy, targetDistance: number): boolean {
  const scene = viewer.scene;
  if (typeof scene.pickFromRay !== 'function') return false;

  try {
    const from = Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height + 9);
    const to = Cesium.Cartesian3.fromDegrees(enemy.lng, enemy.lat, state.height + 9);
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(to, from, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    );
    const hit = scene.pickFromRay(new Cesium.Ray(from, direction), [], 0.35);
    if (!hit?.position) return false;
    const hitDistance = Cesium.Cartesian3.distance(from, hit.position);
    return hitDistance < targetDistance - 6;
  } catch {
    return false;
  }
}

function updateGame(
  Cesium: any,
  viewer: any,
  state: CesiumGameState,
  playerEntity: any,
  targetEntity: any,
  moveTargetEntity: any,
  dt: number,
): void {
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);

  let localX = (state.pressed.has('right') ? 1 : 0) - (state.pressed.has('left') ? 1 : 0);
  let localY = (state.pressed.has('up') ? 1 : 0) - (state.pressed.has('down') ? 1 : 0);
  if (state.stickMove) {
    localX += state.stickMove.x;
    localY += state.stickMove.y;
  }
  const inputLength = Math.hypot(localX, localY);
  let dx = 0;
  let dy = 0;

  if (inputLength > 0) {
    clearMoveTarget(state, moveTargetEntity);
    const normalized = inputLength > 1 ? { x: localX / inputLength, y: localY / inputLength } : { x: localX, y: localY };
    const world = localInputToWorld(state, normalized.x, normalized.y);
    dx = world.x;
    dy = world.y;
  } else if (state.moveTarget) {
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(state.lat * Math.PI / 180);
    const targetDxMeters = (state.moveTarget.lng - state.lng) * metersPerDegreeLng;
    const targetDyMeters = (state.moveTarget.lat - state.lat) * metersPerDegreeLat;
    const targetDistance = Math.hypot(targetDxMeters, targetDyMeters);
    if (targetDistance <= MOVE_TARGET_RADIUS_METERS) {
      state.lng = state.moveTarget.lng;
      state.lat = state.moveTarget.lat;
      clearMoveTarget(state, moveTargetEntity);
      state.message = 'Arrived at selected point.';
      dx = 0;
      dy = 0;
    } else {
      dx = targetDxMeters / targetDistance;
      dy = targetDyMeters / targetDistance;
    }
  }

  const length = Math.hypot(dx, dy);
  state.moving = length > 0;

  if (length > 0) {
    const speed = MOVE_SPEED_METERS_PER_SECOND * dt;
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(state.lat * Math.PI / 180);
    const nx = dx / length;
    const ny = dy / length;
    state.lng += (nx * speed) / metersPerDegreeLng;
    state.lat += (ny * speed) / metersPerDegreeLat;
    state.heading = Math.atan2(nx, ny);
  }

  if (state.phase === 'pickup' || state.phase === 'dropoff') {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      state.phase = 'failed';
      state.message = `Shift over. ${state.delivered}/${JOBS.length} delivered.`;
    } else {
      resolveObjective(state, targetEntity);
    }
  }

  state.height = PLAYER_BASE_HEIGHT;
  const bob = state.moving ? Math.max(0, Math.sin(performance.now() / 80)) * 0.35 : 0;
  playerEntity.position = Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height + bob);
  updateTargetEntity(Cesium, targetEntity, state);
  updateCamera(Cesium, viewer, state);
  updateHud(state);
}

function updateCamera(Cesium: any, viewer: any, state: CesiumGameState): void {
  const target = Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height + CAMERA_TARGET_HEIGHT);
  const offset = new Cesium.HeadingPitchRange(state.cameraHeading, state.cameraPitch, state.cameraRange);
  viewer.camera.lookAt(target, offset);
  updatePlayerOutline(Cesium, viewer, state);
  if (document.getElementById('c3d-aim-line')?.classList.contains('is-active')) {
    updateAimVisual(Cesium, viewer, state, true);
  }
  viewer.scene.requestRender();
}

function updatePlayerOutline(Cesium: any, viewer: any, state: CesiumGameState): void {
  const outline = document.getElementById('c3d-player-outline');
  if (!outline) return;

  const probe = probeVisibility(Cesium, viewer, state);
  if (probe.visible || !probe.screen) {
    outline.classList.remove('is-visible');
    return;
  }

  outline.style.setProperty('--c3d-player-outline-x', `${probe.screen.x}px`);
  outline.style.setProperty('--c3d-player-outline-y', `${probe.screen.y}px`);
  outline.classList.add('is-visible');
}

function startShift(state: CesiumGameState, targetEntity?: any): void {
  state.phase = 'pickup';
  state.jobIndex = 0;
  state.score = 0;
  state.delivered = 0;
  state.timeLeft = SHIFT_SECONDS;
  state.message = `Pickup waiting at ${JOBS[0].pickupName}.`;
  if (targetEntity) updateTargetEntity(window.Cesium, targetEntity, state);
  updateHud(state);
}

function resolveObjective(state: CesiumGameState, targetEntity?: any): void {
  const job = getCurrentJob(state);
  const target = getCurrentTarget(state);
  if (!job || !target) return;
  if (distanceMeters(state, target) > INTERACT_DISTANCE_METERS) return;

  if (state.phase === 'pickup') {
    state.phase = 'dropoff';
    state.score += 30;
    state.message = `Package picked up. Deliver to ${job.dropoffName}.`;
  } else if (state.phase === 'dropoff') {
    state.delivered += 1;
    state.score += job.reward + Math.ceil(state.timeLeft * 0.5);
    state.timeLeft += job.bonusSeconds;
    state.jobIndex += 1;
    if (state.jobIndex >= JOBS.length) {
      state.phase = 'complete';
      state.message = `All drops complete. Final score ${state.score}.`;
    } else {
      state.phase = 'pickup';
      state.message = `Next pickup: ${JOBS[state.jobIndex].pickupName}.`;
    }
  }

  if (targetEntity) updateTargetEntity(window.Cesium, targetEntity, state);
}

function updateTargetEntity(Cesium: any, targetEntity: any, state: CesiumGameState): void {
  const target = getCurrentTarget(state);
  targetEntity.show = !!target;
  if (!target) return;
  targetEntity.position = Cesium.Cartesian3.fromDegrees(target.lng, target.lat, 24);
  if (targetEntity.label) targetEntity.label.text = state.phase === 'pickup' ? 'PICKUP' : 'DROP';
}

function probeVisibility(Cesium: any, viewer: any, state: CesiumGameState): VisibilityProbe {
  const scene = viewer.scene;
  const player = Cesium.Cartesian3.fromDegrees(state.lng, state.lat, state.height + VISIBILITY_PROBE_HEIGHT);
  const screen = scene.cartesianToCanvasCoordinates(player);
  if (!screen) return { visible: false, reason: 'player is offscreen' };

  const cameraDistance = Cesium.Cartesian3.distance(scene.camera.positionWC, player);
  const rayProbe = probeRayVisibility(Cesium, scene, player, cameraDistance);
  if (rayProbe) {
    return {
      screen: { x: screen.x, y: screen.y },
      cameraDistance,
      ...rayProbe,
    };
  }

  if (!scene.pickPositionSupported) {
    return { screen: { x: screen.x, y: screen.y }, cameraDistance, visible: true, reason: 'line-of-sight pick unsupported' };
  }

  let hit: any;
  try {
    hit = scene.pickPosition(screen);
  } catch (error) {
    return {
      screen: { x: screen.x, y: screen.y },
      cameraDistance,
      visible: true,
      reason: `depth pick failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!hit) return { screen: { x: screen.x, y: screen.y }, cameraDistance, visible: true, reason: 'no depth hit at sprite pixel' };

  const hitDistance = Cesium.Cartesian3.distance(scene.camera.positionWC, hit);
  const visible = hitDistance >= cameraDistance - 8;
  return {
    screen: { x: screen.x, y: screen.y },
    cameraDistance,
    hitDistance,
    visible,
    reason: visible ? 'sprite depth is not blocked' : '3D geometry is in front of sprite',
  };
}

function probeRayVisibility(
  Cesium: any,
  scene: any,
  player: any,
  cameraDistance: number,
): Pick<VisibilityProbe, 'hitDistance' | 'visible' | 'reason'> | null {
  if (typeof scene.pickFromRay !== 'function') return null;

  try {
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(player, scene.camera.positionWC, new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    );
    const ray = new Cesium.Ray(scene.camera.positionWC, direction);
    const hit = scene.pickFromRay(ray, [], 0.35);
    if (!hit?.position) return { visible: true, reason: 'raycast found no blocking 3D geometry' };

    const hitDistance = Cesium.Cartesian3.distance(scene.camera.positionWC, hit.position);
    const visible = hitDistance >= cameraDistance - 8;
    return {
      hitDistance,
      visible,
      reason: visible ? 'raycast reaches the sprite' : 'raycast hits 3D geometry before the sprite',
    };
  } catch (error) {
    return {
      visible: true,
      reason: `raycast failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function getCurrentJob(state: CesiumGameState): CesiumJob | null {
  return JOBS[state.jobIndex] || null;
}

function getCurrentTarget(state: CesiumGameState): LngLatHeight | null {
  const job = getCurrentJob(state);
  if (!job) return null;
  if (state.phase === 'pickup') return job.pickup;
  if (state.phase === 'dropoff') return job.dropoff;
  return null;
}

function updateHud(state: CesiumGameState): void {
  setText('c3d-time', formatTime(state.timeLeft));
  setText('c3d-score', String(Math.round(state.score)));
  setText('c3d-drops', `${state.delivered}/${JOBS.length}`);
  setText('c3d-status', `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`);
  const job = getCurrentJob(state);
  const target = getCurrentTarget(state);
  if (state.phase === 'ready') {
    setText('c3d-kicker', 'Rival Pulse');
    setText('c3d-main', 'Tag rival signals between Times Square towers.');
    setText('c3d-sub', 'Courier drops stay active while the city streams.');
  } else if (target && job) {
    setText('c3d-kicker', state.phase === 'pickup' ? `Job ${state.jobIndex + 1}: Pickup` : `Job ${state.jobIndex + 1}: Dropoff`);
    setText('c3d-main', state.phase === 'pickup' ? job.pickupName : job.dropoffName);
    setText('c3d-sub', `${Math.round(distanceMeters(state, target))}m away.`);
  } else if (state.phase === 'complete') {
    setText('c3d-kicker', 'Complete');
    setText('c3d-main', `Final score ${state.score}`);
    setText('c3d-sub', 'All drops complete.');
  }
  setText('c3d-toast', state.message);
  const start = document.getElementById('c3d-start');
  if (start) start.textContent = state.phase === 'ready' ? 'Start' : state.phase === 'complete' || state.phase === 'failed' ? 'Again' : 'Reset';
}

function keyToDirection(key: string): string | null {
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      return 'up';
    case 's':
    case 'arrowdown':
      return 'down';
    case 'a':
    case 'arrowleft':
      return 'left';
    case 'd':
    case 'arrowright':
      return 'right';
    default:
      return null;
  }
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

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, '0')}`;
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setStreamVisual(progress: number, active: boolean): void {
  const clamped = clamp(progress, 0, 1);
  const stream = document.getElementById('c3d-stream');
  const veil = document.getElementById('c3d-scene-veil');
  if (stream) {
    stream.style.setProperty('--c3d-stream-progress', clamped.toString());
    stream.classList.toggle('is-idle', !active);
  }
  if (veil) {
    veil.classList.toggle('is-ready', !active);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .cesium-3d-page,
    .cesium-3d-page body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #020509;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overscroll-behavior: none;
      touch-action: none;
    }

    #cesium-3d-root,
    #cesium-container {
      position: fixed;
      inset: 0;
    }

    .cesium-viewer-toolbar {
      display: none;
    }

    .c3d-hud {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 20;
    }

    .c3d-scene-veil {
      position: fixed;
      inset: 0;
      z-index: 8;
      pointer-events: none;
      background: rgba(3, 7, 10, 0.48);
      backdrop-filter: saturate(0.72) blur(5px);
      -webkit-backdrop-filter: saturate(0.72) blur(5px);
      opacity: 1;
      transition: opacity 900ms ease, backdrop-filter 900ms ease, -webkit-backdrop-filter 900ms ease;
    }

    .c3d-scene-veil.is-ready {
      opacity: 0;
      backdrop-filter: saturate(1) blur(0);
      -webkit-backdrop-filter: saturate(1) blur(0);
    }

    .c3d-topbar {
      position: absolute;
      top: max(10px, env(safe-area-inset-top));
      left: 10px;
      right: 10px;
      display: grid;
      grid-template-columns: 44px 1fr 76px;
      gap: 8px;
      align-items: center;
      pointer-events: auto;
    }

    .c3d-topbar > div,
    .c3d-stats > div,
    .c3d-objective,
    .c3d-toast,
    .c3d-icon,
    #c3d-start {
      background: rgba(5, 9, 14, 0.62);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: white;
    }

    .c3d-icon,
    #c3d-start {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      font-weight: 800;
      pointer-events: auto;
    }

    #c3d-start {
      color: #041018;
      background: #7dd3fc;
      border: none;
    }

    .c3d-topbar > div {
      min-height: 44px;
      padding: 7px 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .c3d-topbar span,
    .c3d-stats span,
    .c3d-objective em {
      color: rgba(255, 255, 255, 0.66);
      font-size: 11px;
      font-style: normal;
    }

    .c3d-stats {
      position: absolute;
      top: calc(max(10px, env(safe-area-inset-top)) + 54px);
      left: 10px;
      right: 10px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      pointer-events: none;
    }

    .c3d-stats > div {
      min-height: 48px;
      padding: 8px 10px;
    }

    .c3d-stats strong {
      display: block;
      font-size: 20px;
      line-height: 1.1;
    }

    .c3d-objective {
      position: absolute;
      top: calc(max(10px, env(safe-area-inset-top)) + 112px);
      left: 10px;
      right: 10px;
      min-height: 76px;
      padding: 10px 12px;
      pointer-events: none;
    }

    .c3d-objective span {
      color: #7dd3fc;
      display: block;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .c3d-objective strong {
      display: block;
      font-size: 20px;
      margin: 4px 0;
    }

    .c3d-stream {
      --c3d-stream-progress: 0.08;
      position: absolute;
      top: calc(max(10px, env(safe-area-inset-top)) + 200px);
      left: 12px;
      right: 12px;
      height: 3px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.12);
      opacity: 0.92;
      transition: opacity 700ms ease;
    }

    .c3d-stream i {
      position: absolute;
      inset: 0;
      display: block;
      transform: scaleX(var(--c3d-stream-progress));
      transform-origin: left center;
      background: #7dd3fc;
      transition: transform 420ms ease;
    }

    .c3d-stream.is-idle {
      opacity: 0;
    }

    .c3d-aim-line {
      --c3d-aim-x: 50vw;
      --c3d-aim-y: 50vh;
      --c3d-aim-angle: 0rad;
      --c3d-aim-length: 120px;
      position: fixed;
      left: var(--c3d-aim-x);
      top: var(--c3d-aim-y);
      width: var(--c3d-aim-length);
      height: 2px;
      z-index: 19;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-1px) rotate(var(--c3d-aim-angle));
      transform-origin: left center;
      transition: opacity 120ms ease;
    }

    .c3d-aim-line i {
      position: absolute;
      inset: -2px 0;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(125, 211, 252, 0.94), rgba(125, 211, 252, 0));
      box-shadow: 0 0 16px rgba(125, 211, 252, 0.55);
    }

    .c3d-aim-line.is-active {
      opacity: 1;
    }

    .c3d-crosshair {
      position: fixed;
      left: 50%;
      top: 50%;
      width: 26px;
      height: 26px;
      margin: -13px 0 0 -13px;
      z-index: 18;
      pointer-events: none;
      opacity: 0;
      transition: opacity 160ms ease;
    }

    .c3d-crosshair::before,
    .c3d-crosshair::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      background: rgba(125, 211, 252, 0.92);
      box-shadow: 0 0 10px rgba(125, 211, 252, 0.65);
      transform: translate(-50%, -50%);
    }

    .c3d-crosshair::before {
      width: 2px;
      height: 26px;
    }

    .c3d-crosshair::after {
      width: 26px;
      height: 2px;
    }

    body.c3d-pointer-locked .c3d-crosshair {
      opacity: 0.82;
    }

    .c3d-player-outline {
      --c3d-player-outline-x: 50vw;
      --c3d-player-outline-y: 50vh;
      position: fixed;
      left: var(--c3d-player-outline-x);
      top: var(--c3d-player-outline-y);
      width: ${PLAYER_SPRITE_DISPLAY_WIDTH + 12}px;
      height: ${PLAYER_SPRITE_DISPLAY_HEIGHT + 16}px;
      margin: -${PLAYER_SPRITE_DISPLAY_HEIGHT + 16}px 0 0 -${Math.round((PLAYER_SPRITE_DISPLAY_WIDTH + 12) / 2)}px;
      z-index: 18;
      pointer-events: none;
      opacity: 0;
      transform: scale(0.98);
      transition: opacity 90ms ease, transform 90ms ease;
    }

    .c3d-player-outline i {
      position: absolute;
      inset: 0;
      background: rgba(125, 211, 252, 0.92);
      mask: url("${PLAYER_SPRITE}") center / contain no-repeat;
      -webkit-mask: url("${PLAYER_SPRITE}") center / contain no-repeat;
      filter: drop-shadow(0 0 9px rgba(125, 211, 252, 0.95));
    }

    .c3d-player-outline i:nth-child(1) { transform: translate(-2px, 0); }
    .c3d-player-outline i:nth-child(2) { transform: translate(2px, 0); }
    .c3d-player-outline i:nth-child(3) { transform: translate(0, -2px); }
    .c3d-player-outline i:nth-child(4) { transform: translate(0, 2px); }

    .c3d-player-outline.is-visible {
      opacity: 0.78;
      transform: scale(1);
    }

    .c3d-mobile-stick-zone {
      display: none;
      position: fixed;
      left: max(22px, env(safe-area-inset-left));
      bottom: max(24px, env(safe-area-inset-bottom));
      width: 132px;
      height: 132px;
      z-index: 16;
      pointer-events: none;
      border-radius: 50%;
      border: 1px solid rgba(125, 211, 252, 0.25);
      background: radial-gradient(circle, rgba(125, 211, 252, 0.13), rgba(5, 9, 14, 0.08) 62%, transparent 70%);
    }

    .c3d-mobile-stick-zone i {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 44px;
      height: 44px;
      margin: -22px 0 0 -22px;
      border-radius: 50%;
      border: 1px solid rgba(125, 211, 252, 0.34);
    }

    .c3d-fire-button {
      display: none;
      position: fixed;
      right: max(22px, env(safe-area-inset-right));
      bottom: max(28px, env(safe-area-inset-bottom));
      width: 82px;
      height: 82px;
      z-index: 25;
      pointer-events: auto;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background:
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.95) 0 6px, transparent 7px),
        radial-gradient(circle, rgba(248, 113, 113, 0.92), rgba(127, 29, 29, 0.88));
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.34), 0 0 20px rgba(248, 113, 113, 0.34);
      touch-action: none;
    }

    .c3d-fire-button::before,
    .c3d-fire-button::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 34px;
      height: 2px;
      background: rgba(255, 255, 255, 0.86);
      transform: translate(-50%, -50%);
    }

    .c3d-fire-button::after {
      transform: translate(-50%, -50%) rotate(90deg);
    }

    .c3d-fire-button.is-active {
      transform: scale(0.94);
    }

    .c3d-stick {
      --c3d-stick-x: 0px;
      --c3d-stick-y: 0px;
      --c3d-stick-knob-x: 0px;
      --c3d-stick-knob-y: 0px;
      position: fixed;
      left: var(--c3d-stick-x);
      top: var(--c3d-stick-y);
      width: 86px;
      height: 86px;
      margin: -43px 0 0 -43px;
      z-index: 24;
      pointer-events: none;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(5, 9, 14, 0.34);
      box-shadow: inset 0 0 24px rgba(125, 211, 252, 0.12);
      opacity: 0;
      transform: scale(0.94);
      transition: opacity 120ms ease, transform 120ms ease;
    }

    .c3d-stick i {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 38px;
      height: 38px;
      margin: -19px 0 0 -19px;
      border-radius: 50%;
      background: rgba(125, 211, 252, 0.9);
      box-shadow: 0 0 18px rgba(125, 211, 252, 0.46);
      transform: translate(var(--c3d-stick-knob-x), var(--c3d-stick-knob-y));
    }

    .c3d-stick-aim i {
      background: rgba(248, 113, 113, 0.92);
      box-shadow: 0 0 18px rgba(248, 113, 113, 0.48);
    }

    .c3d-stick.is-active {
      opacity: 1;
      transform: scale(1);
    }

    .c3d-pad {
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

    .c3d-pad button {
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: white;
      background: rgba(5, 9, 14, 0.68);
      font-size: 20px;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .c3d-pad [data-hold="up"] { grid-column: 3; grid-row: 1; }
    .c3d-pad [data-hold="left"] { grid-column: 2; grid-row: 2; }
    .c3d-pad [data-action="probe"] { grid-column: 3; grid-row: 2; color: #7dd3fc; }
    .c3d-pad [data-hold="right"] { grid-column: 4; grid-row: 2; }
    .c3d-pad [data-hold="down"] { grid-column: 3; grid-row: 3; }

    .c3d-toast {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: max(18px, env(safe-area-inset-bottom));
      min-height: 38px;
      padding: 9px 12px;
      text-align: center;
      font-size: 12px;
    }

    @media (hover: none), (pointer: coarse) {
      .c3d-mobile-stick-zone,
      .c3d-fire-button {
        display: block;
      }

      .c3d-toast {
        bottom: calc(max(18px, env(safe-area-inset-bottom)) + 108px);
      }
    }

    @media (hover: hover) and (pointer: fine) {
      .c3d-stick,
      .c3d-mobile-stick-zone,
      .c3d-fire-button {
        display: none;
      }
    }

    .c3d-loading,
    .c3d-key-gate,
    .c3d-error {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      background: #020509;
    }

    .c3d-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255, 255, 255, 0.18);
      border-top-color: #7dd3fc;
      border-radius: 50%;
      animation: c3d-spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }

    @keyframes c3d-spin { to { transform: rotate(360deg); } }

    .c3d-key-card {
      width: min(380px, 100%);
      background: rgba(5, 9, 14, 0.86);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 16px;
      display: grid;
      gap: 9px;
    }

    .c3d-key-card input,
    .c3d-key-card button {
      min-height: 42px;
      border-radius: 6px;
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
