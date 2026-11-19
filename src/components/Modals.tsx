import React from 'react';
import {
  X,
  Play,
  RotateCcw,
  Home,
  Settings,
  HelpCircle,
  Maximize2,
  Minimize2,
  Trophy,
  Volume2,
  VolumeX,
  Award,
  Coins,
  Sparkles,
  ArrowRight,
  Music,
} from 'lucide-react';
import { MAP_BY_ID, MODE_BY_ID } from '../game/data';
import {
  GameSettings,
  GraphicsQuality,
  MatchResult,
} from '../game/types';

/* -------------------------------------------------------------------------- */
/*  HOW TO PLAY MODAL                                                         */
/* -------------------------------------------------------------------------- */

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const controls = [
    { key: 'W A S D', action: 'Di chuyển 4 hướng trên bản đồ 3D' },
    { key: 'Chuột', action: 'Xoay góc nhìn 360° và ngắm tâm' },
    { key: 'Chuột trái', action: 'Bắn tia năng lượng (nhấn hoặc giữ)' },
    { key: 'Space', action: 'Nhảy qua chướng ngại vật' },
    { key: 'Shift', action: 'Chạy nhanh tăng tốc độ' },
    { key: '1 – 6', action: 'Chuyển nhanh các vũ khí đã mở khóa' },
    { key: 'Esc / P', action: 'Tạm dừng trận đấu' },
  ];

  const enemies = [
    { name: 'Scout Robot', accent: 'text-teal-300', desc: 'Nhỏ, cơ động cao, né đạn nhanh (+120)' },
    { name: 'Guard Robot', accent: 'text-cyan-300', desc: 'Robot tuần tra và giữ vị trí (+140)' },
    { name: 'Flying Drone', accent: 'text-amber-300', desc: 'Bay lượn trên không quỹ đạo số 8 (+160)' },
    { name: 'Heavy Robot', accent: 'text-orange-400', desc: 'Giáp dày chịu sát thương lớn (+280)' },
    { name: 'Shield Robot', accent: 'text-sky-400', desc: 'Có lá chắn năng lượng phía trước (+240)' },
    { name: 'Boss Titan Core', accent: 'text-rose-400', desc: 'Robot khổng lồ 3 giai đoạn (+2500)' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#050912]/84">
      <div className="w-full max-w-3xl bg-[#0d1526] border border-slate-700/90 rounded-2xl p-6 sm:p-7 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">HOW TO PLAY</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Hướng dẫn điều khiển, 6 loại robot địch và vật phẩm hỗ trợ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
          <div>
            <h3 className="font-display text-sm font-bold text-cyan-400 mb-3">
              Điều Khiển Nhân Vật
            </h3>
            <div className="space-y-2">
              {controls.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/80 last:border-b-0"
                >
                  <span className="font-mono-num text-xs font-bold text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700 whitespace-nowrap shrink-0">
                    {c.key}
                  </span>
                  <span className="text-xs text-slate-300 text-right">{c.action}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
              <strong className="text-white block mb-1">Vật Phẩm Trên Bản Đồ</strong>
              Energy Pack (hồi năng lượng) · Score Bonus (+350 điểm) · Speed Boost (tăng tốc) ·
              Shield (lá chắn bảo vệ) · Double Score (nhân đôi điểm 12s).
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-amber-400 mb-3">
              6 Loại Robot &amp; Drone 3D
            </h3>
            <div className="space-y-2.5">
              {enemies.map((e) => (
                <div key={e.name} className="pb-2 border-b border-slate-800/80 last:border-b-0">
                  <div className={`text-xs font-bold ${e.accent}`}>{e.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{e.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
          >
            ĐÃ HIỂU
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  SETTINGS MODAL (SEPARATE MUSIC & SFX VOLUMES!)                            */
/* -------------------------------------------------------------------------- */

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onClose,
}) => {
  const qualities: { value: GraphicsQuality; label: string; desc: string }[] = [
    { value: 'LOW', label: 'LOW', desc: 'Tối ưu FPS cao nhất' },
    { value: 'MEDIUM', label: 'MEDIUM', desc: 'Cân bằng bóng đổ & mượt' },
    { value: 'HIGH', label: 'HIGH', desc: 'Chi tiết & ánh sáng tối đa' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#050912]/84">
      <div className="w-full max-w-lg bg-[#0d1526] border border-slate-700/90 rounded-2xl p-6 sm:p-7 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">SETTINGS</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Âm lượng nhạc nền &amp; hiệu ứng riêng biệt, độ nhạy chuột và đồ họa 3D
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 mt-5">
          {/* Master Sound Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-200">
              Hệ thống âm thanh tổng
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({ ...settings, soundEnabled: !settings.soundEnabled })
              }
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                settings.soundEnabled
                  ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>{settings.soundEnabled ? 'Đang bật' : 'Đang tắt'}</span>
            </button>
          </div>

          {/* Music Volume */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-200 flex items-center gap-2">
                <Music className="w-4 h-4 text-cyan-400" /> Nhạc nền &amp; Môi trường
              </span>
              <span className="font-mono-num text-xs text-slate-300">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.musicVolume * 100)}
              disabled={!settings.soundEnabled}
              onChange={(e) =>
                onChange({ ...settings, musicVolume: Number(e.target.value) / 100 })
              }
              className="nova-slider w-full disabled:opacity-40"
            />
          </div>

          {/* SFX Volume */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-200 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-400" /> Hiệu ứng bắn &amp; Chiến đấu
              </span>
              <span className="font-mono-num text-xs text-slate-300">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.sfxVolume * 100)}
              disabled={!settings.soundEnabled}
              onChange={(e) =>
                onChange({ ...settings, sfxVolume: Number(e.target.value) / 100 })
              }
              className="nova-slider w-full disabled:opacity-40"
            />
          </div>

          {/* Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-200">Độ nhạy chuột</span>
              <span className="font-mono-num text-xs text-cyan-300 font-semibold">
                {settings.sensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={2.5}
              step={0.1}
              value={settings.sensitivity}
              onChange={(e) =>
                onChange({ ...settings, sensitivity: Number(e.target.value) })
              }
              className="nova-slider w-full"
            />
          </div>

          {/* FOV */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-200">Góc nhìn camera (FOV)</span>
              <span className="font-mono-num text-xs text-cyan-300 font-semibold">
                {settings.fov}°
              </span>
            </div>
            <input
              type="range"
              min={65}
              max={95}
              step={1}
              value={settings.fov}
              onChange={(e) => onChange({ ...settings, fov: Number(e.target.value) })}
              className="nova-slider w-full"
            />
          </div>

          {/* Graphics Quality */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-200">Chất lượng đồ họa</span>
              <span className="text-xs text-slate-400">
                {qualities.find((q) => q.value === settings.graphicsQuality)?.desc}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {qualities.map((q) => {
                const active = settings.graphicsQuality === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => onChange({ ...settings, graphicsQuality: q.value })}
                    className={`py-2.5 rounded-xl text-xs font-display font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
          >
            LƯU &amp; ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  PAUSE MENU                                                                */
/* -------------------------------------------------------------------------- */

interface PauseMenuProps {
  score: number;
  targetsHit: number;
  modeName: string;
  mapName: string;
  isFullscreen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
  onToggleFullscreen: () => void;
  onFinishTraining?: () => void;
  onMainMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  score,
  targetsHit,
  modeName,
  mapName,
  isFullscreen,
  onResume,
  onRestart,
  onOpenSettings,
  onOpenHowToPlay,
  onToggleFullscreen,
  onFinishTraining,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#060b16]/80">
      <div className="w-full max-w-md bg-[#0d1526] border border-slate-700/90 rounded-2xl p-6 sm:p-7 text-center">
        <p className="text-xs font-semibold tracking-wider text-cyan-400">
          {modeName} · {mapName}
        </p>
        <h2 className="font-display text-3xl font-bold text-white mt-1">PAUSED</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          {targetsHit} mục tiêu · {score.toLocaleString('vi-VN')} điểm
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-base cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>RESUME</span>
          </button>

          {onFinishTraining && (
            <button
              type="button"
              onClick={onFinishTraining}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/70 text-emerald-300 font-display font-bold text-sm cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>HOÀN THÀNH LUYỆN TẬP</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>RESTART</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-medium text-xs cursor-pointer"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>SETTINGS</span>
            </button>

            <button
              type="button"
              onClick={onOpenHowToPlay}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-medium text-xs cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>HOW TO PLAY</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 font-medium text-xs cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              <span>FULLSCREEN</span>
            </button>

            <button
              type="button"
              onClick={onMainMenu}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 font-medium text-xs cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  VICTORY & GAME OVER SUMMARY SCREEN                                        */
/* -------------------------------------------------------------------------- */

interface MatchResultModalProps {
  result: MatchResult;
  onPlayAgain: () => void;
  onNextMission?: (missionId: string) => void;
  onMainMenu: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  result,
  onPlayAgain,
  onNextMission,
  onMainMenu,
}) => {
  const rankColors: Record<MatchResult['rank'], string> = {
    S: 'text-amber-300 border-amber-400/80 bg-amber-500/15',
    A: 'text-cyan-300 border-cyan-400/80 bg-cyan-500/15',
    B: 'text-emerald-300 border-emerald-400/80 bg-emerald-500/15',
    C: 'text-slate-200 border-slate-500/80 bg-slate-700/30',
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#060b16]/85 overflow-y-auto">
      <div
        className={`w-full max-w-2xl bg-[#0d1526] border rounded-2xl p-6 sm:p-8 text-center my-auto ${
          result.isVictory ? 'border-emerald-400/70' : 'border-rose-500/60'
        }`}
      >
        <div className="flex items-center justify-center gap-4 mb-3">
          <div
            className={`w-14 h-14 rounded-xl border font-display font-bold text-3xl flex items-center justify-center ${
              rankColors[result.rank]
            }`}
          >
            {result.rank}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold tracking-wider text-slate-400">
              {result.missionTitle ?? MODE_BY_ID[result.modeId]?.name} ·{' '}
              {MAP_BY_ID[result.mapId]?.name}
            </p>
            <h2
              className={`font-display text-3xl sm:text-4xl font-bold leading-none mt-0.5 ${
                result.isVictory ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {result.isVictory ? 'VICTORY' : 'GAME OVER'}
            </h2>
          </div>
        </div>

        {/* Big Score + Rewards Strip */}
        <div className="my-5 py-4 border-y border-slate-800 flex flex-col sm:flex-row items-center justify-around gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400">
              TỔNG ĐIỂM
            </div>
            <div className="font-mono-num font-bold text-4xl text-white mt-0.5">
              {result.score.toLocaleString('vi-VN')}
            </div>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-xs">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {result.isNewBest ? (
                <span className="text-amber-300 font-semibold">Kỷ lục cá nhân mới!</span>
              ) : (
                <span className="text-slate-400">
                  Kỷ lục: {result.highScore.toLocaleString('vi-VN')}
                </span>
              )}
            </div>
          </div>

          <div className="h-12 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-5">
            <div className="text-center">
              <div className="text-[11px] text-slate-400">KINH NGHIỆM</div>
              <div className="font-mono-num font-bold text-xl text-cyan-300 mt-0.5">
                +{result.xpEarned} XP
              </div>
              {result.leveledUp && (
                <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1 mt-0.5">
                  <Sparkles className="w-3 h-3" /> Lên cấp {result.newLevel}!
                </div>
              )}
            </div>

            <div className="text-center">
              <div className="text-[11px] text-slate-400">PHẦN THƯỞNG</div>
              <div className="font-mono-num font-bold text-xl text-amber-300 mt-0.5 flex items-center justify-center gap-1">
                <Coins className="w-4 h-4" /> +{result.creditsEarned}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Tín dụng CR</div>
            </div>
          </div>
        </div>

        {/* 6 Detailed Combat Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5 text-center">
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/85 border border-slate-800">
            <div className="text-[11px] text-slate-400">MỤC TIÊU TRÚNG</div>
            <div className="font-mono-num font-bold text-lg text-white">
              {result.targetsHit}
            </div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/85 border border-slate-800">
            <div className="text-[11px] text-slate-400">TỔNG PHÁT BẮN</div>
            <div className="font-mono-num font-bold text-lg text-slate-200">
              {result.shotsFired}
            </div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/85 border border-slate-800">
            <div className="text-[11px] text-slate-400">TỶ LỆ CHÍNH XÁC</div>
            <div className="font-mono-num font-bold text-lg text-cyan-300">
              {result.accuracy}%
            </div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/85 border border-slate-800">
            <div className="text-[11px] text-slate-400">THỜI GIAN</div>
            <div className="font-mono-num font-bold text-lg text-white">
              {result.durationSec}s
            </div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/85 border border-slate-800">
            <div className="text-[11px] text-slate-400">NHIỆM VỤ XONG</div>
            <div className="font-mono-num font-bold text-lg text-emerald-300">
              {result.missionsCompletedCount}/{result.totalMissionsCount}
            </div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/85 border border-slate-800">
            <div className="text-[11px] text-slate-400">COMBO CAO NHẤT</div>
            <div className="font-mono-num font-bold text-lg text-amber-300">
              x{result.maxCombo}
            </div>
          </div>
        </div>

        {/* Newly Unlocked Achievements */}
        {result.newlyUnlockedAchievements.length > 0 && (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-400/50 text-left">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1.5">
              <Award className="w-4 h-4" /> THÀNH TỰU MỚI ĐẠT ĐƯỢC
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-200">
              {result.newlyUnlockedAchievements.map((a) => (
                <span key={a.id}>
                  <strong>{a.name}</strong> (+{a.rewardCredits} CR)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {result.isVictory && result.nextMissionId && onNextMission && (
            <button
              type="button"
              onClick={() => onNextMission(result.nextMissionId!)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              <span>NHIỆM VỤ TIẾP THEO</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-sm cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
