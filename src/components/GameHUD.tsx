import React from 'react';
import {
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Check,
  Shield,
  Zap,
  Flame,
} from 'lucide-react';
import { MAP_BY_ID, MODE_BY_ID, WEAPON_BY_ID, WEAPONS } from '../game/data';
import { HudNotification, HudSnapshot, WeaponId } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  notifications: HudNotification[];
  soundEnabled: boolean;
  isFullscreen: boolean;
  onPause: () => void;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  onRequestPointerLock: () => void;
  onSelectWeapon: (weaponId: WeaponId) => void;
}

function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  notifications,
  soundEnabled,
  isFullscreen,
  onPause,
  onToggleSound,
  onToggleFullscreen,
  onRequestPointerLock,
  onSelectWeapon,
}) => {
  const isLowTime = hud.isCountdown && hud.timeRemaining <= 12;
  const isWarnTime = hud.isCountdown && hud.timeRemaining <= 25 && !isLowTime;

  const weaponDef = WEAPON_BY_ID[hud.equippedWeapon];
  const reticleGap = hud.isSprinting ? 12 : hud.weaponHeat > 0.25 ? 10 : 6;
  const reticleColor = hud.isAimingTarget ? '#f59e0b' : weaponDef.accentCss;

  const energyPct = Math.max(
    0,
    Math.min(100, Math.round((hud.playerEnergy / Math.max(1, hud.playerMaxEnergy)) * 100))
  );
  const shieldPct = Math.max(
    0,
    Math.min(100, Math.round((hud.playerShield / Math.max(1, hud.playerMaxShield)) * 100))
  );
  const bossPct = hud.boss.active
    ? Math.max(0, Math.min(100, Math.round((hud.boss.hp / Math.max(1, hud.boss.maxHp)) * 100)))
    : 0;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Brief red edge flash when hit by enemy energy orb */}
      {hud.damageFlashSeq > 0 && (
        <div
          key={hud.damageFlashSeq}
          className="fixed inset-0 pointer-events-none border-[6px] border-rose-500/70 animate-hitmarker"
          style={{
            transform: 'none',
            animationDuration: '260ms',
          }}
        />
      )}

      {/* TOP HUD ROW */}
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        {/* TOP-LEFT: SCORE, ACCURACY, VITALS & ACTIVE BUFFS */}
        <div className="flex flex-col gap-2">
          <div className="bg-[#090f1d]/82 border border-slate-700/75 rounded-xl px-4 py-3 min-w-[205px]">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400">
              <span>SCORE</span>
              <span className="font-mono-num text-cyan-300">
                ACC {hud.accuracy}%
              </span>
            </div>
            <div className="font-mono-num font-bold text-2xl sm:text-3xl text-white leading-tight">
              {hud.score.toLocaleString('vi-VN')}
            </div>

            {hud.combo >= 2 && (
              <div className="text-xs font-mono-num font-bold text-amber-400 mt-0.5">
                COMBO x{hud.combo}
              </div>
            )}

            {/* Player Energy & Shield Bars */}
            {hud.modeId !== 'TRAINING' && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-12 text-emerald-400 font-semibold">ENERGY</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-100"
                      style={{ width: `${energyPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono-num text-slate-200">
                    {hud.playerEnergy}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-12 text-sky-400 font-semibold">SHIELD</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-all duration-100"
                      style={{ width: `${shieldPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono-num text-slate-200">
                    {hud.playerShield}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Active Pickup Buff Timers */}
          {(hud.buffs.speedBoost > 0 ||
            hud.buffs.shield > 0 ||
            hud.buffs.doubleScore > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {hud.buffs.speedBoost > 0 && (
                <div className="bg-[#090f1d]/85 border border-cyan-400/70 rounded-lg px-2.5 py-1 text-cyan-300 font-mono-num flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> SPEED {Math.ceil(hud.buffs.speedBoost)}s
                </div>
              )}
              {hud.buffs.shield > 0 && (
                <div className="bg-[#090f1d]/85 border border-sky-400/70 rounded-lg px-2.5 py-1 text-sky-300 font-mono-num flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> AEGIS {Math.ceil(hud.buffs.shield)}s
                </div>
              )}
              {hud.buffs.doubleScore > 0 && (
                <div className="bg-[#090f1d]/85 border border-fuchsia-400/70 rounded-lg px-2.5 py-1 text-fuchsia-300 font-mono-num flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> x2 SCORE {Math.ceil(hud.buffs.doubleScore)}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* TOP-CENTER: TIMER, WAVE & BOSS HEALTH BAR */}
        <div className="flex flex-col items-center gap-2 max-w-md w-full">
          <div
            className={`bg-[#090f1d]/84 border rounded-xl px-5 py-2 text-center min-w-[140px] ${
              isLowTime
                ? 'border-rose-500/80'
                : isWarnTime
                ? 'border-amber-400/75'
                : 'border-slate-700/75'
            }`}
          >
            <div className="text-[10px] font-semibold tracking-wider text-slate-400">
              {hud.modeId === 'SURVIVAL'
                ? hud.intermissionTimer > 0
                  ? `NGHỈ GIỮA ĐỢT · ${Math.ceil(hud.intermissionTimer)}s`
                  : `WAVE ${hud.wave} / ${hud.totalWaves} · CÒN ${hud.waveEnemiesLeft}`
                : hud.isCountdown
                ? 'TIMER'
                : 'TIME'}
            </div>
            <div
              className={`font-mono-num font-bold text-3xl leading-none mt-0.5 ${
                isLowTime
                  ? 'text-rose-400'
                  : isWarnTime
                  ? 'text-amber-300'
                  : 'text-white'
              }`}
            >
              {formatClock(hud.timeRemaining)}
            </div>
          </div>

          {/* Dedicated Boss Energy Bar */}
          {hud.boss.active && (
            <div className="w-full max-w-sm bg-[#0f0914]/88 border border-rose-500/80 rounded-xl px-4 py-2.5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-bold text-rose-400">
                  {hud.boss.name}
                </span>
                <span className="font-mono-num text-slate-200">
                  PHASE {hud.boss.phase}/3 · {hud.boss.hp}/{hud.boss.maxHp}
                  {hud.boss.shielded ? ' · SHIELD' : ''}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.boss.shielded ? 'bg-sky-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${bossPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* TOP-RIGHT: MODE, TARGETS, OBJECTIVES & QUICK CONTROLS */}
        <div className="flex items-start gap-2.5">
          <div className="bg-[#090f1d]/82 border border-slate-700/75 rounded-xl px-4 py-3 max-w-[260px] text-right">
            <div className="text-[11px] font-semibold text-cyan-400">
              {MODE_BY_ID[hud.modeId]?.name} · {MAP_BY_ID[hud.mapId]?.name}
            </div>
            <div className="mt-0.5 flex items-baseline justify-end gap-2">
              <span className="text-[11px] text-slate-400">TARGETS</span>
              <span className="font-mono-num font-bold text-xl text-white">
                {hud.targetsHit}
              </span>
            </div>

            {hud.objectives.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 text-[11px] text-left">
                {hud.objectives.map((obj) => (
                  <div
                    key={obj.id}
                    className={`flex items-center justify-between gap-2 ${
                      obj.completed ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1">
                      {obj.completed && <Check className="w-3 h-3 shrink-0" />}
                      {obj.label}
                    </span>
                    <span className="font-mono-num shrink-0 text-slate-400">
                      {obj.type === 'ACCURACY_MIN'
                        ? `${obj.current ?? 0}%`
                        : `${Math.min(obj.target, obj.current ?? 0)}/${obj.target}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onPause}
              title="Tạm dừng (Esc / P)"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#090f1d]/88 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/70 text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 text-cyan-400" />
              <span>PAUSE</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSound}
                aria-label="Âm thanh"
                className="flex-1 flex items-center justify-center p-2 rounded-lg bg-[#090f1d]/88 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label="Toàn màn hình"
                className="flex-1 flex items-center justify-center p-2 rounded-lg bg-[#090f1d]/88 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING NOTIFICATIONS */}
      <div className="fixed top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
        {notifications.map((note) => (
          <div
            key={note.id}
            className={`animate-toast-rise text-center px-4 py-1.5 rounded-lg ${
              note.tone === 'boss'
                ? 'bg-[#200a14]/92 border border-rose-500 text-rose-300'
                : note.tone === 'mission'
                ? 'bg-[#091c18]/92 border border-emerald-400 text-emerald-300'
                : note.tone === 'pickup'
                ? 'bg-[#0a1829]/92 border border-sky-400 text-sky-300'
                : note.tone === 'level'
                ? 'bg-[#0b1529]/92 border border-cyan-400 text-cyan-300'
                : note.tone === 'combo'
                ? 'bg-[#1a1308]/92 border border-amber-400 text-amber-300'
                : 'text-white'
            }`}
          >
            <div
              className={`font-display font-bold tracking-wide ${
                note.tone === 'score' ? 'text-base text-cyan-300' : 'text-sm sm:text-base'
              }`}
            >
              {note.text}
            </div>
            {note.subtext && (
              <div className="text-xs text-slate-200 mt-0.5">{note.subtext}</div>
            )}
          </div>
        ))}
      </div>

      {/* CENTER DYNAMIC CROSSHAIR */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div
          className="w-1.5 h-1.5 rounded-full transition-colors duration-75"
          style={{
            backgroundColor: reticleColor,
            boxShadow: `0 0 8px ${reticleColor}`,
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 rounded-full transition-all duration-100"
          style={{ bottom: `${reticleGap + 4}px`, backgroundColor: reticleColor }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 rounded-full transition-all duration-100"
          style={{ top: `${reticleGap + 4}px`, backgroundColor: reticleColor }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 rounded-full transition-all duration-100"
          style={{ right: `${reticleGap + 4}px`, backgroundColor: reticleColor }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 rounded-full transition-all duration-100"
          style={{ left: `${reticleGap + 4}px`, backgroundColor: reticleColor }}
        />

        {hud.hitMarkerSeq > 0 && (
          <svg
            key={hud.hitMarkerSeq}
            viewBox="0 0 36 36"
            className="w-9 h-9 absolute top-1/2 left-1/2 animate-hitmarker"
            fill="none"
            aria-hidden="true"
          >
            <line x1="6" y1="6" x2="13" y2="13" stroke={hud.hitMarkerCrit ? '#f59e0b' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="30" y1="6" x2="23" y2="13" stroke={hud.hitMarkerCrit ? '#f59e0b' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="6" y1="30" x2="13" y2="23" stroke={hud.hitMarkerCrit ? '#f59e0b' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="30" y1="30" x2="23" y2="23" stroke={hud.hitMarkerCrit ? '#f59e0b' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* BOTTOM-LEFT: TRAINING MODE LIVE GUIDANCE */}
      {hud.trainingHint && (
        <div className="fixed bottom-4 left-5 max-w-md bg-[#090f1d]/86 border border-cyan-400/60 rounded-xl px-4 py-2.5 text-xs text-slate-200 leading-relaxed">
          {hud.trainingHint}
        </div>
      )}

      {/* BOTTOM-RIGHT: ACTIVE WEAPON & QUICK SWITCHER (KEYS 1-6) */}
      <div className="fixed bottom-4 right-5 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-1">
          {WEAPONS.map((w, idx) => {
            const unlocked = hud.unlockedWeapons.includes(w.id);
            if (!unlocked) return null;
            const active = hud.equippedWeapon === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onSelectWeapon(w.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono-num font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-800 text-white border-cyan-400'
                    : 'bg-[#090f1d]/80 text-slate-400 border-slate-700/70 hover:text-white'
                }`}
                style={active ? { borderColor: w.accentCss } : undefined}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="bg-[#090f1d]/84 border border-slate-700/75 rounded-xl px-3.5 py-2 flex items-center gap-3 pointer-events-none">
          <div>
            <div
              className="text-[11px] font-display font-bold tracking-wide"
              style={{ color: weaponDef.accentCss }}
            >
              {weaponDef.name.toUpperCase()}
            </div>
            <div className="mt-1 w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${Math.max(15, Math.round((1 - hud.weaponHeat * 0.5) * 100))}%`,
                  backgroundColor: weaponDef.accentCss,
                }}
              />
            </div>
          </div>
          <div className="text-xs font-mono-num font-semibold text-slate-300">
            {hud.isSprinting ? 'SPRINT' : 'READY'}
          </div>
        </div>
      </div>

      {/* UNOBTRUSIVE POINTER LOCK HINT */}
      {!hud.isPointerLocked && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onRequestPointerLock}
            className="px-4 py-2 rounded-lg bg-[#090f1d]/90 border border-cyan-400/60 text-xs text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            Nhấn để khóa chuột xoay góc nhìn 360° (hoặc giữ chuột kéo)
          </button>
        </div>
      )}
    </div>
  );
};
