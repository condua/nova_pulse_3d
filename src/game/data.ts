import {
  AchievementDefinition,
  GameModeDefinition,
  GameModeId,
  MapDefinition,
  MapId,
  MissionDefinition,
  PlayerProfile,
  UpgradeDefinition,
  WeaponDefinition,
  WeaponId,
} from './types';

export const MAPS: MapDefinition[] = [
  {
    id: 'FUTURE_CITY',
    name: 'FUTURE CITY',
    vietnameseName: 'Thành Phố Tương Lai',
    tagline: 'Đại lộ cao tầng & biển quảng cáo điện tử',
    description:
      'Đô thị công nghệ cao với các tòa nhà chọc trời, cầu vượt trên không, biển hiệu hologram phát sáng và nhiều góc ẩn nấp chiến thuật.',
    accentColor: '#06b6d4',
    skyHex: 0x0f1f3d,
    fogHex: 0x162b4d,
    fogDensity: 0.0078,
    difficultyLabel: 'Cân bằng',
  },
  {
    id: 'DESERT_BASE',
    name: 'DESERT BASE',
    vietnameseName: 'Căn Cứ Sa Mạc',
    tagline: 'Nhà kho, tháp canh & bãi container giữa nắng gắt',
    description:
      'Tiền đồn quân sự giả tưởng giữa sa mạc cát vàng với nhà chứa máy bay, tháp radar xoay, container xếp tầng và bụi cát bay lơ lửng.',
    accentColor: '#f59e0b',
    skyHex: 0xd99b66,
    fogHex: 0xc98b59,
    fogDensity: 0.0072,
    difficultyLabel: 'Tầm nhìn rộng',
  },
  {
    id: 'SPACE_STATION',
    name: 'SPACE STATION',
    vietnameseName: 'Trạm Không Gian',
    tagline: 'Hành lang quỹ đạo, cửa tự động & lõi năng lượng',
    description:
      'Trạm nghiên cứu ngoài vũ trụ với hành lang hợp kim, cửa khoang trượt tự động khi lại gần, đèn cảnh báo xoay và cửa sổ nhìn ra tinh vân.',
    accentColor: '#38bdf8',
    skyHex: 0x060b18,
    fogHex: 0x0b1529,
    fogDensity: 0.0085,
    difficultyLabel: 'Cận chiến',
  },
  {
    id: 'JUNGLE_FACILITY',
    name: 'JUNGLE FACILITY',
    vietnameseName: 'Căn Cứ Rừng Nhiệt Đới',
    tagline: 'Rừng rậm, dòng suối, thác nước & phòng thí nghiệm',
    description:
      'Khu nghiên cứu sinh học ẩn mình giữa tán cây nhiệt đới, dòng sông xanh chảy qua cầu nối, vách thác nước đổ và các mái vòm công nghệ.',
    accentColor: '#10b981',
    skyHex: 0x2c6e7a,
    fogHex: 0x2b5f63,
    fogDensity: 0.0082,
    difficultyLabel: 'Địa hình phức tạp',
  },
  {
    id: 'CYBER_ARENA',
    name: 'CYBER ARENA',
    vietnameseName: 'Đấu Trường Cyber',
    tagline: 'Sàn đấu neon phát sáng & vật cản di động',
    description:
      'Đấu trường công nghệ cao với mặt sàn mạch điện phát sáng rực rỡ, cột ánh sáng neon và các tấm chắn năng lượng tự động di chuyển liên tục.',
    accentColor: '#f43f5e',
    skyHex: 0x120a24,
    fogHex: 0x1b1033,
    fogDensity: 0.0076,
    difficultyLabel: 'Tốc độ cao',
  },
];

export const MAP_BY_ID: Record<MapId, MapDefinition> = Object.fromEntries(
  MAPS.map((m) => [m.id, m])
) as Record<MapId, MapDefinition>;

export const GAME_MODES: GameModeDefinition[] = [
  {
    id: 'TRAINING',
    name: 'TRAINING',
    vietnameseName: 'Luyện Tập',
    description:
      'Khu vực thực hành tự do không giới hạn thời gian với hướng dẫn ngắm bắn, di chuyển và thử nghiệm tất cả vũ khí đã mở khóa.',
    accentColor: '#38bdf8',
    highlights: ['Mục tiêu đứng yên & chậm', 'Hướng dẫn từng bước', 'Không áp lực thời gian'],
  },
  {
    id: 'SURVIVAL',
    name: 'SURVIVAL',
    vietnameseName: 'Sinh Tồn Theo Đợt',
    description:
      'Vượt qua 5 đợt tấn công robot liên tiếp với số lượng và độ khó tăng dần. Nghỉ hồi phục ngắn giữa mỗi đợt để chuẩn bị chiến thuật.',
    accentColor: '#10b981',
    highlights: ['5 đợt thử thách liên tiếp', 'Thời gian nghỉ giữa đợt', 'Vật phẩm hỗ trợ dồi dào'],
  },
  {
    id: 'TIME_ATTACK',
    name: 'TIME ATTACK',
    vietnameseName: 'Đua Điểm Thời Gian',
    description:
      '90 giây bùng nổ tốc độ! Tạo chuỗi combo liên hoàn, nhặt Double Score và ghi tên lên bảng xếp hạng điểm cao nhất.',
    accentColor: '#f59e0b',
    highlights: ['90 giây đua tốc độ', 'Nhân điểm Combo x4', 'Bảng xếp hạng lưu trữ'],
  },
  {
    id: 'BOSS_CHALLENGE',
    name: 'BOSS CHALLENGE',
    vietnameseName: 'Thử Thách Trùm',
    description:
      'Đối đầu trực diện với Titan Core MK-IX khổng lồ sở hữu 3 giai đoạn chiến đấu, lá chắn năng lượng và đội drone hộ tống.',
    accentColor: '#f43f5e',
    highlights: ['Boss 3 giai đoạn', 'Thanh năng lượng riêng', 'Phần thưởng tín dụng cực lớn'],
  },
  {
    id: 'CAMPAIGN',
    name: 'CAMPAIGN',
    vietnameseName: 'Chiến Dịch Cốt Truyện',
    description:
      '6 nhiệm vụ liên tiếp xuyên suốt 5 bản đồ khác nhau. Hoàn thành từng mục tiêu cụ thể để mở khóa chương tiếp theo và đánh bại Boss cuối.',
    accentColor: '#a855f7',
    highlights: ['6 nhiệm vụ cốt truyện', 'Mở khóa theo tiến trình', 'Thưởng XP & huy hiệu'],
  },
];

export const MODE_BY_ID: Record<GameModeId, GameModeDefinition> = Object.fromEntries(
  GAME_MODES.map((m) => [m.id, m])
) as Record<GameModeId, GameModeDefinition>;

export const WEAPONS: WeaponDefinition[] = [
  {
    id: 'PLASMA',
    name: 'Plasma Blaster',
    vietnameseName: 'Súng Plasma Chuẩn',
    description:
      'Thiết bị bắn năng lượng cân bằng toàn diện, ổn định ở mọi tầm bắn với tốc độ hồi xung nhanh.',
    damage: 34,
    fireCooldown: 0.19,
    range: 150,
    accentHex: 0x22d3ee,
    accentCss: '#22d3ee',
    unlockCost: 0,
    specialTag: 'Cân bằng',
    specialEffect: 'NONE',
    stats: { power: 62, rate: 72, precision: 82, utility: 60 },
  },
  {
    id: 'RAPID',
    name: 'Rapid Blaster',
    vietnameseName: 'Súng Liên Thanh Năng Lượng',
    description:
      'Hai nòng xoay tốc độ cực cao giúp áp đảo bầy Scout và phá lá chắn Shield Robot trong tích tắc.',
    damage: 20,
    fireCooldown: 0.085,
    range: 130,
    accentHex: 0xf97316,
    accentCss: '#f97316',
    unlockCost: 400,
    specialTag: 'Bắn siêu nhanh',
    specialEffect: 'RAPID',
    stats: { power: 46, rate: 98, precision: 68, utility: 70 },
  },
  {
    id: 'LASER',
    name: 'Laser Blaster',
    vietnameseName: 'Súng Tia Laser Chính Xác',
    description:
      'Chùm tia hội tụ cường độ cao gây sát thương cực lớn ở khoảng cách xa, lý tưởng để bắn tỉa Drone và điểm yếu Boss.',
    damage: 64,
    fireCooldown: 0.38,
    range: 200,
    accentHex: 0x34d399,
    accentCss: '#34d399',
    unlockCost: 650,
    specialTag: 'Xuyên giáp + Chính xác',
    specialEffect: 'PRECISION',
    stats: { power: 92, rate: 45, precision: 100, utility: 72 },
  },
  {
    id: 'FROST',
    name: 'Frost Blaster',
    vietnameseName: 'Súng Xung Băng Giả Tưởng',
    description:
      'Phát xung nhiệt độ âm làm chậm chuyển động robot xuống 42% trong 3 giây, cực kỳ hiệu quả trước mục tiêu cơ động cao.',
    damage: 36,
    fireCooldown: 0.24,
    range: 140,
    accentHex: 0x7dd3fc,
    accentCss: '#7dd3fc',
    unlockCost: 850,
    specialTag: 'Đóng băng làm chậm',
    specialEffect: 'FROST',
    stats: { power: 66, rate: 64, precision: 84, utility: 95 },
  },
  {
    id: 'PULSE',
    name: 'Pulse Cannon',
    vietnameseName: 'Pháo Xung Chấn Động',
    description:
      'Bắn xung năng lượng nén nổ lan trong bán kính 6m khi va chạm, quét sạch nhóm robot tụ tập cùng lúc.',
    damage: 58,
    fireCooldown: 0.48,
    range: 145,
    accentHex: 0xfbbf24,
    accentCss: '#fbbf24',
    unlockCost: 1100,
    specialTag: 'Nổ lan AoE 6m',
    specialEffect: 'AOE',
    stats: { power: 96, rate: 38, precision: 74, utility: 88 },
  },
  {
    id: 'ELECTRIC',
    name: 'Electric Blaster',
    vietnameseName: 'Súng Hồ Quang Điện',
    description:
      'Phóng tia hồ quang điện tự động nhảy sang tối đa 2 mục tiêu gần kề và phá hủy nhanh lớp lá chắn năng lượng.',
    damage: 42,
    fireCooldown: 0.27,
    range: 145,
    accentHex: 0xc084fc,
    accentCss: '#c084fc',
    unlockCost: 1400,
    specialTag: 'Sét lan + Phá khiên',
    specialEffect: 'CHAIN',
    stats: { power: 78, rate: 62, precision: 80, utility: 98 },
  },
];

export const WEAPON_BY_ID: Record<WeaponId, WeaponDefinition> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w])
) as Record<WeaponId, WeaponDefinition>;

export const CAMPAIGN_MISSIONS: MissionDefinition[] = [
  {
    id: 'M1_CITY_BREACH',
    index: 0,
    title: '01. Khởi Động Thành Phố',
    description:
      'Quét sạch nhóm Scout và Guard Robot đang kiểm soát đại lộ trung tâm Future City.',
    mapId: 'FUTURE_CITY',
    difficulty: 'Dễ',
    timeLimit: 95,
    rewardCredits: 320,
    rewardXp: 240,
    hasBoss: false,
    enemyWeights: { SCOUT: 0.45, GUARD: 0.38, DRONE: 0.17 },
    maxActiveEnemies: 8,
    speedMultiplier: 0.85,
    objectives: [
      { id: 'kill', type: 'KILL_COUNT', label: 'Tiêu diệt 12 robot', target: 12 },
      { id: 'pickup', type: 'COLLECT_PICKUPS', label: 'Thu thập 2 vật phẩm năng lượng', target: 2 },
    ],
  },
  {
    id: 'M2_DESERT_SKIES',
    index: 1,
    title: '02. Bão Cát Căn Cứ',
    description:
      'Hạ gục các mục tiêu cơ động và Flying Drone bay tuần tra trên không tại Desert Base với độ chính xác cao.',
    mapId: 'DESERT_BASE',
    difficulty: 'Trung bình',
    timeLimit: 105,
    rewardCredits: 450,
    rewardXp: 340,
    hasBoss: false,
    enemyWeights: { SCOUT: 0.25, GUARD: 0.22, DRONE: 0.4, HEAVY: 0.13 },
    maxActiveEnemies: 10,
    speedMultiplier: 1.05,
    objectives: [
      { id: 'kill', type: 'KILL_COUNT', label: 'Tiêu diệt 16 robot & drone', target: 16 },
      { id: 'moving', type: 'MOVING_HITS', label: 'Bắn trúng 10 mục tiêu đang di chuyển', target: 10 },
      { id: 'acc', type: 'ACCURACY_MIN', label: 'Duy trì độ chính xác tối thiểu 45%', target: 45 },
    ],
  },
  {
    id: 'M3_ORBITAL_LOCKDOWN',
    index: 2,
    title: '03. Phong Tỏa Quỹ Đạo',
    description:
      'Đột kích các hành lang Space Station, xuyên phá lớp khiên của Shield Robot và thu thập lõi năng lượng.',
    mapId: 'SPACE_STATION',
    difficulty: 'Trung bình',
    timeLimit: 110,
    rewardCredits: 580,
    rewardXp: 440,
    hasBoss: false,
    enemyWeights: { SCOUT: 0.2, GUARD: 0.24, DRONE: 0.22, SHIELD: 0.24, HEAVY: 0.1 },
    maxActiveEnemies: 10,
    speedMultiplier: 1.15,
    objectives: [
      { id: 'kill', type: 'KILL_COUNT', label: 'Tiêu diệt 18 robot phòng thủ', target: 18 },
      { id: 'pickup', type: 'COLLECT_PICKUPS', label: 'Thu thập 3 vật phẩm năng lượng', target: 3 },
    ],
  },
  {
    id: 'M4_JUNGLE_RECON',
    index: 3,
    title: '04. Rừng Sâu Bí Ẩn',
    description:
      'Bảo vệ khu nghiên cứu Jungle Facility trước đội hình Heavy Robot và Drone cơ động quanh thác nước.',
    mapId: 'JUNGLE_FACILITY',
    difficulty: 'Khó',
    timeLimit: 115,
    rewardCredits: 720,
    rewardXp: 560,
    hasBoss: false,
    enemyWeights: { SCOUT: 0.2, DRONE: 0.3, HEAVY: 0.28, SHIELD: 0.22 },
    maxActiveEnemies: 11,
    speedMultiplier: 1.25,
    objectives: [
      { id: 'kill', type: 'KILL_COUNT', label: 'Tiêu diệt 20 robot trong rừng', target: 20 },
      { id: 'moving', type: 'MOVING_HITS', label: 'Bắn trúng 14 mục tiêu di chuyển', target: 14 },
      { id: 'acc', type: 'ACCURACY_MIN', label: 'Độ chính xác cuối trận ≥ 50%', target: 50 },
    ],
  },
  {
    id: 'M5_CYBER_GAUNTLET',
    index: 4,
    title: '05. Thử Lửa Đấu Trường',
    description:
      'Vượt qua ma trận vật cản di động trong Cyber Arena và tiêu diệt lực lượng tinh nhuệ trong thời gian giới hạn.',
    mapId: 'CYBER_ARENA',
    difficulty: 'Khó',
    timeLimit: 105,
    rewardCredits: 880,
    rewardXp: 680,
    hasBoss: false,
    enemyWeights: { SCOUT: 0.26, DRONE: 0.28, HEAVY: 0.22, SHIELD: 0.24 },
    maxActiveEnemies: 12,
    speedMultiplier: 1.38,
    objectives: [
      { id: 'kill', type: 'KILL_COUNT', label: 'Tiêu diệt 22 robot tinh nhuệ', target: 22 },
      { id: 'pickup', type: 'COLLECT_PICKUPS', label: 'Thu thập 4 vật phẩm hỗ trợ', target: 4 },
    ],
  },
  {
    id: 'M6_TITAN_FINALE',
    index: 5,
    title: '06. Đại Chiến Titan Core',
    description:
      'Trận chiến quyết định tại Cyber Arena! Hạ gục đội hộ vệ và đánh bại Boss Robot khổng lồ Titan Core MK-IX.',
    mapId: 'CYBER_ARENA',
    difficulty: 'Cực khó',
    timeLimit: 150,
    rewardCredits: 1400,
    rewardXp: 1000,
    hasBoss: true,
    enemyWeights: { SCOUT: 0.28, DRONE: 0.38, SHIELD: 0.2, HEAVY: 0.14 },
    maxActiveEnemies: 7,
    speedMultiplier: 1.35,
    objectives: [
      { id: 'kill', type: 'KILL_COUNT', label: 'Hạ 10 robot hộ vệ', target: 10 },
      { id: 'boss', type: 'DEFEAT_BOSS', label: 'Đánh bại Boss Titan Core MK-IX', target: 1 },
    ],
  },
];

export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    key: 'damage',
    name: 'Tăng Cường Sát Thương',
    description: 'Khuếch đại lõi plasma, tăng sát thương cho toàn bộ thiết bị bắn.',
    maxLevel: 5,
    baseCost: 250,
    costStep: 200,
    bonusPerLevelLabel: '+12% sát thương / cấp',
  },
  {
    key: 'fireRate',
    name: 'Tản Nhiệt Siêu Tốc',
    description: 'Giảm thời gian hồi chiêu giữa mỗi phát bắn năng lượng.',
    maxLevel: 5,
    baseCost: 260,
    costStep: 210,
    bonusPerLevelLabel: '+8% tốc độ bắn / cấp',
  },
  {
    key: 'moveSpeed',
    name: 'Động Cơ Phản Lực',
    description: 'Tăng tốc độ chạy và độ linh hoạt khi né tránh tia năng lượng.',
    maxLevel: 5,
    baseCost: 220,
    costStep: 180,
    bonusPerLevelLabel: '+7% tốc độ di chuyển / cấp',
  },
  {
    key: 'shield',
    name: 'Lá Chắn Aegis',
    description: 'Tăng dung lượng năng lượng tối đa và lớp lá chắn bảo vệ khởi đầu.',
    maxLevel: 5,
    baseCost: 240,
    costStep: 190,
    bonusPerLevelLabel: '+20 năng lượng & khiên / cấp',
  },
];

export const ACHIEVEMENT_DEFS: AchievementDefinition[] = [
  {
    id: 'FIRST_TARGET',
    name: 'First Target',
    vietnameseName: 'Phát Bắn Mở Màn',
    description: 'Bắn trúng mục tiêu robot đầu tiên trong đấu trường.',
    rewardCredits: 100,
    rewardXp: 80,
  },
  {
    id: 'SHARPSHOOTER',
    name: 'Sharpshooter',
    vietnameseName: 'Thiện Xạ Chính Xác',
    description: 'Hoàn thành một trận đấu với độ chính xác từ 70% trở lên (tối thiểu 10 mục tiêu).',
    rewardCredits: 350,
    rewardXp: 250,
  },
  {
    id: 'ROBOT_HUNTER',
    name: 'Robot Hunter',
    vietnameseName: 'Thợ Săn Robot',
    description: 'Tiêu diệt tổng cộng 50 robot và drone xuyên suốt các trận đấu.',
    rewardCredits: 450,
    rewardXp: 350,
  },
  {
    id: 'BOSS_WINNER',
    name: 'Boss Winner',
    vietnameseName: 'Kẻ Chinh Phục Trùm',
    description: 'Đánh bại Boss Robot Titan Core MK-IX lần đầu tiên.',
    rewardCredits: 650,
    rewardXp: 500,
  },
  {
    id: 'PERFECT_MISSION',
    name: 'Perfect Mission',
    vietnameseName: 'Nhiệm Vụ Hoàn Hảo',
    description: 'Hoàn thành chiến thắng với hạng S.',
    rewardCredits: 500,
    rewardXp: 400,
  },
  {
    id: 'COMBO_MASTER',
    name: 'Combo Master',
    vietnameseName: 'Bậc Thầy Liên Hoàn',
    description: 'Đạt chuỗi bắn trúng liên tiếp từ x10 trở lên trong một trận.',
    rewardCredits: 300,
    rewardXp: 220,
  },
  {
    id: 'ARSENAL_COLLECTOR',
    name: 'Arsenal Collector',
    vietnameseName: 'Kho Vũ Khí Năng Lượng',
    description: 'Sở hữu ít nhất 3 loại súng năng lượng khác nhau.',
    rewardCredits: 400,
    rewardXp: 300,
  },
  {
    id: 'ENERGY_SCAVENGER',
    name: 'Energy Scavenger',
    vietnameseName: 'Thợ Săn Năng Lượng',
    description: 'Thu thập tổng cộng 15 vật phẩm hỗ trợ trên đấu trường.',
    rewardCredits: 300,
    rewardXp: 240,
  },
];

export const PROFILE_STORAGE_KEY = 'nova_pulse_profile_v2';

export function xpNeededForLevel(level: number): number {
  return Math.round(250 + (level - 1) * 180 + Math.pow(level - 1, 1.35) * 45);
}

export function getUpgradeCost(def: UpgradeDefinition, currentLevel: number): number {
  return def.baseCost + currentLevel * def.costStep;
}

export function createDefaultProfile(): PlayerProfile {
  return {
    level: 1,
    xp: 0,
    credits: 300, // Starter credits so player can explore Upgrade Center right away
    unlockedWeapons: ['PLASMA'],
    equippedWeapon: 'PLASMA',
    upgrades: {
      damage: 0,
      fireRate: 0,
      moveSpeed: 0,
      shield: 0,
    },
    unlockedMissionIndex: 0,
    completedMissionIds: [],
    unlockedAchievementIds: [],
    lifetimeTargetsHit: 0,
    lifetimeBossDefeats: 0,
    lifetimePickups: 0,
    lifetimeMatches: 0,
    highScore: 0,
    timeAttackLeaderboard: [],
    matchHistory: [],
  };
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const def = createDefaultProfile();
    const unlockedWeapons =
      Array.isArray(parsed.unlockedWeapons) && parsed.unlockedWeapons.length > 0
        ? (parsed.unlockedWeapons.filter((w) => w in WEAPON_BY_ID) as WeaponId[])
        : def.unlockedWeapons;
    if (!unlockedWeapons.includes('PLASMA')) unlockedWeapons.unshift('PLASMA');
    const equippedWeapon =
      parsed.equippedWeapon && unlockedWeapons.includes(parsed.equippedWeapon)
        ? parsed.equippedWeapon
        : 'PLASMA';

    return {
      ...def,
      ...parsed,
      unlockedWeapons,
      equippedWeapon,
      upgrades: {
        damage: Math.min(5, Math.max(0, parsed.upgrades?.damage ?? 0)),
        fireRate: Math.min(5, Math.max(0, parsed.upgrades?.fireRate ?? 0)),
        moveSpeed: Math.min(5, Math.max(0, parsed.upgrades?.moveSpeed ?? 0)),
        shield: Math.min(5, Math.max(0, parsed.upgrades?.shield ?? 0)),
      },
      completedMissionIds: Array.isArray(parsed.completedMissionIds)
        ? parsed.completedMissionIds
        : [],
      unlockedAchievementIds: Array.isArray(parsed.unlockedAchievementIds)
        ? parsed.unlockedAchievementIds
        : [],
      timeAttackLeaderboard: Array.isArray(parsed.timeAttackLeaderboard)
        ? parsed.timeAttackLeaderboard.slice(0, 10)
        : [],
      matchHistory: Array.isArray(parsed.matchHistory)
        ? parsed.matchHistory.slice(0, 20)
        : [],
    };
  } catch {
    return createDefaultProfile();
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}
