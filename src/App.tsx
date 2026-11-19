import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { GameScreens } from './components/GameScreens';
import { MainMenu } from './components/MainMenu';
import {
  HowToPlayModal,
  MatchResultModal,
  PauseMenu,
  SettingsModal,
} from './components/Modals';
import {
  ACHIEVEMENT_DEFS,
  CAMPAIGN_MISSIONS,
  getUpgradeCost,
  loadPlayerProfile,
  MAP_BY_ID,
  MODE_BY_ID,
  savePlayerProfile,
  UPGRADE_DEFS,
  WEAPON_BY_ID,
} from './game/data';
import { NovaPulseEngine } from './game/engine';
import {
  DEFAULT_SETTINGS,
  GameModeId,
  GameSettings,
  GameState,
  HudNotification,
  HudSnapshot,
  INITIAL_HUD_SNAPSHOT,
  MapId,
  MatchConfig,
  MatchResult,
  MenuScreen,
  PlayerProfile,
  UpgradeKey,
  WeaponId,
} from './game/types';

const SETTINGS_STORAGE_KEY = 'nova_pulse_settings_v2';

function loadInitialSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.musicVolume))
          : DEFAULT_SETTINGS.musicVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.sfxVolume))
          : DEFAULT_SETTINGS.sfxVolume,
      sensitivity:
        typeof parsed.sensitivity === 'number'
          ? Math.max(0.3, Math.min(2.5, parsed.sensitivity))
          : DEFAULT_SETTINGS.sensitivity,
      graphicsQuality:
        parsed.graphicsQuality === 'LOW' ||
        parsed.graphicsQuality === 'MEDIUM' ||
        parsed.graphicsQuality === 'HIGH'
          ? parsed.graphicsQuality
          : DEFAULT_SETTINGS.graphicsQuality,
      fov:
        typeof parsed.fov === 'number'
          ? Math.max(65, Math.min(95, parsed.fov))
          : DEFAULT_SETTINGS.fov,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NovaPulseEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('MENU');
  const [menuScreen, setMenuScreen] = useState<MenuScreen>('MAIN');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD_SNAPSHOT);
  const [settings, setSettings] = useState<GameSettings>(loadInitialSettings);
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);

  const [selectedMode, setSelectedMode] = useState<GameModeId>('TIME_ATTACK');
  const [selectedMap, setSelectedMap] = useState<MapId>('FUTURE_CITY');
  const [lastMatchConfig, setLastMatchConfig] = useState<MatchConfig>({
    modeId: 'TIME_ATTACK',
    mapId: 'FUTURE_CITY',
  });

  const [notifications, setNotifications] = useState<HudNotification[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const notificationTimersRef = useRef<number[]>([]);

  // Mount Three.js Engine once in isolated WebGL container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    let engine: NovaPulseEngine | null = null;
    try {
      engine = new NovaPulseEngine(mountEl, settings, profile, {
        onStateChange: (nextState) => {
          setGameState(nextState);
          if (nextState === 'PLAYING') {
            setShowHowToPlay(false);
            setShowSettings(false);
          }
        },
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
        onNotification: (note) => {
          setNotifications((prev) => [...prev.slice(-2), note]);
          const tid = window.setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== note.id));
          }, 1450);
          notificationTimersRef.current.push(tid);
        },
        onMatchComplete: (result, updatedProfile) => {
          setMatchResult(result);
          setProfile(updatedProfile);
          savePlayerProfile(updatedProfile);
        },
        onWeaponSwitched: (weaponId) => {
          setProfile((prev) => {
            const next = { ...prev, equippedWeapon: weaponId };
            savePlayerProfile(next);
            return next;
          });
        },
      });
      engineRef.current = engine;
    } catch (err) {
      console.error('Failed to initialize 3D engine:', err);
      setWebglError(
        'Trình duyệt hiện chưa hỗ trợ WebGL hoặc gặp sự cố khi khởi tạo đồ họa 3D.'
      );
    }

    return () => {
      notificationTimersRef.current.forEach((id) => window.clearTimeout(id));
      notificationTimersRef.current = [];
      engine?.dispose();
      engineRef.current = null;
    };
    // Mount once for stable WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync settings to engine & persist
  useEffect(() => {
    engineRef.current?.applySettings(settings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // Sync profile changes to engine & persist
  useEffect(() => {
    engineRef.current?.syncProfile(profile);
    savePlayerProfile(profile);
  }, [profile]);

  // Track Fullscreen API state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const startConfiguredMatch = useCallback((config: MatchConfig) => {
    engineRef.current?.sound.playUiClick();
    setMatchResult(null);
    setNotifications([]);
    setLastMatchConfig(config);
    setSelectedMode(config.modeId);
    if (config.modeId !== 'CAMPAIGN') {
      setSelectedMap(config.mapId);
    }
    engineRef.current?.startMatch(config);
  }, []);

  const handleQuickPlay = useCallback(() => {
    if (selectedMode === 'CAMPAIGN') {
      const m =
        CAMPAIGN_MISSIONS[
          Math.min(profile.unlockedMissionIndex, CAMPAIGN_MISSIONS.length - 1)
        ];
      startConfiguredMatch({
        modeId: 'CAMPAIGN',
        mapId: m.mapId,
        missionId: m.id,
      });
      return;
    }
    startConfiguredMatch({ modeId: selectedMode, mapId: selectedMap });
  }, [profile.unlockedMissionIndex, selectedMap, selectedMode, startConfiguredMatch]);

  const handleToggleFullscreen = useCallback(() => {
    engineRef.current?.sound.playUiClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleToggleSound = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, soundEnabled: !prev.soundEnabled };
      if (next.soundEnabled) {
        engineRef.current?.sound.configure(true, next.musicVolume, next.sfxVolume);
        engineRef.current?.sound.playUiClick();
      }
      return next;
    });
  }, []);

  const handleSelectMap = useCallback((mapId: MapId) => {
    engineRef.current?.sound.playUiClick();
    setSelectedMap(mapId);
    engineRef.current?.setPreviewMap(mapId);
  }, []);

  const handleUnlockWeapon = useCallback((weaponId: WeaponId) => {
    const def = WEAPON_BY_ID[weaponId];
    setProfile((prev) => {
      if (prev.unlockedWeapons.includes(weaponId) || prev.credits < def.unlockCost) {
        return prev;
      }
      engineRef.current?.sound.playPickup();
      const nextUnlocked = [...prev.unlockedWeapons, weaponId];
      const nextAchievements = [...prev.unlockedAchievementIds];
      let bonusCredits = 0;
      if (
        nextUnlocked.length >= 3 &&
        !nextAchievements.includes('ARSENAL_COLLECTOR')
      ) {
        nextAchievements.push('ARSENAL_COLLECTOR');
        const aDef = ACHIEVEMENT_DEFS.find((a) => a.id === 'ARSENAL_COLLECTOR');
        if (aDef) bonusCredits = aDef.rewardCredits;
      }
      return {
        ...prev,
        credits: prev.credits - def.unlockCost + bonusCredits,
        unlockedWeapons: nextUnlocked,
        equippedWeapon: weaponId,
        unlockedAchievementIds: nextAchievements,
      };
    });
  }, []);

  const handleEquipWeapon = useCallback((weaponId: WeaponId) => {
    engineRef.current?.sound.playUiClick();
    setProfile((prev) => {
      if (!prev.unlockedWeapons.includes(weaponId)) return prev;
      return { ...prev, equippedWeapon: weaponId };
    });
  }, []);

  const handleBuyUpgrade = useCallback((key: UpgradeKey) => {
    const def = UPGRADE_DEFS.find((u) => u.key === key);
    if (!def) return;
    setProfile((prev) => {
      const currentLv = prev.upgrades[key];
      if (currentLv >= def.maxLevel) return prev;
      const cost = getUpgradeCost(def, currentLv);
      if (prev.credits < cost) return prev;
      engineRef.current?.sound.playMissionComplete();
      return {
        ...prev,
        credits: prev.credits - cost,
        upgrades: {
          ...prev.upgrades,
          [key]: currentLv + 1,
        },
      };
    });
  }, []);

  const handleMainMenu = useCallback(() => {
    engineRef.current?.sound.playUiClick();
    setMatchResult(null);
    setNotifications([]);
    setShowHowToPlay(false);
    setShowSettings(false);
    setMenuScreen('MAIN');
    engineRef.current?.returnToMenu();
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090d16]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Không gian đấu trường bắn súng 3D NOVA PULSE"
      />

      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#090d16]">
          <div className="max-w-md bg-[#0d1526] border border-slate-700 rounded-2xl p-6 text-center">
            <h1 className="font-display text-2xl font-bold text-white">
              NOVA PULSE 3D
            </h1>
            <p className="text-sm text-slate-300 mt-3">{webglError}</p>
          </div>
        </div>
      )}

      {/* MAIN MENU HUB */}
      {gameState === 'MENU' && menuScreen === 'MAIN' && !webglError && (
        <MainMenu
          profile={profile}
          selectedMode={selectedMode}
          selectedMap={selectedMap}
          soundEnabled={settings.soundEnabled}
          isFullscreen={isFullscreen}
          onQuickPlay={handleQuickPlay}
          onNavigate={(screen) => {
            engineRef.current?.sound.playUiClick();
            setMenuScreen(screen);
          }}
          onOpenHowToPlay={() => {
            engineRef.current?.sound.playUiClick();
            setShowHowToPlay(true);
          }}
          onOpenSettings={() => {
            engineRef.current?.sound.playUiClick();
            setShowSettings(true);
          }}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleSound={handleToggleSound}
        />
      )}

      {/* SUB-SCREENS: MODES, MAPS, MISSIONS, EQUIPMENT, UPGRADES, ACHIEVEMENTS */}
      {gameState === 'MENU' && menuScreen !== 'MAIN' && !webglError && (
        <GameScreens
          screen={menuScreen}
          profile={profile}
          selectedMode={selectedMode}
          selectedMap={selectedMap}
          onBack={() => {
            engineRef.current?.sound.playUiClick();
            setMenuScreen('MAIN');
          }}
          onSelectMode={(mode) => {
            engineRef.current?.sound.playUiClick();
            setSelectedMode(mode);
          }}
          onLaunchMode={(mode) => {
            if (mode === 'CAMPAIGN') {
              engineRef.current?.sound.playUiClick();
              setSelectedMode('CAMPAIGN');
              setMenuScreen('MISSIONS');
            } else {
              startConfiguredMatch({ modeId: mode, mapId: selectedMap });
            }
          }}
          onSelectMap={handleSelectMap}
          onLaunchMap={(mapId) => {
            const launchMode = selectedMode === 'CAMPAIGN' ? 'TIME_ATTACK' : selectedMode;
            startConfiguredMatch({ modeId: launchMode, mapId });
          }}
          onLaunchMission={(missionId) => {
            const m = CAMPAIGN_MISSIONS.find((x) => x.id === missionId);
            if (!m) return;
            startConfiguredMatch({
              modeId: 'CAMPAIGN',
              mapId: m.mapId,
              missionId: m.id,
            });
          }}
          onUnlockWeapon={handleUnlockWeapon}
          onEquipWeapon={handleEquipWeapon}
          onBuyUpgrade={handleBuyUpgrade}
        />
      )}

      {/* ACTIVE GAMEPLAY HUD */}
      {gameState === 'PLAYING' && (
        <GameHUD
          hud={hud}
          notifications={notifications}
          soundEnabled={settings.soundEnabled}
          isFullscreen={isFullscreen}
          onPause={() => {
            engineRef.current?.sound.playUiClick();
            engineRef.current?.pauseGame();
          }}
          onToggleSound={handleToggleSound}
          onToggleFullscreen={handleToggleFullscreen}
          onRequestPointerLock={() => engineRef.current?.requestPointerLockSafe()}
          onSelectWeapon={(wId) => engineRef.current?.equipWeaponInMatch(wId)}
        />
      )}

      {/* PAUSE OVERLAY */}
      {gameState === 'PAUSED' && !showSettings && !showHowToPlay && (
        <PauseMenu
          score={hud.score}
          targetsHit={hud.targetsHit}
          modeName={MODE_BY_ID[hud.modeId]?.name ?? hud.modeId}
          mapName={MAP_BY_ID[hud.mapId]?.name ?? hud.mapId}
          isFullscreen={isFullscreen}
          onResume={() => {
            engineRef.current?.sound.playUiClick();
            engineRef.current?.resumeGame();
          }}
          onRestart={() => startConfiguredMatch(lastMatchConfig)}
          onOpenSettings={() => {
            engineRef.current?.sound.playUiClick();
            setShowSettings(true);
          }}
          onOpenHowToPlay={() => {
            engineRef.current?.sound.playUiClick();
            setShowHowToPlay(true);
          }}
          onToggleFullscreen={handleToggleFullscreen}
          onFinishTraining={
            hud.modeId === 'TRAINING'
              ? () => {
                  engineRef.current?.sound.playUiClick();
                  engineRef.current?.finishTraining();
                }
              : undefined
          }
          onMainMenu={handleMainMenu}
        />
      )}

      {/* VICTORY / GAME OVER SUMMARY SCREEN */}
      {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && matchResult && (
        <MatchResultModal
          result={matchResult}
          onPlayAgain={() => startConfiguredMatch(lastMatchConfig)}
          onNextMission={(nextId) => {
            const m = CAMPAIGN_MISSIONS.find((x) => x.id === nextId);
            if (!m) return;
            startConfiguredMatch({
              modeId: 'CAMPAIGN',
              mapId: m.mapId,
              missionId: m.id,
            });
          }}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* MODALS */}
      {showHowToPlay && (
        <HowToPlayModal
          onClose={() => {
            engineRef.current?.sound.playUiClick();
            setShowHowToPlay(false);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => {
            engineRef.current?.sound.playUiClick();
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
