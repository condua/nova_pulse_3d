import React from 'react';
import {
  Play,
  HelpCircle,
  Settings,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Trophy,
  Compass,
  Swords,
  Flag,
  Zap,
  Wrench,
  Award,
  Coins,
} from 'lucide-react';
import {
  MAP_BY_ID,
  MODE_BY_ID,
  WEAPON_BY_ID,
  xpNeededForLevel,
} from '../game/data';
import {
  GameModeId,
  MapId,
  MenuScreen,
  PlayerProfile,
} from '../game/types';

interface MainMenuProps {
  profile: PlayerProfile;
  selectedMode: GameModeId;
  selectedMap: MapId;
  soundEnabled: boolean;
  isFullscreen: boolean;
  onQuickPlay: () => void;
  onNavigate: (screen: MenuScreen) => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
  onToggleSound: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  selectedMode,
  selectedMap,
  soundEnabled,
  isFullscreen,
  onQuickPlay,
  onNavigate,
  onOpenHowToPlay,
  onOpenSettings,
  onToggleFullscreen,
  onToggleSound,
}) => {
  const xpReq = xpNeededForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / xpReq) * 100));
  const modeDef = MODE_BY_ID[selectedMode];
  const mapDef = MAP_BY_ID[selectedMap];
  const weaponDef = WEAPON_BY_ID[profile.equippedWeapon];

  const navCards: {
    screen: MenuScreen;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      screen: 'MODES',
      title: 'Chế Độ Chơi',
      subtitle: `${modeDef.name} · 5 chế độ`,
      icon: <Swords className="w-5 h-5 text-cyan-400" />,
      accent: 'hover:border-cyan-400/70',
    },
    {
      screen: 'MAPS',
      title: 'Bản Đồ 3D',
      subtitle: `${mapDef.name} · 5 bản đồ`,
      icon: <Compass className="w-5 h-5 text-emerald-400" />,
      accent: 'hover:border-emerald-400/70',
    },
    {
      screen: 'MISSIONS',
      title: 'Chiến Dịch',
      subtitle: `${profile.completedMissionIds.length}/6 nhiệm vụ`,
      icon: <Flag className="w-5 h-5 text-purple-400" />,
      accent: 'hover:border-purple-400/70',
    },
    {
      screen: 'EQUIPMENT',
      title: 'Kho Vũ Khí',
      subtitle: `${weaponDef.name} (${profile.unlockedWeapons.length}/6)`,
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      accent: 'hover:border-amber-400/70',
    },
    {
      screen: 'UPGRADES',
      title: 'Trung Tâm Nâng Cấp',
      subtitle: 'Sát thương · Tốc độ · Lá chắn',
      icon: <Wrench className="w-5 h-5 text-sky-400" />,
      accent: 'hover:border-sky-400/70',
    },
    {
      screen: 'ACHIEVEMENTS',
      title: 'Thành Tựu & Xếp Hạng',
      subtitle: `${profile.unlockedAchievementIds.length}/8 huy hiệu · Lịch sử`,
      icon: <Award className="w-5 h-5 text-rose-400" />,
      accent: 'hover:border-rose-400/70',
    },
  ];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 pointer-events-none">
      {/* Contrast scrim keeping 3D arena vivid on the right */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(108deg, rgba(7, 11, 22, 0.92) 0%, rgba(7, 11, 22, 0.68) 48%, rgba(7, 11, 22, 0.2) 100%)',
        }}
      />

      {/* TOP BAR: Player Level/XP + Credits + Utility Buttons */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div className="flex flex-wrap items-center gap-5 bg-[#0b1324]/88 border border-slate-700/80 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center font-display font-bold text-cyan-300 text-sm">
              {profile.level}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-white">Cấp {profile.level}</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="font-mono-num text-slate-400">
                  {profile.xp}/{xpReq} XP
                </span>
              </div>
              <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-mono-num font-bold text-amber-300">
              {profile.credits.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs text-slate-400">CR</span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-400">Kỷ lục</span>
            <span className="font-mono-num font-bold text-white">
              {profile.highScore.toLocaleString('vi-VN')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0b1324]/88 border border-slate-700/80 text-slate-200 hover:border-cyan-400/70 hover:text-white transition-colors text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden md:inline">
              {soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0b1324]/88 border border-slate-700/80 text-slate-200 hover:border-cyan-400/70 hover:text-white transition-colors text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>FULLSCREEN</span>
          </button>
        </div>
      </div>

      {/* CENTER HUB: Hero Brand + Active Setup + 6 Feature Navigation Cards */}
      <div className="relative z-10 max-w-3xl my-auto pointer-events-auto">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden="true">
              <polygon
                points="24,4 42,14 42,34 24,44 6,34 6,14"
                stroke="#22d3ee"
                strokeWidth="2.5"
                fill="rgba(6, 182, 212, 0.14)"
              />
              <circle cx="24" cy="24" r="6" stroke="#f59e0b" strokeWidth="2.5" />
              <line x1="24" y1="8" x2="24" y2="15" stroke="#e0f2fe" strokeWidth="2.5" />
              <line x1="24" y1="33" x2="24" y2="40" stroke="#e0f2fe" strokeWidth="2.5" />
              <line x1="8" y1="24" x2="15" y2="24" stroke="#e0f2fe" strokeWidth="2.5" />
              <line x1="33" y1="24" x2="40" y2="24" stroke="#e0f2fe" strokeWidth="2.5" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-cyan-300">
              Đấu Trường Bắn Súng Năng Lượng 3D · Phiên Bản Nâng Cao
            </p>
            <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-white leading-none">
              NOVA <span className="text-cyan-400">PULSE</span>
            </h1>
          </div>
        </div>

        {/* Active Match Configuration Line (clean unboxed metadata) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-300 mb-5">
          <span>
            Chế độ: <strong className="text-white">{modeDef.name}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            Bản đồ: <strong className="text-white">{mapDef.name}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            Vũ khí:{' '}
            <strong style={{ color: weaponDef.accentCss }}>{weaponDef.name}</strong>
          </span>
        </div>

        {/* Primary Play + Quick Secondary Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onQuickPlay}
            className="flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:scale-[0.99] text-slate-950 font-display font-bold text-lg tracking-wide transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-cyan-500/25"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>PLAY</span>
          </button>

          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#0b1324]/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/60 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>HOW TO PLAY</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#0b1324]/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>SETTINGS</span>
          </button>
        </div>

        {/* 6 Interactive Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {navCards.map((card) => (
            <button
              key={card.screen}
              type="button"
              onClick={() => onNavigate(card.screen)}
              className={`group text-left p-4 rounded-xl bg-[#0b1324]/88 hover:bg-[#111d36]/95 border border-slate-700/80 ${card.accent} transition-all cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-2">
                {card.icon}
                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">
                  Mở →
                </span>
              </div>
              <div className="font-display font-bold text-base text-white">
                {card.title}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {card.subtitle}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pointer-events-auto">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>WASD Di chuyển</span>
          <span aria-hidden="true">·</span>
          <span>Chuột Ngắm &amp; Bắn</span>
          <span aria-hidden="true">·</span>
          <span>1–6 Đổi vũ khí</span>
          <span aria-hidden="true">·</span>
          <span>Space Nhảy</span>
          <span aria-hidden="true">·</span>
          <span>Shift Chạy nhanh</span>
          <span aria-hidden="true">·</span>
          <span>Esc Tạm dừng</span>
        </div>
        <div className="text-slate-400">
          5 Bản đồ 3D · 5 Chế độ · 6 Vũ khí · 6 Loại Robot &amp; Boss
        </div>
      </div>
    </div>
  );
};
