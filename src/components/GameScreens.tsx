import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Lock,
  Play,
  Trophy,
  Zap,
  Shield,
  Award,
  Clock,
  Target,
} from 'lucide-react';
import {
  ACHIEVEMENT_DEFS,
  CAMPAIGN_MISSIONS,
  GAME_MODES,
  getUpgradeCost,
  MAP_BY_ID,
  MAPS,
  MODE_BY_ID,
  UPGRADE_DEFS,
  WEAPONS,
} from '../game/data';
import {
  GameModeId,
  MapId,
  MenuScreen,
  PlayerProfile,
  UpgradeKey,
  WeaponId,
} from '../game/types';

interface ScreenShellProps {
  title: string;
  subtitle: string;
  credits: number;
  onBack: () => void;
  children: React.ReactNode;
}

const ScreenShell: React.FC<ScreenShellProps> = ({
  title,
  subtitle,
  credits,
  onBack,
  children,
}) => (
  <div className="fixed inset-0 z-20 flex flex-col p-5 sm:p-8 bg-[#070b16]/82 overflow-y-auto">
    <div className="w-full max-w-6xl mx-auto flex flex-col flex-1">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0d1526] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>MAIN MENU</span>
          </button>
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1526] border border-slate-700/80">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-mono-num font-bold text-amber-300 text-base">
            {credits.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs text-slate-400">CR</span>
        </div>
      </div>

      <div className="mt-6 flex-1">{children}</div>
    </div>
  </div>
);

interface GameScreensProps {
  screen: Exclude<MenuScreen, 'MAIN'>;
  profile: PlayerProfile;
  selectedMode: GameModeId;
  selectedMap: MapId;
  onBack: () => void;
  onSelectMode: (mode: GameModeId) => void;
  onLaunchMode: (mode: GameModeId) => void;
  onSelectMap: (map: MapId) => void;
  onLaunchMap: (map: MapId) => void;
  onLaunchMission: (missionId: string) => void;
  onUnlockWeapon: (weaponId: WeaponId) => void;
  onEquipWeapon: (weaponId: WeaponId) => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
}

export const GameScreens: React.FC<GameScreensProps> = ({
  screen,
  profile,
  selectedMode,
  selectedMap,
  onBack,
  onSelectMode,
  onLaunchMode,
  onSelectMap,
  onLaunchMap,
  onLaunchMission,
  onUnlockWeapon,
  onEquipWeapon,
  onBuyUpgrade,
}) => {
  const [achieveTab, setAchieveTab] = useState<'BADGES' | 'LEADERBOARD' | 'HISTORY'>('BADGES');

  /* ------------------------------------------------------------------------ */
  /*  GAME MODE SELECTION                                                     */
  /* ------------------------------------------------------------------------ */
  if (screen === 'MODES') {
    return (
      <ScreenShell
        title="CHỌN CHẾ ĐỘ CHƠI"
        subtitle="5 chế độ chiến đấu với luật chơi, nhịp độ và phần thưởng riêng biệt"
        credits={profile.credits}
        onBack={onBack}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAME_MODES.map((m) => {
            const isSelected = m.id === selectedMode;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className={`flex flex-col justify-between p-5 rounded-2xl bg-[#0d1526]/95 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className="font-display font-bold text-lg"
                      style={{ color: m.accentColor }}
                    >
                      {m.name}
                    </span>
                    {isSelected && (
                      <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đang chọn
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white mb-2">
                    {m.vietnameseName}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {m.description}
                  </p>
                  <div className="space-y-1.5 pt-3 border-t border-slate-800 text-xs text-slate-400">
                    {m.highlights.map((h) => (
                      <div key={h}>· {h}</div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunchMode(m.id);
                  }}
                  className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{m.id === 'CAMPAIGN' ? 'CHỌN NHIỆM VỤ' : 'VÀO TRẬN NGAY'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </ScreenShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  MAP SELECTION (LIVE 3D PREVIEW BEHIND UI!)                              */
  /* ------------------------------------------------------------------------ */
  if (screen === 'MAPS') {
    return (
      <ScreenShell
        title="CHỌN BẢN ĐỒ 3D"
        subtitle="Nhấn vào từng bản đồ để xem trước trực tiếp không gian 3D phía sau"
        credits={profile.credits}
        onBack={onBack}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MAPS.map((map, idx) => {
            const isSelected = map.id === selectedMap;
            return (
              <div
                key={map.id}
                onClick={() => onSelectMap(map.id)}
                className={`flex flex-col justify-between p-5 rounded-2xl bg-[#0d1526]/90 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 shadow-lg shadow-cyan-500/15'
                    : 'border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-mono-num">MAP 0{idx + 1}</span>
                    <span>{map.difficultyLabel}</span>
                  </div>
                  <h3
                    className="font-display font-bold text-xl"
                    style={{ color: map.accentColor }}
                  >
                    {map.name}
                  </h3>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {map.vietnameseName}
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {map.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMap(map.id);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {isSelected ? 'Đang xem 3D' : 'Xem bản đồ'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchMap(map.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>CHIẾN ĐẤU</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </ScreenShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  CAMPAIGN MISSION SELECTION                                              */
  /* ------------------------------------------------------------------------ */
  if (screen === 'MISSIONS') {
    return (
      <ScreenShell
        title="CHIẾN DỊCH CỐT TRUYỆN"
        subtitle="Hoàn thành từng nhiệm vụ để mở khóa chương tiếp theo và chinh phục Boss Titan Core"
        credits={profile.credits}
        onBack={onBack}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAMPAIGN_MISSIONS.map((mission) => {
            const isUnlocked = mission.index <= profile.unlockedMissionIndex;
            const isCompleted = profile.completedMissionIds.includes(mission.id);
            const mapInfo = MAP_BY_ID[mission.mapId];

            return (
              <div
                key={mission.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                  isUnlocked
                    ? 'bg-[#0d1526]/95 border-slate-700/90 hover:border-cyan-400/60'
                    : 'bg-[#0a0f1c]/75 border-slate-800/80 opacity-65'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                    <span className="text-slate-400">
                      {mapInfo.name} · Độ khó: <strong className="text-slate-200">{mission.difficulty}</strong> · {mission.timeLimit}s
                    </span>
                    {isCompleted ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã hoàn thành
                      </span>
                    ) : !isUnlocked ? (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Chưa mở khóa
                      </span>
                    ) : (
                      <span className="text-cyan-400 font-semibold">Sẵn sàng</span>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-bold text-white">
                    {mission.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {mission.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-1 text-xs text-slate-300">
                    {mission.objectives.map((obj) => (
                      <div key={obj.id} className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{obj.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Thưởng:{' '}
                    <strong className="font-mono-num text-amber-300">
                      +{mission.rewardCredits} CR
                    </strong>{' '}
                    ·{' '}
                    <strong className="font-mono-num text-cyan-300">
                      +{mission.rewardXp} XP
                    </strong>
                  </div>

                  <button
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => onLaunchMission(mission.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-display font-bold text-xs transition-colors whitespace-nowrap shrink-0 ${
                      isUnlocked
                        ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isUnlocked ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>{isCompleted ? 'CHƠI LẠI' : 'BẮT ĐẦU'}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>KHÓA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </ScreenShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  EQUIPMENT / WEAPON ARMORY                                               */
  /* ------------------------------------------------------------------------ */
  if (screen === 'EQUIPMENT') {
    return (
      <ScreenShell
        title="KHO VŨ KHÍ NĂNG LƯỢNG"
        subtitle="Mở khóa 6 thiết bị bắn giả tưởng bằng điểm thưởng CR · Nhấn phím 1–6 để đổi nhanh trong trận"
        credits={profile.credits}
        onBack={onBack}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEAPONS.map((w, idx) => {
            const unlocked = profile.unlockedWeapons.includes(w.id);
            const equipped = profile.equippedWeapon === w.id;
            const canAfford = profile.credits >= w.unlockCost;

            return (
              <div
                key={w.id}
                className={`p-5 rounded-2xl bg-[#0d1526]/95 border flex flex-col justify-between transition-all ${
                  equipped
                    ? 'border-cyan-400'
                    : 'border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono-num text-slate-400">
                      PHÍM [{idx + 1}] · {w.specialTag}
                    </span>
                    {equipped && (
                      <span className="text-cyan-300 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đang trang bị
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Zap className="w-5 h-5 shrink-0" style={{ color: w.accentCss }} />
                    <h3 className="font-display text-lg font-bold text-white">
                      {w.name}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{w.vietnameseName}</div>
                  <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                    {w.description}
                  </p>

                  {/* 4 Crisp Stat Bars */}
                  <div className="mt-4 space-y-2 text-[11px]">
                    {[
                      { label: 'Sát thương', val: w.stats.power },
                      { label: 'Tốc độ bắn', val: w.stats.rate },
                      { label: 'Chính xác', val: w.stats.precision },
                      { label: 'Hiệu ứng', val: w.stats.utility },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2.5">
                        <span className="w-20 text-slate-400">{s.label}</span>
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${s.val}%`, backgroundColor: w.accentCss }}
                          />
                        </div>
                        <span className="w-7 text-right font-mono-num text-slate-300">
                          {s.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  {equipped ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 font-display font-bold text-xs cursor-default"
                    >
                      ĐANG SỬ DỤNG
                    </button>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onEquipWeapon(w.id)}
                      className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs transition-colors cursor-pointer"
                    >
                      TRANG BỊ NGAY
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onUnlockWeapon(w.id)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-bold text-xs transition-colors ${
                        canAfford
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>MỞ KHÓA · {w.unlockCost.toLocaleString('vi-VN')} CR</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScreenShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  UPGRADE CENTER                                                          */
  /* ------------------------------------------------------------------------ */
  if (screen === 'UPGRADES') {
    return (
      <ScreenShell
        title="TRUNG TÂM NÂNG CẤP"
        subtitle="Nâng cấp chỉ số chiến đấu vĩnh viễn cho nhân vật và toàn bộ thiết bị năng lượng"
        credits={profile.credits}
        onBack={onBack}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UPGRADE_DEFS.map((up) => {
            const level = profile.upgrades[up.key];
            const isMax = level >= up.maxLevel;
            const cost = getUpgradeCost(up, level);
            const canAfford = profile.credits >= cost;

            return (
              <div
                key={up.key}
                className="p-5 rounded-2xl bg-[#0d1526]/95 border border-slate-700/85 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      {up.name}
                    </h3>
                    <span className="font-mono-num text-sm font-bold text-cyan-300">
                      LV {level}/{up.maxLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {up.description}
                  </p>
                  <div className="text-xs text-emerald-400 font-medium mt-2">
                    {up.bonusPerLevelLabel}
                  </div>

                  {/* Level segment ticks */}
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {Array.from({ length: up.maxLevel }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full ${
                          i < level ? 'bg-cyan-400' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  {isMax ? (
                    <div className="w-full py-2.5 text-center rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 font-display font-bold text-xs">
                      ĐÃ ĐẠT CẤP TỐI ĐA
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyUpgrade(up.key)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-bold text-xs transition-colors ${
                        canAfford
                          ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>NÂNG CẤP LV {level + 1} · {cost.toLocaleString('vi-VN')} CR</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScreenShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  ACHIEVEMENT CENTER, TIME ATTACK LEADERBOARD & MATCH HISTORY             */
  /* ------------------------------------------------------------------------ */
  return (
    <ScreenShell
      title="THÀNH TỰU, XẾP HẠNG & LỊCH SỬ"
      subtitle={`Tổng số mục tiêu đã hạ: ${profile.lifetimeTargetsHit} · Trận đã chơi: ${profile.lifetimeMatches} · Boss đã thắng: ${profile.lifetimeBossDefeats}`}
      credits={profile.credits}
      onBack={onBack}
    >
      {/* Interactive Tab Bar */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0d1526] border border-slate-700/80 mb-5">
        {[
          { id: 'BADGES' as const, label: `Huy Hiệu (${profile.unlockedAchievementIds.length}/${ACHIEVEMENT_DEFS.length})` },
          { id: 'LEADERBOARD' as const, label: 'Bảng Xếp Hạng Time Attack' },
          { id: 'HISTORY' as const, label: `Lịch Sử Trận Đấu (${profile.matchHistory.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAchieveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              achieveTab === tab.id
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {achieveTab === 'BADGES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {ACHIEVEMENT_DEFS.map((a) => {
            const unlocked = profile.unlockedAchievementIds.includes(a.id);
            return (
              <div
                key={a.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                  unlocked
                    ? 'bg-[#0d1526]/95 border-amber-400/60'
                    : 'bg-[#0b1120]/80 border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      unlocked
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm text-white">
                      {a.name}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        · {a.vietnameseName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{a.description}</p>
                    <div className="text-[11px] text-slate-400 mt-1.5">
                      Thưởng: +{a.rewardCredits} CR · +{a.rewardXp} XP
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                    unlocked ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {unlocked ? 'Đã đạt' : 'Chưa mở'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {achieveTab === 'LEADERBOARD' && (
        <div className="bg-[#0d1526]/95 border border-slate-700/80 rounded-2xl overflow-hidden">
          {profile.timeAttackLeaderboard.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Chưa có kỷ lục Time Attack nào. Hãy tham gia chế độ Time Attack để ghi tên lên bảng xếp hạng!
            </div>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-800 text-slate-400 text-xs">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Điểm số</th>
                  <th className="py-3 px-4">Bản đồ</th>
                  <th className="py-3 px-4">Mục tiêu</th>
                  <th className="py-3 px-4">Chính xác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {profile.timeAttackLeaderboard.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-display font-bold text-amber-300">
                      {idx === 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" /> 1
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-num font-bold text-white">
                      {entry.score.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {MAP_BY_ID[entry.mapId]?.name ?? entry.mapId}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-300">
                      {entry.targetsHit}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-cyan-300">
                      {entry.accuracy}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {achieveTab === 'HISTORY' && (
        <div className="bg-[#0d1526]/95 border border-slate-700/80 rounded-2xl overflow-hidden">
          {profile.matchHistory.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Chưa có trận đấu nào được ghi nhận.
            </div>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-800 text-slate-400 text-xs">
                <tr>
                  <th className="py-3 px-4">Kết quả</th>
                  <th className="py-3 px-4">Chế độ / Bản đồ</th>
                  <th className="py-3 px-4">Điểm</th>
                  <th className="py-3 px-4">Mục tiêu</th>
                  <th className="py-3 px-4">Chính xác</th>
                  <th className="py-3 px-4">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {profile.matchHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <span
                        className={`font-display font-bold ${
                          h.isVictory ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {h.isVictory ? 'VICTORY' : 'DEFEAT'} ({h.rank})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      <div>{h.missionTitle ?? MODE_BY_ID[h.modeId]?.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {MAP_BY_ID[h.mapId]?.name}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-num font-bold text-white">
                      {h.score.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-300">
                      {h.targetsHit}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-cyan-300">
                      {h.accuracy}%
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {h.durationSec}s
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </ScreenShell>
  );
};
