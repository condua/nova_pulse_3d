import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArenaBuildResult, buildMapArena } from './arena';
import {
  ACHIEVEMENT_DEFS,
  CAMPAIGN_MISSIONS,
  MAP_BY_ID,
  WEAPON_BY_ID,
  WEAPONS,
  xpNeededForLevel,
} from './data';
import { SoundEngine } from './sound';
import { ActiveEnemy, ActivePickup, TargetManager } from './targets';
import { createMapTextures, createRadialGlowTexture, MapTextures } from './textures';
import {
  AchievementDefinition,
  EnemyKind,
  GameSettings,
  GameState,
  HudNotification,
  HudSnapshot,
  INITIAL_HUD_SNAPSHOT,
  MapId,
  MatchConfig,
  MatchResult,
  MissionDefinition,
  MissionObjective,
  PlayerProfile,
  WeaponId,
} from './types';
import { WeaponAndFX } from './weapon';

export interface EngineCallbacks {
  onStateChange: (state: GameState) => void;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onNotification: (note: HudNotification) => void;
  onMatchComplete: (result: MatchResult, updatedProfile: PlayerProfile) => void;
  onWeaponSwitched: (weaponId: WeaponId) => void;
}

const PLAYER_EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.58;
const GRAVITY = 24;
const JUMP_SPEED = 9.6;
const BASE_WALK_SPEED = 8.8;
const BASE_SPRINT_SPEED = 14.2;

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class NovaPulseEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  private readonly isSoftwareGl: boolean;
  public readonly sound: SoundEngine;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  private textures: MapTextures | null = null;
  private arena: ArenaBuildResult | null = null;
  private targets: TargetManager | null = null;
  private weapon!: WeaponAndFX;

  private settings: GameSettings;
  private profile: PlayerProfile;
  private currentMapId: MapId = 'FUTURE_CITY';
  private gameState: GameState = 'MENU';
  private matchFinishedGuard = false;
  private disposed = false;
  private frameId = 0;
  private lastTimestamp = 0;
  private elapsed = 0;
  private hudSyncAccum = 0;
  private aimCheckAccum = 0;
  private notificationSeq = 1;

  // Active Match Configuration & State
  private matchConfig: MatchConfig = {
    modeId: 'TIME_ATTACK',
    mapId: 'FUTURE_CITY',
  };
  private activeMission: MissionDefinition | null = null;
  private objectives: MissionObjective[] = [];
  private objectivesNotified = new Set<string>();

  // Player kinematics & survival vitals
  private readonly playerPos = new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 28);
  private readonly playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private isGrounded = true;
  private isSprinting = false;
  private playerEnergy = 100;
  private playerMaxEnergy = 100;
  private playerShield = 50;
  private playerMaxShield = 50;
  private speedBoostTimer = 0;
  private shieldBuffTimer = 0;
  private doubleScoreTimer = 0;

  // Input state
  private readonly keys: Record<string, boolean> = {};
  private isFiringHeld = false;
  private fireCooldownTimer = 0;
  private isPointerLocked = false;
  private hadPointerLockInSession = false;
  private isDragLooking = false;
  private lastDragX = 0;
  private lastDragY = 0;

  // Scoring, wave & timers
  private score = 0;
  private timeRemaining = 90;
  private matchDurationSec = 0;
  private isCountdown = true;
  private lastWholeSecond = 90;
  private targetsHit = 0;
  private movingTargetsHit = 0;
  private shotsFired = 0;
  private pickupsCollected = 0;
  private bossDefeated = false;
  private combo = 0;
  private maxCombo = 0;
  private comboDecayTimer = 0;
  private isAimingTarget = false;
  private hitMarkerSeq = 0;
  private hitMarkerCrit = false;
  private damageFlashSeq = 0;
  private equippedWeapon: WeaponId = 'PLASMA';

  // Wave & Respawn timers
  private wave = 1;
  private totalWaves = 5;
  private waveRemainingToSpawn = 0;
  private waveTotalInCurrent = 0;
  private waveKills = 0;
  private intermissionTimer = 0;
  private enemySpawnTimer = 0;
  private pickupSpawnTimer = 6;
  private bossReinforceTimer = 10;
  private bossPhaseNotified = 1;

  // Reusable math scratch (zero GC in render loop)
  private readonly _raycaster = new THREE.Raycaster();
  private readonly _centerNdc = new THREE.Vector2(0, 0);
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _wishDir = new THREE.Vector3();
  private readonly _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _fallbackPoint = new THREE.Vector3();

  // Bound DOM listeners
  private readonly handleResize: () => void;
  private readonly handleKeyDown: (e: KeyboardEvent) => void;
  private readonly handleKeyUp: (e: KeyboardEvent) => void;
  private readonly handleMouseMove: (e: MouseEvent) => void;
  private readonly handleMouseDown: (e: MouseEvent) => void;
  private readonly handleMouseUp: (e: MouseEvent) => void;
  private readonly handlePointerLockChange: () => void;
  private readonly handleContextLost: (e: Event) => void;
  private readonly handleWindowBlur: () => void;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    initialProfile: PlayerProfile,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.profile = { ...initialProfile };
    this.equippedWeapon = initialProfile.equippedWeapon;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.sound = new SoundEngine();
    this.sound.configure(
      initialSettings.soundEnabled,
      initialSettings.musicVolume,
      initialSettings.sfxVolume
    );

    this.initThree();
    this.loadMap('FUTURE_CITY', true);
    this.weapon.viewmodelRoot.visible = false;
    this.sound.setMusicMode('MENU');

    this.handleResize = this.onResize.bind(this);
    this.handleKeyDown = this.onKeyDown.bind(this);
    this.handleKeyUp = this.onKeyUp.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseDown = this.onMouseDown.bind(this);
    this.handleMouseUp = this.onMouseUp.bind(this);
    this.handlePointerLockChange = this.onPointerLockChange.bind(this);
    this.handleContextLost = (e: Event) => e.preventDefault();
    this.handleWindowBlur = () => {
      this.clearKeys();
      this.isFiringHeld = false;
      this.isDragLooking = false;
    };

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLost,
      false
    );

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private initThree(): void {
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1f3d);
    this.scene.fog = new THREE.FogExp2(0x162b4d, 0.0078);

    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov,
      width / height,
      0.08,
      380
    );
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.graphicsQuality !== 'LOW',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    // Mandatory Studio PBR Environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3-Point Dynamic Lighting Rig (re-tuned per map)
    this.hemiLight = new THREE.HemisphereLight(0x8ec5fc, 0x1e293b, 0.95);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffe7c2, 1.85);
    this.keyLight.position.set(36, 54, 28);
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 150;
    const d = 46;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    this.rimLight.position.set(-40, 24, -36);
    this.scene.add(this.rimLight);

    // Independent radial glow sprite owned by WeaponAndFX
    this.weapon = new WeaponAndFX(this.scene, this.camera, createRadialGlowTexture());
    this.weapon.setWeapon(this.equippedWeapon);

    this.applyGraphicsQuality(this.settings.graphicsQuality);
  }

  public setPreviewMap(mapId: MapId): void {
    if (this.gameState !== 'MENU') return;
    if (this.currentMapId === mapId && this.arena) return;
    this.loadMap(mapId, true);
  }

  public syncProfile(profile: PlayerProfile): void {
    this.profile = { ...profile };
    if (this.equippedWeapon !== profile.equippedWeapon) {
      this.equippedWeapon = profile.equippedWeapon;
      this.weapon.setWeapon(this.equippedWeapon);
    }
  }

  public applySettings(next: GameSettings): void {
    const qualityChanged = next.graphicsQuality !== this.settings.graphicsQuality;
    this.settings = { ...next };
    this.sound.configure(next.soundEnabled, next.musicVolume, next.sfxVolume);
    if (!this.isSprinting) {
      this.camera.fov = next.fov;
      this.camera.updateProjectionMatrix();
    }
    if (qualityChanged) {
      this.applyGraphicsQuality(next.graphicsQuality);
    }
  }

  private loadMap(mapId: MapId, spawnShowcaseBots: boolean): void {
    // Cleanly dispose old map & targets
    if (this.targets) {
      this.targets.dispose();
      this.targets = null;
    }
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
      this.arena = null;
    }
    if (this.textures) {
      this.textures.dispose();
      this.textures = null;
    }

    this.currentMapId = mapId;
    const mapDef = MAP_BY_ID[mapId];
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.textures = createMapTextures(mapId, maxAniso);
    this.arena = buildMapArena(mapId, this.textures);
    this.scene.add(this.arena.group);

    // Apply map atmosphere, sky & lighting
    this.scene.background = new THREE.Color(mapDef.skyHex);
    this.scene.fog = new THREE.FogExp2(mapDef.fogHex, mapDef.fogDensity);

    const lc = this.arena.lightingConfig;
    this.hemiLight.color.setHex(lc.hemiSky);
    this.hemiLight.groundColor.setHex(lc.hemiGround);
    this.hemiLight.intensity = lc.hemiIntensity;
    this.keyLight.color.setHex(lc.keyColor);
    this.keyLight.intensity = lc.keyIntensity;
    this.keyLight.position.set(...lc.keyPos);
    this.rimLight.color.setHex(lc.rimColor);
    this.rimLight.intensity = lc.rimIntensity;

    this.sound.setMapAmbience(mapId);

    this.targets = new TargetManager(
      this.scene,
      this.arena.spawnAnchors,
      this.arena.pickupAnchors,
      this.arena.bossAnchor,
      this.arena.arenaRadius,
      this.textures.contactShadowMap
    );

    if (spawnShowcaseBots) {
      const center = new THREE.Vector3(0, 2, 0);
      const demoKinds: EnemyKind[] = ['SCOUT', 'GUARD', 'DRONE', 'GUARD', 'DRONE', 'SHIELD'];
      demoKinds.forEach((k) => {
        this.targets?.spawnEnemy(
          { kind: k, speedMultiplier: 0.75, hpMultiplier: 1, canShoot: false },
          center
        );
      });
      this.targets.spawnPickup('ENERGY_PACK');
      this.targets.spawnPickup('SCORE_BONUS');
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private applyGraphicsQuality(quality: GameSettings['graphicsQuality']): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    if (quality === 'LOW') {
      this.renderer.setPixelRatio(Math.min(dpr, 1));
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
    } else if (quality === 'MEDIUM') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.4));
      this.renderer.shadowMap.enabled = true;
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2));
      this.renderer.shadowMap.enabled = true;
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(2048, 2048);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    }
  }

  public startMatch(config: MatchConfig): void {
    this.sound.unlock();
    this.clearKeys();
    this.isFiringHeld = false;
    this.isDragLooking = false;
    this.hadPointerLockInSession = false;
    this.matchFinishedGuard = false;

    this.matchConfig = { ...config };
    this.activeMission =
      config.modeId === 'CAMPAIGN'
        ? CAMPAIGN_MISSIONS.find((m) => m.id === config.missionId) ?? CAMPAIGN_MISSIONS[0]
        : null;

    const targetMapId = this.activeMission ? this.activeMission.mapId : config.mapId;
    this.loadMap(targetMapId, false);

    // Apply player upgrades to vitals
    const shieldLv = this.profile.upgrades.shield;
    this.playerMaxEnergy = 100 + shieldLv * 20;
    this.playerMaxShield = 50 + shieldLv * 20;
    this.playerEnergy = this.playerMaxEnergy;
    this.playerShield = this.playerMaxShield;
    this.speedBoostTimer = 0;
    this.shieldBuffTimer = 0;
    this.doubleScoreTimer = 0;

    // Reset player spawn & orientation
    this.playerPos.copy(this.arena!.playerSpawn);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.02;
    this.isGrounded = true;
    this.isSprinting = false;
    this.camera.position.copy(this.playerPos);
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();

    // Reset weapon & stats
    this.equippedWeapon = this.profile.equippedWeapon;
    this.weapon.setWeapon(this.equippedWeapon);
    this.weapon.clearEffects();
    this.weapon.viewmodelRoot.visible = true;

    this.score = 0;
    this.matchDurationSec = 0;
    this.targetsHit = 0;
    this.movingTargetsHit = 0;
    this.shotsFired = 0;
    this.pickupsCollected = 0;
    this.bossDefeated = false;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboDecayTimer = 0;
    this.fireCooldownTimer = 0;
    this.isAimingTarget = false;
    this.objectivesNotified.clear();
    this.pickupSpawnTimer = 5.5;
    this.enemySpawnTimer = 0.6;
    this.bossReinforceTimer = 9;
    this.bossPhaseNotified = 1;

    // Configure Mode-Specific Rules, Objectives & Initial Spawns
    if (config.modeId === 'TRAINING') {
      this.isCountdown = false;
      this.timeRemaining = 0;
      this.wave = 1;
      this.totalWaves = 1;
      this.objectives = [
        { id: 'tr_kill', type: 'KILL_COUNT', label: 'Bắn trúng 10 mục tiêu luyện tập', target: 10, current: 0 },
        { id: 'tr_pick', type: 'COLLECT_PICKUPS', label: 'Thu thập 1 vật phẩm năng lượng', target: 1, current: 0 },
      ];
      this.spawnTrainingSet();
      this.targets!.spawnPickup('ENERGY_PACK');
      this.targets!.spawnPickup('SPEED_BOOST');
      this.sound.setMusicMode('GAMEPLAY');
      this.emitNotification('CHẾ ĐỘ LUYỆN TẬP', 'Làm quen di chuyển WASD & ngắm bắn mục tiêu', 'level');
    } else if (config.modeId === 'SURVIVAL') {
      this.isCountdown = false;
      this.timeRemaining = 0;
      this.wave = 1;
      this.totalWaves = 5;
      this.intermissionTimer = 0;
      this.objectives = [
        { id: 'surv_waves', type: 'KILL_COUNT', label: 'Hoàn thành 5 đợt robot sinh tồn', target: 60, current: 0 },
      ];
      this.startSurvivalWave(1);
      this.targets!.spawnPickup('SHIELD');
      this.sound.setMusicMode('GAMEPLAY');
    } else if (config.modeId === 'TIME_ATTACK') {
      this.isCountdown = true;
      this.timeRemaining = 90;
      this.lastWholeSecond = 90;
      this.wave = 1;
      this.totalWaves = 1;
      this.objectives = [
        { id: 'ta_kill', type: 'KILL_COUNT', label: 'Hạ mục tiêu & đạt điểm cao nhất trong 90s', target: 25, current: 0 },
      ];
      for (let i = 0; i < 10; i++) {
        this.spawnWeightedEnemy(
          { SCOUT: 0.3, GUARD: 0.28, DRONE: 0.3, SHIELD: 0.08, HEAVY: 0.04 },
          1.15,
          0.95,
          false
        );
      }
      this.targets!.spawnPickup('DOUBLE_SCORE');
      this.targets!.spawnPickup('SPEED_BOOST');
      this.sound.setMusicMode('GAMEPLAY');
      this.emitNotification('TIME ATTACK — 90 GIÂY', 'Bắn liên hoàn tích Combo & đua bảng xếp hạng!', 'level');
    } else if (config.modeId === 'BOSS_CHALLENGE') {
      this.isCountdown = true;
      this.timeRemaining = 150;
      this.lastWholeSecond = 150;
      this.wave = 1;
      this.totalWaves = 1;
      this.objectives = [
        { id: 'boss_main', type: 'DEFEAT_BOSS', label: 'Đánh bại Titan Core MK-IX', target: 1, current: 0 },
      ];
      this.targets!.spawnEnemy(
        { kind: 'BOSS', speedMultiplier: 1.0, hpMultiplier: 1.0, canShoot: true },
        this.playerPos
      );
      for (let i = 0; i < 3; i++) {
        this.spawnWeightedEnemy({ DRONE: 0.6, SCOUT: 0.4 }, 1.1, 0.9, true);
      }
      this.targets!.spawnPickup('SHIELD');
      this.targets!.spawnPickup('ENERGY_PACK');
      this.sound.playBossSpawn();
      this.sound.setMusicMode('BOSS');
      this.emitNotification('CẢNH BÁO BOSS XUẤT HIỆN!', 'TITAN CORE MK-IX · 3 Giai Đoạn', 'boss');
    } else if (config.modeId === 'CAMPAIGN' && this.activeMission) {
      const m = this.activeMission;
      this.isCountdown = true;
      this.timeRemaining = m.timeLimit;
      this.lastWholeSecond = m.timeLimit;
      this.wave = 1;
      this.totalWaves = 1;
      this.objectives = m.objectives.map((o) => ({
        ...o,
        current: 0,
        completed: false,
      }));

      for (let i = 0; i < m.maxActiveEnemies; i++) {
        this.spawnWeightedEnemy(m.enemyWeights, m.speedMultiplier, 1.0, true);
      }
      if (m.hasBoss) {
        this.targets!.spawnEnemy(
          { kind: 'BOSS', speedMultiplier: 1.05, hpMultiplier: 1.05, canShoot: true },
          this.playerPos
        );
        this.sound.playBossSpawn();
        this.sound.setMusicMode('BOSS');
      } else {
        this.sound.setMusicMode('GAMEPLAY');
      }
      this.targets!.spawnPickup('ENERGY_PACK');
      this.targets!.spawnPickup('SCORE_BONUS');
      this.emitNotification(m.title.toUpperCase(), m.description, 'mission');
    }

    this.gameState = 'PLAYING';
    this.callbacks.onStateChange('PLAYING');
    this.emitHudSnapshot();
    this.requestPointerLockSafe();
  }

  private spawnTrainingSet(): void {
    if (!this.targets) return;
    // Mix of stationary targets & gentle moving targets
    for (let i = 0; i < 4; i++) {
      this.targets.spawnEnemy(
        { kind: 'GUARD', speedMultiplier: 0.5, hpMultiplier: 0.75, canShoot: false, stationary: true },
        this.playerPos
      );
    }
    for (let i = 0; i < 4; i++) {
      this.targets.spawnEnemy(
        { kind: i % 2 === 0 ? 'SCOUT' : 'DRONE', speedMultiplier: 0.55, hpMultiplier: 0.75, canShoot: false },
        this.playerPos
      );
    }
  }

  private startSurvivalWave(waveNum: number): void {
    this.wave = waveNum;
    const count = 5 + waveNum * 3; // 8, 11, 14, 17, 20
    this.waveTotalInCurrent = count;
    this.waveRemainingToSpawn = count;
    this.waveKills = 0;
    this.intermissionTimer = 0;
    this.enemySpawnTimer = 0.25;
    this.emitNotification(
      `ĐỢT ${waveNum} / ${this.totalWaves}`,
      `Tiêu diệt ${count} robot tấn công`,
      'level'
    );
  }

  private spawnWeightedEnemy(
    weights: Partial<Record<EnemyKind, number>>,
    speedMult: number,
    hpMult: number,
    canShoot: boolean
  ): void {
    if (!this.targets) return;
    const entries = Object.entries(weights) as [EnemyKind, number][];
    const total = entries.reduce((acc, [, w]) => acc + (w || 0), 0);
    let roll = Math.random() * total;
    let chosen: EnemyKind = 'GUARD';
    for (const [k, w] of entries) {
      roll -= w || 0;
      if (roll <= 0) {
        chosen = k;
        break;
      }
    }
    this.targets.spawnEnemy(
      { kind: chosen, speedMultiplier: speedMult, hpMultiplier: hpMult, canShoot },
      this.playerPos
    );
  }

  public pauseGame(): void {
    if (this.gameState !== 'PLAYING') return;
    this.gameState = 'PAUSED';
    this.clearKeys();
    this.isFiringHeld = false;
    this.isDragLooking = false;
    this.exitPointerLockSafe();
    this.callbacks.onStateChange('PAUSED');
    this.emitHudSnapshot();
  }

  public resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    this.sound.unlock();
    this.clearKeys();
    this.isFiringHeld = false;
    this.hadPointerLockInSession = false;
    this.gameState = 'PLAYING';
    this.callbacks.onStateChange('PLAYING');
    this.emitHudSnapshot();
    this.requestPointerLockSafe();
  }

  public finishTraining(): void {
    if (this.matchConfig.modeId !== 'TRAINING') return;
    if (this.gameState !== 'PAUSED' && this.gameState !== 'PLAYING') return;
    this.finishMatch(true);
  }

  public returnToMenu(): void {
    this.gameState = 'MENU';
    this.matchFinishedGuard = false;
    this.clearKeys();
    this.isFiringHeld = false;
    this.isDragLooking = false;
    this.exitPointerLockSafe();
    this.weapon.clearEffects();
    this.weapon.viewmodelRoot.visible = false;
    this.sound.setMusicMode('MENU');
    this.loadMap(this.currentMapId, true);
    this.callbacks.onStateChange('MENU');
    this.callbacks.onHudUpdate({ ...INITIAL_HUD_SNAPSHOT });
  }

  public equipWeaponInMatch(weaponId: WeaponId): void {
    if (!this.profile.unlockedWeapons.includes(weaponId)) return;
    if (this.equippedWeapon === weaponId) return;
    this.equippedWeapon = weaponId;
    this.weapon.setWeapon(weaponId);
    this.sound.playUiClick();
    this.callbacks.onWeaponSwitched(weaponId);
    this.emitNotification(
      WEAPON_BY_ID[weaponId].name.toUpperCase(),
      WEAPON_BY_ID[weaponId].specialTag,
      'pickup'
    );
    this.emitHudSnapshot();
  }

  public requestPointerLockSafe(): void {
    try {
      const el = this.renderer.domElement;
      if (document.pointerLockElement !== el && el.requestPointerLock) {
        const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') res.catch(() => {});
      }
    } catch {
      // Fallback drag-look stays functional
    }
  }

  private exitPointerLockSafe(): void {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }

  private clearKeys(): void {
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
  }

  private onResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private onPointerLockChange(): void {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.isPointerLocked = locked;
    if (locked) {
      this.hadPointerLockInSession = true;
    } else if (this.gameState === 'PLAYING' && this.hadPointerLockInSession) {
      this.pauseGame();
      return;
    }
    this.emitHudSnapshot();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.gameState === 'PLAYING') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.pauseGame();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isGrounded) {
          this.playerVel.y = JUMP_SPEED;
          this.isGrounded = false;
          this.sound.playJump();
        }
      }
      // Number keys 1..6 swap unlocked sci-fi weapons on the fly!
      if (e.code.startsWith('Digit')) {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        if (idx >= 0 && idx < WEAPONS.length) {
          const wId = WEAPONS[idx].id;
          if (this.profile.unlockedWeapons.includes(wId)) {
            this.equipWeaponInMatch(wId);
          }
        }
      }
      this.keys[e.code] = true;
    } else if (this.gameState === 'PAUSED') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.resumeGame();
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.gameState !== 'PLAYING') return;

    let dx = 0;
    let dy = 0;
    if (this.isPointerLocked) {
      dx = e.movementX || 0;
      dy = e.movementY || 0;
    } else if (this.isDragLooking) {
      dx = e.clientX - this.lastDragX;
      dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    } else {
      return;
    }

    dx = THREE.MathUtils.clamp(dx, -140, 140);
    dy = THREE.MathUtils.clamp(dy, -140, 140);

    const sens = 0.0021 * this.settings.sensitivity;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sens,
      -Math.PI * 0.45,
      Math.PI * 0.45
    );
    this.weapon.addLookSway(dx, dy);
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.gameState !== 'PLAYING') return;
    if (e.target !== this.renderer.domElement) return;

    if (e.button === 0) {
      this.sound.unlock();
      if (!this.isPointerLocked) {
        this.requestPointerLockSafe();
        this.isDragLooking = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
      this.isFiringHeld = true;
      this.tryShoot();
    } else if (e.button === 2 && !this.isPointerLocked) {
      this.isDragLooking = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.isFiringHeld = false;
    this.isDragLooking = false;
  }

  private tryShoot(): void {
    // STRICT GUARD: never fire when paused, menu, victory, or game over
    if (this.gameState !== 'PLAYING' || this.fireCooldownTimer > 0 || !this.arena || !this.targets) {
      return;
    }

    const wDef = WEAPON_BY_ID[this.equippedWeapon];
    const fireRateScale = 1 / (1 + this.profile.upgrades.fireRate * 0.08);
    const damageScale = 1 + this.profile.upgrades.damage * 0.12;
    const baseDamage = Math.round(wDef.damage * damageScale);

    this.fireCooldownTimer = wDef.fireCooldown * fireRateScale;
    this.shotsFired++;
    this.sound.playWeaponFire(this.equippedWeapon);

    this._raycaster.setFromCamera(this._centerNdc, this.camera);
    this._raycaster.far = wDef.range;

    const wallHits = this._raycaster.intersectObjects(this.arena.raycastObstacles, false);
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : wDef.range;

    const targetHits = this._raycaster.intersectObjects(this.targets.getHitProxies(), false);
    const particleBudget =
      this.settings.graphicsQuality === 'LOW'
        ? 6
        : this.settings.graphicsQuality === 'MEDIUM'
        ? 10
        : 15;

    const chainArcPoints: THREE.Vector3[] = [];

    if (targetHits.length > 0 && targetHits[0].distance <= wallDist + 0.18) {
      const hitInfo = targetHits[0];
      const enemy = this.targets.findByProxy(hitInfo.object);
      if (enemy) {
        const outcome = this.targets.applyDamage(enemy, baseDamage, {
          frost: wDef.specialEffect === 'FROST',
          shieldBreaker: wDef.specialEffect === 'CHAIN' || wDef.specialEffect === 'AOE',
          pierceShield: wDef.specialEffect === 'PRECISION',
        });

        this.combo++;
        this.comboDecayTimer = 4.5;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        this.hitMarkerSeq++;
        this.hitMarkerCrit = outcome.killed || wDef.specialEffect === 'PRECISION';
        this.sound.playHit(this.combo, outcome.killed, outcome.shielded);

        if (outcome.killed) {
          this.handleEnemyKilled(outcome.points, outcome.enemyKind, outcome.wasMoving, outcome.worldCenter, outcome.accentHex, particleBudget);
        }

        // Special weapon mechanics: PULSE AoE & ELECTRIC Chain Lightning!
        if (wDef.specialEffect === 'AOE') {
          const splashEnemies = this.targets.findNearbyEnemies(hitInfo.point, 6.2, enemy.id);
          for (const se of splashEnemies) {
            const sub = this.targets.applyDamage(se, Math.round(baseDamage * 0.65), {
              shieldBreaker: true,
            });
            if (sub.killed) {
              this.handleEnemyKilled(sub.points, sub.enemyKind, sub.wasMoving, sub.worldCenter, sub.accentHex, particleBudget);
            }
          }
        } else if (wDef.specialEffect === 'CHAIN') {
          const near = this.targets
            .findNearbyEnemies(hitInfo.point, 10.5, enemy.id)
            .slice(0, 2);
          for (const ce of near) {
            const sub = this.targets.applyDamage(ce, Math.round(baseDamage * 0.62), {
              shieldBreaker: true,
            });
            chainArcPoints.push(sub.worldCenter);
            if (sub.killed) {
              this.handleEnemyKilled(sub.points, sub.enemyKind, sub.wasMoving, sub.worldCenter, sub.accentHex, particleBudget);
            }
          }
        }

        this.weapon.fireEffect(
          hitInfo.point,
          true,
          this.equippedWeapon,
          outcome.accentHex,
          particleBudget,
          chainArcPoints
        );
        this.checkBossPhaseNotification();
        this.updateObjectivesProgress();
        this.emitHudSnapshot();
        return;
      }
    }

    // Missed direct hit -> check PULSE AoE splash near impact point
    let endPoint: THREE.Vector3;
    if (wallHits.length > 0) {
      endPoint = wallHits[0].point;
      this.sound.playRicochet();
    } else {
      this._raycaster.ray.at(Math.min(95, wDef.range), this._fallbackPoint);
      endPoint = this._fallbackPoint;
    }

    let splashHitAny = false;
    if (wDef.specialEffect === 'AOE') {
      const splashEnemies = this.targets.findNearbyEnemies(endPoint, 5.8, -1);
      for (const se of splashEnemies) {
        splashHitAny = true;
        const sub = this.targets.applyDamage(se, Math.round(baseDamage * 0.7), {
          shieldBreaker: true,
        });
        if (sub.killed) {
          this.handleEnemyKilled(sub.points, sub.enemyKind, sub.wasMoving, sub.worldCenter, sub.accentHex, particleBudget);
        }
      }
    }

    if (!splashHitAny) {
      this.combo = 0;
      this.comboDecayTimer = 0;
    } else {
      this.hitMarkerSeq++;
      this.hitMarkerCrit = false;
      this.sound.playHit(Math.max(1, this.combo), false, false);
    }

    this.weapon.fireEffect(endPoint, splashHitAny, this.equippedWeapon, wDef.accentHex, particleBudget);
    this.updateObjectivesProgress();
    this.emitHudSnapshot();
  }

  private handleEnemyKilled(
    basePoints: number,
    kind: EnemyKind,
    wasMoving: boolean,
    worldCenter: THREE.Vector3,
    accentHex: number,
    particleBudget: number
  ): void {
    this.targetsHit++;
    if (wasMoving) this.movingTargetsHit++;
    if (kind === 'BOSS') this.bossDefeated = true;
    if (this.matchConfig.modeId === 'SURVIVAL') this.waveKills++;

    const comboMult = Math.min(4, 1 + Math.floor(Math.max(0, this.combo - 1) / 3) * 0.5);
    const doubleMult = this.doubleScoreTimer > 0 ? 2 : 1;
    const earned = Math.round(basePoints * comboMult * doubleMult);
    this.score += earned;

    this.weapon.spawnDestructionBurst(worldCenter, accentHex, kind === 'BOSS', particleBudget);

    if (kind === 'BOSS') {
      this.sound.playMissionComplete();
      this.emitNotification('ĐÃ HẠ GỤC TITAN CORE MK-IX!', `+${earned} điểm`, 'boss');
    } else if (this.combo >= 3 && this.combo % 3 === 0) {
      this.emitNotification(
        `CHUỖI COMBO x${this.combo}!`,
        `+${earned} điểm${doubleMult > 1 ? ' (x2 DOUBLE)' : ''}`,
        'combo'
      );
    } else {
      this.emitNotification(`+${earned}`, undefined, 'score');
    }
  }

  private checkBossPhaseNotification(): void {
    const boss = this.targets?.getBoss();
    if (!boss) return;
    if (boss.bossPhase > this.bossPhaseNotified) {
      this.bossPhaseNotified = boss.bossPhase;
      this.sound.playBossSpawn();
      this.emitNotification(
        `BOSS GIAI ĐOẠN ${boss.bossPhase}!`,
        'Lá chắn tạm thời kích hoạt · Gọi drone tiếp viện',
        'boss'
      );
      for (let i = 0; i < 2; i++) {
        this.spawnWeightedEnemy({ DRONE: 0.55, SCOUT: 0.45 }, 1.25, 0.9, true);
      }
    }
  }

  private handlePickupCollected(pickup: ActivePickup): void {
    this.pickupsCollected++;
    this.sound.playPickup();

    switch (pickup.kind) {
      case 'ENERGY_PACK':
        this.playerEnergy = Math.min(this.playerMaxEnergy, this.playerEnergy + 35);
        break;
      case 'SCORE_BONUS':
        this.score += this.doubleScoreTimer > 0 ? 700 : 350;
        break;
      case 'SPEED_BOOST':
        this.speedBoostTimer = 10;
        break;
      case 'SHIELD':
        this.playerShield = Math.min(this.playerMaxShield, this.playerShield + 45);
        this.shieldBuffTimer = 10;
        break;
      case 'DOUBLE_SCORE':
        this.doubleScoreTimer = 12;
        break;
    }

    this.emitNotification('NHẶT VẬT PHẨM!', pickup.label, 'pickup');
    this.updateObjectivesProgress();
    this.emitHudSnapshot();
  }

  private handlePlayerHit(damage: number): void {
    if (this.gameState !== 'PLAYING' || this.matchConfig.modeId === 'TRAINING') return;
    const reduced = this.shieldBuffTimer > 0 ? Math.round(damage * 0.45) : damage;
    this.sound.playPlayerHit();
    this.damageFlashSeq++;

    if (this.playerShield >= reduced) {
      this.playerShield -= reduced;
    } else {
      const rem = reduced - this.playerShield;
      this.playerShield = 0;
      this.playerEnergy = Math.max(0, this.playerEnergy - rem);
    }

    if (this.playerEnergy <= 0) {
      this.finishMatch(false);
    } else {
      this.emitHudSnapshot();
    }
  }

  private updateObjectivesProgress(): void {
    const acc = this.shotsFired > 0 ? Math.round((this.targetsHit / this.shotsFired) * 100) : 100;

    for (const obj of this.objectives) {
      if (obj.type === 'KILL_COUNT') {
        obj.current = this.targetsHit;
        obj.completed = this.targetsHit >= obj.target;
      } else if (obj.type === 'MOVING_HITS') {
        obj.current = this.movingTargetsHit;
        obj.completed = this.movingTargetsHit >= obj.target;
      } else if (obj.type === 'COLLECT_PICKUPS') {
        obj.current = this.pickupsCollected;
        obj.completed = this.pickupsCollected >= obj.target;
      } else if (obj.type === 'DEFEAT_BOSS') {
        obj.current = this.bossDefeated ? 1 : 0;
        obj.completed = this.bossDefeated;
      } else if (obj.type === 'ACCURACY_MIN') {
        obj.current = acc;
        obj.completed = this.targetsHit >= 3 && acc >= obj.target;
      }

      if (obj.completed && !this.objectivesNotified.has(obj.id) && obj.type !== 'ACCURACY_MIN') {
        this.objectivesNotified.add(obj.id);
        this.sound.playMissionComplete();
        this.emitNotification('HOÀN THÀNH MỤC TIÊU!', obj.label, 'mission');
      }
    }

    // Check Victory triggers for Campaign / Boss Challenge
    if (this.matchConfig.modeId === 'BOSS_CHALLENGE' && this.bossDefeated) {
      this.finishMatch(true);
    } else if (this.matchConfig.modeId === 'CAMPAIGN') {
      const nonAccDone = this.objectives
        .filter((o) => o.type !== 'ACCURACY_MIN')
        .every((o) => o.completed);
      if (nonAccDone) {
        const accObj = this.objectives.find((o) => o.type === 'ACCURACY_MIN');
        const passedAcc = !accObj || acc >= accObj.target;
        this.finishMatch(passedAcc);
      }
    }
  }

  private finishMatch(isVictory: boolean): void {
    if (this.matchFinishedGuard) return;
    this.matchFinishedGuard = true;

    this.gameState = isVictory ? 'VICTORY' : 'GAME_OVER';
    this.clearKeys();
    this.isFiringHeld = false;
    this.isDragLooking = false;
    this.exitPointerLockSafe();
    this.sound.setMusicMode('MENU');
    if (isVictory) this.sound.playMissionComplete();
    else this.sound.playGameOver();

    const accuracy =
      this.shotsFired > 0
        ? Math.round((this.targetsHit / this.shotsFired) * 100)
        : 0;
    const completedObjs = this.objectives.filter((o) => o.completed).length;

    let rank: MatchResult['rank'] = 'C';
    if (isVictory && (accuracy >= 60 || this.score >= 4500)) rank = 'S';
    else if (isVictory || this.score >= 2800) rank = 'A';
    else if (this.score >= 1200) rank = 'B';

    // Calculate XP & Credits reward
    let xpEarned = Math.round(this.targetsHit * 12 + this.score * 0.04 + (isVictory ? 180 : 40));
    let creditsEarned = Math.round(this.targetsHit * 8 + this.score * 0.05 + (isVictory ? 160 : 30));
    if (this.matchConfig.modeId === 'BOSS_CHALLENGE' && isVictory) {
      xpEarned += 420;
      creditsEarned += 650;
    }
    if (this.activeMission && isVictory) {
      xpEarned += this.activeMission.rewardXp;
      creditsEarned += this.activeMission.rewardCredits;
    }

    // Mutate cloned profile for clean React + LocalStorage persistence
    const nextProfile: PlayerProfile = {
      ...this.profile,
      unlockedWeapons: [...this.profile.unlockedWeapons],
      upgrades: { ...this.profile.upgrades },
      completedMissionIds: [...this.profile.completedMissionIds],
      unlockedAchievementIds: [...this.profile.unlockedAchievementIds],
      timeAttackLeaderboard: [...this.profile.timeAttackLeaderboard],
      matchHistory: [...this.profile.matchHistory],
    };

    nextProfile.lifetimeTargetsHit += this.targetsHit;
    nextProfile.lifetimePickups += this.pickupsCollected;
    nextProfile.lifetimeMatches += 1;
    if (this.bossDefeated) nextProfile.lifetimeBossDefeats += 1;

    const isNewBest = this.score > nextProfile.highScore;
    if (isNewBest) nextProfile.highScore = this.score;

    // Unlock Campaign progress
    let nextMissionId: string | undefined;
    if (this.activeMission && isVictory) {
      if (!nextProfile.completedMissionIds.includes(this.activeMission.id)) {
        nextProfile.completedMissionIds.push(this.activeMission.id);
      }
      const nextIdx = this.activeMission.index + 1;
      if (nextIdx > nextProfile.unlockedMissionIndex && nextIdx < CAMPAIGN_MISSIONS.length) {
        nextProfile.unlockedMissionIndex = nextIdx;
      }
      if (nextIdx < CAMPAIGN_MISSIONS.length) {
        nextMissionId = CAMPAIGN_MISSIONS[nextIdx].id;
      }
    }

    // Update Time Attack Leaderboard
    if (this.matchConfig.modeId === 'TIME_ATTACK' && this.score > 0) {
      nextProfile.timeAttackLeaderboard.push({
        id: `${Date.now()}`,
        score: this.score,
        mapId: this.currentMapId,
        accuracy,
        targetsHit: this.targetsHit,
        dateIso: new Date().toISOString(),
      });
      nextProfile.timeAttackLeaderboard.sort((a, b) => b.score - a.score);
      nextProfile.timeAttackLeaderboard = nextProfile.timeAttackLeaderboard.slice(0, 10);
    }

    // Evaluate Achievements
    const newlyUnlocked: AchievementDefinition[] = [];
    const tryUnlock = (id: string, cond: boolean) => {
      if (!cond || nextProfile.unlockedAchievementIds.includes(id)) return;
      const def = ACHIEVEMENT_DEFS.find((a) => a.id === id);
      if (!def) return;
      nextProfile.unlockedAchievementIds.push(id);
      newlyUnlocked.push(def);
      xpEarned += def.rewardXp;
      creditsEarned += def.rewardCredits;
    };

    tryUnlock('FIRST_TARGET', nextProfile.lifetimeTargetsHit >= 1);
    tryUnlock('SHARPSHOOTER', this.targetsHit >= 10 && accuracy >= 70);
    tryUnlock('ROBOT_HUNTER', nextProfile.lifetimeTargetsHit >= 50);
    tryUnlock('BOSS_WINNER', nextProfile.lifetimeBossDefeats >= 1);
    tryUnlock('PERFECT_MISSION', isVictory && rank === 'S');
    tryUnlock('COMBO_MASTER', this.maxCombo >= 10);
    tryUnlock('ARSENAL_COLLECTOR', nextProfile.unlockedWeapons.length >= 3);
    tryUnlock('ENERGY_SCAVENGER', nextProfile.lifetimePickups >= 15);

    // Apply XP & Level Up Loop
    const startLevel = nextProfile.level;
    nextProfile.xp += xpEarned;
    nextProfile.credits += creditsEarned;
    while (nextProfile.xp >= xpNeededForLevel(nextProfile.level)) {
      nextProfile.xp -= xpNeededForLevel(nextProfile.level);
      nextProfile.level += 1;
    }
    const leveledUp = nextProfile.level > startLevel;

    // Record Match History
    nextProfile.matchHistory.unshift({
      id: `${Date.now()}`,
      modeId: this.matchConfig.modeId,
      mapId: this.currentMapId,
      missionTitle: this.activeMission?.title,
      score: this.score,
      targetsHit: this.targetsHit,
      accuracy,
      durationSec: Math.round(this.matchDurationSec),
      isVictory,
      rank,
      dateIso: new Date().toISOString(),
    });
    nextProfile.matchHistory = nextProfile.matchHistory.slice(0, 15);

    this.profile = nextProfile;

    const result: MatchResult = {
      isVictory,
      modeId: this.matchConfig.modeId,
      mapId: this.currentMapId,
      missionId: this.activeMission?.id,
      missionTitle: this.activeMission?.title,
      score: this.score,
      highScore: nextProfile.highScore,
      isNewBest,
      targetsHit: this.targetsHit,
      movingTargetsHit: this.movingTargetsHit,
      shotsFired: this.shotsFired,
      accuracy,
      maxCombo: this.maxCombo,
      durationSec: Math.round(this.matchDurationSec),
      missionsCompletedCount: completedObjs,
      totalMissionsCount: this.objectives.length,
      pickupsCollected: this.pickupsCollected,
      bossDefeated: this.bossDefeated,
      xpEarned,
      creditsEarned,
      leveledUp,
      newLevel: nextProfile.level,
      newlyUnlockedAchievements: newlyUnlocked,
      rank,
      nextMissionId,
    };

    this.callbacks.onStateChange(this.gameState);
    this.callbacks.onMatchComplete(result, nextProfile);
  }

  private updatePlayer(dt: number): void {
    if (!this.arena) return;

    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);

    const moveF =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const moveR =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);

    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this._wishDir.set(0, 0, 0);
    if (moveF !== 0) this._wishDir.addScaledVector(this._forward, moveF);
    if (moveR !== 0) this._wishDir.addScaledVector(this._right, moveR);
    const hasMove = this._wishDir.lengthSq() > 0.0001;
    if (hasMove) this._wishDir.normalize();

    const sprintHeld = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    this.isSprinting = sprintHeld && hasMove && moveF >= 0;

    const upgradeSpeedMult = 1 + this.profile.upgrades.moveSpeed * 0.07;
    const boostMult = this.speedBoostTimer > 0 ? 1.38 : 1.0;
    const baseSpeed = this.isSprinting ? BASE_SPRINT_SPEED : BASE_WALK_SPEED;
    const targetSpeed = baseSpeed * upgradeSpeedMult * boostMult;

    const accel = this.isGrounded ? 14 : 4.6;
    this.playerVel.x = THREE.MathUtils.damp(
      this.playerVel.x,
      hasMove ? this._wishDir.x * targetSpeed : 0,
      accel,
      dt
    );
    this.playerVel.z = THREE.MathUtils.damp(
      this.playerVel.z,
      hasMove ? this._wishDir.z * targetSpeed : 0,
      accel,
      dt
    );

    this.playerVel.y -= GRAVITY * dt;

    // Resolve X, Z with solid + dynamic wall sliding
    this.playerPos.x += this.playerVel.x * dt;
    this.resolveHorizontalCollisions('x');

    this.playerPos.z += this.playerVel.z * dt;
    this.resolveHorizontalCollisions('z');

    // Push player safely out if a moving Cyber Arena barrier glides into them
    this.ejectFromDynamicBarriers();

    const bound = this.arena.arenaRadius;
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -bound, bound);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -bound, bound);

    // Resolve Y ground & platform stepping
    const prevFeetY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    this.playerPos.y += this.playerVel.y * dt;
    let feetY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    const wasGrounded = this.isGrounded;
    let floorSupport = 0;

    for (const c of this.arena.colliders) {
      const overlapsXZ =
        this.playerPos.x + PLAYER_RADIUS > c.minX &&
        this.playerPos.x - PLAYER_RADIUS < c.maxX &&
        this.playerPos.z + PLAYER_RADIUS > c.minZ &&
        this.playerPos.z - PLAYER_RADIUS < c.maxZ;
      if (!overlapsXZ) continue;
      if (this.playerVel.y <= 0 && prevFeetY >= c.maxY - 0.42 && feetY <= c.maxY) {
        if (c.maxY > floorSupport) floorSupport = c.maxY;
      }
    }

    if (feetY <= floorSupport) {
      feetY = floorSupport;
      this.playerPos.y = feetY + PLAYER_EYE_HEIGHT;
      if (!wasGrounded && this.playerVel.y < -5) this.sound.playLand();
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    const desiredFov =
      this.isSprinting || this.speedBoostTimer > 0
        ? Math.min(104, this.settings.fov + (this.speedBoostTimer > 0 ? 10 : 7))
        : this.settings.fov;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const speedRatio = Math.min(1, horizSpeed / BASE_WALK_SPEED);
    const bobOffset =
      this.isGrounded && speedRatio > 0.12
        ? Math.sin(this.elapsed * (this.isSprinting ? 13.5 : 9.2)) *
          (this.isSprinting ? 0.055 : 0.032) *
          speedRatio
        : 0;

    this.camera.position.set(
      this.playerPos.x,
      this.playerPos.y + bobOffset,
      this.playerPos.z
    );

    this.weapon.update(dt, this.elapsed, speedRatio, this.isSprinting, this.isGrounded);
  }

  private resolveHorizontalCollisions(axis: 'x' | 'z'): void {
    if (!this.arena) return;
    const feetY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    const headY = this.playerPos.y + 0.18;

    for (const c of this.arena.colliders) {
      if (c.maxY <= feetY + 0.44 || c.minY >= headY) continue;
      const overlaps =
        this.playerPos.x + PLAYER_RADIUS > c.minX &&
        this.playerPos.x - PLAYER_RADIUS < c.maxX &&
        this.playerPos.z + PLAYER_RADIUS > c.minZ &&
        this.playerPos.z - PLAYER_RADIUS < c.maxZ;
      if (!overlaps) continue;

      if (axis === 'x') {
        if (this.playerVel.x > 0) this.playerPos.x = c.minX - PLAYER_RADIUS;
        else if (this.playerVel.x < 0) this.playerPos.x = c.maxX + PLAYER_RADIUS;
        this.playerVel.x = 0;
      } else {
        if (this.playerVel.z > 0) this.playerPos.z = c.minZ - PLAYER_RADIUS;
        else if (this.playerVel.z < 0) this.playerPos.z = c.maxZ + PLAYER_RADIUS;
        this.playerVel.z = 0;
      }
    }
  }

  private ejectFromDynamicBarriers(): void {
    if (!this.arena) return;
    const feetY = this.playerPos.y - PLAYER_EYE_HEIGHT;
    const headY = this.playerPos.y + 0.18;
    for (const c of this.arena.colliders) {
      if (!c.isDynamic || c.maxY <= feetY + 0.44 || c.minY >= headY) continue;
      const penLeft = this.playerPos.x + PLAYER_RADIUS - c.minX;
      const penRight = c.maxX - (this.playerPos.x - PLAYER_RADIUS);
      const penFront = this.playerPos.z + PLAYER_RADIUS - c.minZ;
      const penBack = c.maxZ - (this.playerPos.z - PLAYER_RADIUS);
      if (penLeft > 0 && penRight > 0 && penFront > 0 && penBack > 0) {
        const minPen = Math.min(penLeft, penRight, penFront, penBack);
        if (minPen === penLeft) this.playerPos.x = c.minX - PLAYER_RADIUS - 0.02;
        else if (minPen === penRight) this.playerPos.x = c.maxX + PLAYER_RADIUS + 0.02;
        else if (minPen === penFront) this.playerPos.z = c.minZ - PLAYER_RADIUS - 0.02;
        else this.playerPos.z = c.maxZ + PLAYER_RADIUS + 0.02;
      }
    }
  }

  private updateModeSpawner(dt: number): void {
    if (!this.targets) return;

    // Periodic pickup spawns across all modes
    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0) {
      this.pickupSpawnTimer = this.matchConfig.modeId === 'BOSS_CHALLENGE' ? 8.5 : 11.5;
      if (this.targets.getPickupCount() < 3) {
        this.targets.spawnPickup();
      }
    }

    const mode = this.matchConfig.modeId;

    if (mode === 'TRAINING') {
      if (this.targets.getActiveCount() < 7) {
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
          this.enemySpawnTimer = 1.0;
          const kinds: EnemyKind[] = ['GUARD', 'SCOUT', 'DRONE'];
          const k = kinds[Math.floor(Math.random() * kinds.length)];
          this.targets.spawnEnemy(
            {
              kind: k,
              speedMultiplier: 0.55,
              hpMultiplier: 0.75,
              canShoot: false,
              stationary: k === 'GUARD' && Math.random() < 0.5,
            },
            this.playerPos
          );
        }
      }
      return;
    }

    if (mode === 'SURVIVAL') {
      if (this.intermissionTimer > 0) {
        this.intermissionTimer -= dt;
        if (this.intermissionTimer <= 0) {
          this.startSurvivalWave(this.wave + 1);
        }
        return;
      }

      const activeCount = this.targets.getActiveCount();
      if (this.waveRemainingToSpawn > 0 && activeCount < Math.min(11, 5 + this.wave)) {
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
          this.enemySpawnTimer = Math.max(0.55, 1.35 - this.wave * 0.14);
          this.waveRemainingToSpawn--;
          const weights: Partial<Record<EnemyKind, number>> =
            this.wave === 1
              ? { SCOUT: 0.5, GUARD: 0.5 }
              : this.wave === 2
              ? { SCOUT: 0.35, GUARD: 0.35, DRONE: 0.3 }
              : this.wave === 3
              ? { SCOUT: 0.25, GUARD: 0.25, DRONE: 0.3, SHIELD: 0.2 }
              : { SCOUT: 0.2, DRONE: 0.26, HEAVY: 0.27, SHIELD: 0.27 };
          this.spawnWeightedEnemy(
            weights,
            0.9 + this.wave * 0.12,
            0.95 + this.wave * 0.08,
            true
          );
        }
      }

      if (this.waveRemainingToSpawn === 0 && activeCount === 0) {
        if (this.wave >= this.totalWaves) {
          this.finishMatch(true);
        } else {
          this.intermissionTimer = 5.0;
          this.playerEnergy = Math.min(this.playerMaxEnergy, this.playerEnergy + 35);
          this.playerShield = Math.min(this.playerMaxShield, this.playerShield + 30);
          this.targets.spawnPickup('ENERGY_PACK');
          this.targets.spawnPickup('SHIELD');
          this.sound.playMissionComplete();
          this.emitNotification(
            `HOÀN TẤT ĐỢT ${this.wave}!`,
            'Nghỉ 5 giây · Hồi phục năng lượng & lá chắn',
            'level'
          );
        }
      }
      return;
    }

    if (mode === 'TIME_ATTACK') {
      if (this.targets.getActiveCount() < 11) {
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
          this.enemySpawnTimer = 0.65;
          this.spawnWeightedEnemy(
            { SCOUT: 0.3, GUARD: 0.24, DRONE: 0.3, SHIELD: 0.1, HEAVY: 0.06 },
            1.2,
            0.92,
            false
          );
        }
      }
      return;
    }

    if (mode === 'BOSS_CHALLENGE') {
      this.bossReinforceTimer -= dt;
      if (this.bossReinforceTimer <= 0 && this.targets.getActiveCount(true) < 4) {
        this.bossReinforceTimer = 9.5;
        this.spawnWeightedEnemy({ DRONE: 0.5, SCOUT: 0.3, SHIELD: 0.2 }, 1.15, 0.9, true);
      }
      return;
    }

    if (mode === 'CAMPAIGN' && this.activeMission) {
      const m = this.activeMission;
      if (this.targets.getActiveCount(true) < m.maxActiveEnemies) {
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
          this.enemySpawnTimer = 0.9;
          this.spawnWeightedEnemy(m.enemyWeights, m.speedMultiplier, 1.0, true);
        }
      }
    }
  }

  private getTrainingHint(): string | undefined {
    if (this.matchConfig.modeId !== 'TRAINING') return undefined;
    if (this.targetsHit < 3) {
      return 'Hướng dẫn 1/3: Dùng W A S D di chuyển, xoay chuột ngắm tâm và nhấn Chuột Trái để bắn robot.';
    }
    if (this.pickupsCollected < 1) {
      return 'Hướng dẫn 2/3: Chạy lại gần vật phẩm phát sáng đang xoay để thu thập năng lượng hoặc tăng tốc.';
    }
    return 'Hướng dẫn 3/3: Nhấn Shift chạy nhanh, Space nhảy lên vật cản, phím 1–6 đổi súng hoặc Esc để hoàn thành luyện tập.';
  }

  private emitHudSnapshot(): void {
    const accuracy =
      this.shotsFired > 0
        ? Math.round((this.targetsHit / this.shotsFired) * 100)
        : 100;
    const boss = this.targets?.getBoss();
    const waveLeft =
      this.matchConfig.modeId === 'SURVIVAL'
        ? Math.max(0, this.waveTotalInCurrent - this.waveKills)
        : 0;

    this.callbacks.onHudUpdate({
      score: this.score,
      timeRemaining: Math.max(0, this.timeRemaining),
      isCountdown: this.isCountdown,
      targetsHit: this.targetsHit,
      shotsFired: this.shotsFired,
      accuracy,
      combo: this.combo,
      maxCombo: this.maxCombo,
      modeId: this.matchConfig.modeId,
      mapId: this.currentMapId,
      missionTitle: this.activeMission?.title,
      wave: this.wave,
      totalWaves: this.totalWaves,
      waveEnemiesLeft: waveLeft,
      intermissionTimer: Math.max(0, this.intermissionTimer),
      playerEnergy: Math.round(this.playerEnergy),
      playerMaxEnergy: this.playerMaxEnergy,
      playerShield: Math.round(this.playerShield),
      playerMaxShield: this.playerMaxShield,
      buffs: {
        speedBoost: Math.max(0, this.speedBoostTimer),
        shield: Math.max(0, this.shieldBuffTimer),
        doubleScore: Math.max(0, this.doubleScoreTimer),
      },
      equippedWeapon: this.equippedWeapon,
      unlockedWeapons: this.profile.unlockedWeapons,
      weaponHeat: this.weapon.heat,
      isSprinting: this.isSprinting,
      isAimingTarget: this.isAimingTarget,
      isPointerLocked: this.isPointerLocked,
      hitMarkerSeq: this.hitMarkerSeq,
      hitMarkerCrit: this.hitMarkerCrit,
      damageFlashSeq: this.damageFlashSeq,
      boss: boss
        ? {
            active: true,
            name: boss.name,
            hp: Math.round(boss.hp),
            maxHp: boss.maxHp,
            phase: boss.bossPhase,
            shielded: boss.bossShieldTimer > 0,
          }
        : { active: false, name: '', hp: 0, maxHp: 1, phase: 1, shielded: false },
      objectives: this.objectives.map((o) => ({ ...o })),
      trainingHint: this.getTrainingHint(),
    });
  }

  private emitNotification(
    text: string,
    subtext: string | undefined,
    tone: HudNotification['tone']
  ): void {
    this.callbacks.onNotification({
      id: this.notificationSeq++,
      text,
      subtext,
      tone,
    });
  }

  private tick(now: number): void {
    if (this.disposed) return;

    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.elapsed += dt;

    if (this.arena) {
      this.arena.update(dt, this.elapsed, this.playerPos);
    }

    if (
      this.gameState === 'MENU' ||
      this.gameState === 'VICTORY' ||
      this.gameState === 'GAME_OVER'
    ) {
      const angle = this.elapsed * 0.14;
      const radius = 31;
      this.camera.position.set(
        Math.cos(angle) * radius,
        13 + Math.sin(this.elapsed * 0.35) * 1.8,
        Math.sin(angle) * radius
      );
      this.camera.lookAt(0, 3.5, 0);
      if (this.targets && this.arena) {
        this.targets.update(
          dt,
          this.elapsed,
          this.camera.position,
          this.arena.colliders,
          false,
          () => {},
          () => {}
        );
      }
      this.weapon.update(dt, this.elapsed, 0, false, true);
    } else if (this.gameState === 'PLAYING' && this.arena && this.targets) {
      this.matchDurationSec += dt;

      // Active buff countdowns
      if (this.speedBoostTimer > 0) this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
      if (this.shieldBuffTimer > 0) this.shieldBuffTimer = Math.max(0, this.shieldBuffTimer - dt);
      if (this.doubleScoreTimer > 0) this.doubleScoreTimer = Math.max(0, this.doubleScoreTimer - dt);

      // Gentle passive shield regeneration if unhit
      if (this.playerShield < this.playerMaxShield) {
        this.playerShield = Math.min(this.playerMaxShield, this.playerShield + dt * 1.5);
      }

      if (this.isCountdown) {
        this.timeRemaining -= dt;
        const wholeSec = Math.ceil(this.timeRemaining);
        if (wholeSec !== this.lastWholeSecond && wholeSec > 0 && wholeSec <= 10) {
          this.lastWholeSecond = wholeSec;
          this.sound.playTick(wholeSec <= 3);
        }
        if (this.timeRemaining <= 0) {
          this.timeRemaining = 0;
          this.emitHudSnapshot();
          const winOnTimeEnd = this.matchConfig.modeId === 'TIME_ATTACK';
          this.finishMatch(winOnTimeEnd);
        }
      } else {
        this.timeRemaining += dt;
      }

      if (this.gameState === 'PLAYING') {
        if (this.combo > 0) {
          this.comboDecayTimer -= dt;
          if (this.comboDecayTimer <= 0) this.combo = 0;
        }

        if (this.fireCooldownTimer > 0) this.fireCooldownTimer -= dt;
        if (this.isFiringHeld && this.fireCooldownTimer <= 0) {
          this.tryShoot();
        }

        this.updatePlayer(dt);
        this.updateModeSpawner(dt);

        const allowAttacks =
          this.matchConfig.modeId === 'SURVIVAL' ||
          this.matchConfig.modeId === 'BOSS_CHALLENGE' ||
          this.matchConfig.modeId === 'CAMPAIGN';

        this.targets.update(
          dt,
          this.elapsed,
          this.playerPos,
          this.arena.colliders,
          allowAttacks,
          (dmg) => this.handlePlayerHit(dmg),
          (pickup) => this.handlePickupCollected(pickup)
        );

        // Throttled crosshair hover target highlight
        this.aimCheckAccum += dt;
        if (this.aimCheckAccum >= 0.065) {
          this.aimCheckAccum = 0;
          this._raycaster.setFromCamera(this._centerNdc, this.camera);
          this._raycaster.far = 140;
          const hits = this._raycaster.intersectObjects(this.targets.getHitProxies(), false);
          this.isAimingTarget = hits.length > 0;
        }

        this.hudSyncAccum += dt;
        if (this.hudSyncAccum >= 0.066) {
          this.hudSyncAccum = 0;
          this.emitHudSnapshot();
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick(performance.now());
      });
    } else {
      this.frameId = requestAnimationFrame((ts) => this.tick(ts));
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);

    this.exitPointerLockSafe();
    this.targets?.dispose();
    this.weapon.dispose();
    this.arena?.dispose();
    this.textures?.dispose();
    this.sound.dispose();
    if (this.scene.environment) this.scene.environment.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
