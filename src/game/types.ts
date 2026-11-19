export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type MenuScreen =
  | 'MAIN'
  | 'MODES'
  | 'MAPS'
  | 'MISSIONS'
  | 'EQUIPMENT'
  | 'UPGRADES'
  | 'ACHIEVEMENTS';

export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH';

export type MapId =
  | 'FUTURE_CITY'
  | 'DESERT_BASE'
  | 'SPACE_STATION'
  | 'JUNGLE_FACILITY'
  | 'CYBER_ARENA';

export type GameModeId =
  | 'TRAINING'
  | 'SURVIVAL'
  | 'TIME_ATTACK'
  | 'BOSS_CHALLENGE'
  | 'CAMPAIGN';

export type WeaponId =
  | 'PLASMA'
  | 'LASER'
  | 'PULSE'
  | 'RAPID'
  | 'FROST'
  | 'ELECTRIC';

export type EnemyKind =
  | 'SCOUT'
  | 'GUARD'
  | 'DRONE'
  | 'HEAVY'
  | 'SHIELD'
  | 'BOSS';

export type PickupKind =
  | 'ENERGY_PACK'
  | 'SCORE_BONUS'
  | 'SPEED_BOOST'
  | 'SHIELD'
  | 'DOUBLE_SCORE';

export type UpgradeKey = 'damage' | 'fireRate' | 'moveSpeed' | 'shield';

export interface GameSettings {
  soundEnabled: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  sensitivity: number; // 0.3..2.5
  graphicsQuality: GraphicsQuality;
  fov: number; // 65..95
}

export interface MapDefinition {
  id: MapId;
  name: string;
  vietnameseName: string;
  tagline: string;
  description: string;
  accentColor: string;
  skyHex: number;
  fogHex: number;
  fogDensity: number;
  difficultyLabel: string;
}

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  vietnameseName: string;
  description: string;
  accentColor: string;
  highlights: string[];
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  vietnameseName: string;
  description: string;
  damage: number;
  fireCooldown: number; // seconds
  range: number;
  accentHex: number;
  accentCss: string;
  unlockCost: number; // 0 = unlocked by default
  specialTag: string;
  specialEffect: 'NONE' | 'PRECISION' | 'AOE' | 'RAPID' | 'FROST' | 'CHAIN';
  stats: {
    power: number; // 1..100
    rate: number; // 1..100
    precision: number; // 1..100
    utility: number; // 1..100
  };
}

export interface MissionObjective {
  id: string;
  type: 'KILL_COUNT' | 'MOVING_HITS' | 'COLLECT_PICKUPS' | 'DEFEAT_BOSS' | 'ACCURACY_MIN';
  label: string;
  target: number;
  current?: number;
  completed?: boolean;
}

export interface MissionDefinition {
  id: string;
  index: number;
  title: string;
  description: string;
  mapId: MapId;
  difficulty: 'Dễ' | 'Trung bình' | 'Khó' | 'Cực khó';
  timeLimit: number; // seconds
  rewardCredits: number;
  rewardXp: number;
  hasBoss: boolean;
  enemyWeights: Partial<Record<EnemyKind, number>>;
  maxActiveEnemies: number;
  speedMultiplier: number;
  objectives: MissionObjective[];
}

export interface UpgradeDefinition {
  key: UpgradeKey;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  bonusPerLevelLabel: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  vietnameseName: string;
  description: string;
  rewardCredits: number;
  rewardXp: number;
}

export interface LeaderboardEntry {
  id: string;
  score: number;
  mapId: MapId;
  accuracy: number;
  targetsHit: number;
  dateIso: string;
}

export interface MatchHistoryEntry {
  id: string;
  modeId: GameModeId;
  mapId: MapId;
  missionTitle?: string;
  score: number;
  targetsHit: number;
  accuracy: number;
  durationSec: number;
  isVictory: boolean;
  rank: 'S' | 'A' | 'B' | 'C';
  dateIso: string;
}

export interface PlayerProfile {
  level: number;
  xp: number;
  credits: number;
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  upgrades: Record<UpgradeKey, number>;
  unlockedMissionIndex: number; // 0-based index into CAMPAIGN_MISSIONS
  completedMissionIds: string[];
  unlockedAchievementIds: string[];
  lifetimeTargetsHit: number;
  lifetimeBossDefeats: number;
  lifetimePickups: number;
  lifetimeMatches: number;
  highScore: number;
  timeAttackLeaderboard: LeaderboardEntry[];
  matchHistory: MatchHistoryEntry[];
}

export interface ActiveBuffs {
  speedBoost: number; // remaining seconds
  shield: number; // remaining seconds
  doubleScore: number; // remaining seconds
}

export interface BossHudInfo {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
  phase: number; // 1..3
  shielded: boolean;
}

export interface HudNotification {
  id: number;
  text: string;
  subtext?: string;
  tone: 'score' | 'combo' | 'level' | 'mission' | 'pickup' | 'boss';
}

export interface HudSnapshot {
  score: number;
  timeRemaining: number; // countdown or elapsed in training/survival
  isCountdown: boolean;
  targetsHit: number;
  shotsFired: number;
  accuracy: number;
  combo: number;
  maxCombo: number;
  modeId: GameModeId;
  mapId: MapId;
  missionTitle?: string;
  wave: number;
  totalWaves: number;
  waveEnemiesLeft: number;
  intermissionTimer: number;
  playerEnergy: number; // 0..max
  playerMaxEnergy: number;
  playerShield: number; // 0..max
  playerMaxShield: number;
  buffs: ActiveBuffs;
  equippedWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  weaponHeat: number;
  isSprinting: boolean;
  isAimingTarget: boolean;
  isPointerLocked: boolean;
  hitMarkerSeq: number;
  hitMarkerCrit: boolean;
  damageFlashSeq: number;
  boss: BossHudInfo;
  objectives: MissionObjective[];
  trainingHint?: string;
}

export interface MatchConfig {
  modeId: GameModeId;
  mapId: MapId;
  missionId?: string;
}

export interface MatchResult {
  isVictory: boolean;
  modeId: GameModeId;
  mapId: MapId;
  missionId?: string;
  missionTitle?: string;
  score: number;
  highScore: number;
  isNewBest: boolean;
  targetsHit: number;
  movingTargetsHit: number;
  shotsFired: number;
  accuracy: number;
  maxCombo: number;
  durationSec: number;
  missionsCompletedCount: number;
  totalMissionsCount: number;
  pickupsCollected: number;
  bossDefeated: boolean;
  xpEarned: number;
  creditsEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newlyUnlockedAchievements: AchievementDefinition[];
  rank: 'S' | 'A' | 'B' | 'C';
  nextMissionId?: string;
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicVolume: 0.45,
  sfxVolume: 0.78,
  sensitivity: 1.0,
  graphicsQuality: 'HIGH',
  fov: 75,
};

export const INITIAL_HUD_SNAPSHOT: HudSnapshot = {
  score: 0,
  timeRemaining: 60,
  isCountdown: true,
  targetsHit: 0,
  shotsFired: 0,
  accuracy: 100,
  combo: 0,
  maxCombo: 0,
  modeId: 'TIME_ATTACK',
  mapId: 'FUTURE_CITY',
  wave: 1,
  totalWaves: 1,
  waveEnemiesLeft: 0,
  intermissionTimer: 0,
  playerEnergy: 100,
  playerMaxEnergy: 100,
  playerShield: 50,
  playerMaxShield: 50,
  buffs: { speedBoost: 0, shield: 0, doubleScore: 0 },
  equippedWeapon: 'PLASMA',
  unlockedWeapons: ['PLASMA'],
  weaponHeat: 0,
  isSprinting: false,
  isAimingTarget: false,
  isPointerLocked: false,
  hitMarkerSeq: 0,
  hitMarkerCrit: false,
  damageFlashSeq: 0,
  boss: { active: false, name: '', hp: 0, maxHp: 1, phase: 1, shielded: false },
  objectives: [],
};
