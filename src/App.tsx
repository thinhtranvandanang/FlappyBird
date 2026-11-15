import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { FlappyCanvas, FlappyCanvasHandle } from './components/FlappyCanvas';
import {
  DIFFICULTY_CONFIGS,
  Difficulty,
  GameState,
  SKY_PALETTES,
  SkyTheme,
  getMedal,
} from './types/game';
import { soundEngine } from './utils/sound';

const STORAGE_BEST_KEY = 'vo_canh_best_scores_v1';
const STORAGE_THEME_KEY = 'vo_canh_sky_theme_v1';

type BestScores = Record<Difficulty, number>;

const DEFAULT_BEST: BestScores = {
  easy: 0,
  normal: 0,
  hard: 0,
};

function loadBestScores(): BestScores {
  try {
    const raw = localStorage.getItem(STORAGE_BEST_KEY);
    if (!raw) return DEFAULT_BEST;
    const parsed = JSON.parse(raw) as Partial<BestScores>;
    return {
      easy: Number.isFinite(parsed.easy) ? Number(parsed.easy) : 0,
      normal: Number.isFinite(parsed.normal) ? Number(parsed.normal) : 0,
      hard: Number.isFinite(parsed.hard) ? Number(parsed.hard) : 0,
    };
  } catch {
    return DEFAULT_BEST;
  }
}

function loadSkyTheme(): SkyTheme {
  try {
    const raw = localStorage.getItem(STORAGE_THEME_KEY);
    if (raw === 'day' || raw === 'sunset' || raw === 'night') return raw;
  } catch {
    // ignore storage failures
  }
  return 'day';
}

export default function App() {
  const canvasRef = useRef<FlappyCanvasHandle | null>(null);
  const gameOverAtRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [skyTheme, setSkyTheme] = useState<SkyTheme>(() => loadSkyTheme());
  const [score, setScore] = useState<number>(0);
  const [bestScores, setBestScores] = useState<BestScores>(() => loadBestScores());
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  const currentBest = bestScores[difficulty];
  const medal = getMedal(score);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleStartPlay = useCallback(() => {
    setScore(0);
    setIsNewRecord(false);
    setGameState('PLAYING');
  }, []);

  const handleStartFromButton = useCallback(() => {
    if (gameState === 'TITLE_MENU') {
      canvasRef.current?.flap();
    } else if (gameState === 'GAME_OVER') {
      setScore(0);
      setIsNewRecord(false);
      canvasRef.current?.resetBoard();
      setGameState('TITLE_MENU');
      // Immediately start a fresh run with one clean flap
      requestAnimationFrame(() => {
        canvasRef.current?.flap();
      });
    }
  }, [gameState]);

  const handleRestartToReady = useCallback(() => {
    setScore(0);
    setIsNewRecord(false);
    canvasRef.current?.resetBoard();
    setGameState('TITLE_MENU');
  }, []);

  const handleTogglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      gameOverAtRef.current = performance.now();
      setScore(finalScore);
      setGameState('GAME_OVER');

      setBestScores((prev) => {
        if (finalScore > prev[difficulty]) {
          const updated = { ...prev, [difficulty]: finalScore };
          try {
            localStorage.setItem(STORAGE_BEST_KEY, JSON.stringify(updated));
          } catch {
            // ignore storage failures
          }
          setIsNewRecord(true);
          soundEngine.playNewRecord();
          return updated;
        }
        return prev;
      });
    },
    [difficulty]
  );

  const handleSelectDifficulty = (nextDiff: Difficulty) => {
    if (nextDiff === difficulty) return;
    setDifficulty(nextDiff);
    if (gameState !== 'TITLE_MENU') {
      setScore(0);
      setIsNewRecord(false);
      canvasRef.current?.resetBoard();
      setGameState('TITLE_MENU');
    }
  };

  const handleSelectSkyTheme = (nextTheme: SkyTheme) => {
    setSkyTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
    } catch {
      // ignore storage failures
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      const isButtonFocused = target?.tagName === 'BUTTON';

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (isButtonFocused && e.code === 'Space') {
          // Let explicit button clicks handle themselves unless in active play
          if (gameState !== 'PLAYING') return;
        }
        e.preventDefault();

        if (gameState === 'TITLE_MENU' || gameState === 'PLAYING') {
          canvasRef.current?.flap();
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        } else if (gameState === 'GAME_OVER') {
          // Grace delay so accidental double-flap doesn't skip the score card
          if (performance.now() - gameOverAtRef.current > 380) {
            handleStartFromButton();
          }
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (e.code === 'KeyR' && (gameState === 'GAME_OVER' || gameState === 'PAUSED')) {
        e.preventDefault();
        handleStartFromButton();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleStartFromButton, handleTogglePause, toggleMute]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F6F8] text-slate-900">
      {/* Minimal Header */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleRestartToReady();
            }}
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Vỗ Cánh
          </a>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
            <span>Độ khó: {DIFFICULTY_CONFIGS[difficulty].label}</span>
            <span aria-hidden="true">·</span>
            <span>
              Kỷ lục:{' '}
              <strong className="font-mono-nums font-semibold text-slate-800">
                {currentBest}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={gameState === 'PAUSED' ? 'Tiếp tục' : 'Tạm dừng'}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {gameState === 'PAUSED' ? (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Tiếp tục</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Tạm dừng</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{muted ? 'Đã tắt tiếng' : 'Âm thanh'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_320px] gap-6 lg:gap-10 items-center justify-center">
          {/* Primary Game Canvas Stage */}
          <section className="flex justify-center">
            <div
              className="relative w-full max-w-[440px] aspect-[440/620] max-h-[calc(100vh-120px)] rounded-2xl overflow-hidden bg-sky-200 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/10 select-none"
            >
              <FlappyCanvas
                ref={canvasRef}
                gameState={gameState}
                difficulty={difficulty}
                skyTheme={skyTheme}
                onStartPlay={handleStartPlay}
                onScoreChange={setScore}
                onGameOver={handleGameOver}
              />

              {/* TITLE MENU OVERLAY */}
              {gameState === 'TITLE_MENU' && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between py-10 px-6">
                  <div className="text-center mt-2">
                    <h1
                      className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_3px_0_rgba(15,23,42,0.55)]"
                      style={{ textWrap: 'balance' }}
                    >
                      Vỗ Cánh
                    </h1>
                    <p className="mt-2 text-sm font-medium text-slate-900/85 bg-white/75 backdrop-blur-[2px] px-3.5 py-1.5 rounded-lg inline-block">
                      Nhấn Space, chạm hoặc nhấp chuột để bay
                    </p>
                  </div>

                  <div className="pointer-events-auto mb-14 flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={handleStartFromButton}
                      className="h-12 px-7 rounded-xl bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-slate-950 font-display text-lg font-bold shadow-[0_4px_0_#B45309] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Bắt đầu chơi
                    </button>
                  </div>
                </div>
              )}

              {/* PAUSED OVERLAY */}
              {gameState === 'PAUSED' && (
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px] flex items-center justify-center p-6">
                  <div className="w-full max-w-[300px] bg-white rounded-2xl p-6 shadow-xl border border-slate-200 text-center">
                    <h2 className="font-display text-2xl font-bold text-slate-900">
                      Tạm dừng
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Điểm hiện tại:{' '}
                      <span className="font-mono-nums font-bold text-slate-900">{score}</span>
                    </p>

                    <div className="mt-6 flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={handleTogglePause}
                        className="w-full h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 whitespace-nowrap cursor-pointer"
                      >
                        Tiếp tục chơi
                      </button>
                      <button
                        type="button"
                        onClick={handleRestartToReady}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 whitespace-nowrap cursor-pointer"
                      >
                        Về màn hình chính
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* GAME OVER SCORECARD OVERLAY */}
              {gameState === 'GAME_OVER' && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center p-5">
                  <div className="w-full max-w-[320px] bg-[#FFFDF7] rounded-2xl p-6 shadow-2xl border-2 border-slate-800/90 text-slate-900">
                    <div className="text-center">
                      <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
                        Kết thúc lượt bay
                      </h2>
                      {isNewRecord ? (
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          Kỷ lục mới ở chế độ {DIFFICULTY_CONFIGS[difficulty].label}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          Chế độ {DIFFICULTY_CONFIGS[difficulty].label}
                        </p>
                      )}
                    </div>

                    {/* Score & Medal Grid */}
                    <div className="mt-5 grid grid-cols-2 gap-4 py-4 border-y border-slate-200/90">
                      <div className="flex flex-col items-center justify-center border-r border-slate-200/90 pr-2">
                        <span className="text-xs font-medium text-slate-500">Huy chương</span>
                        {medal ? (
                          <div className="mt-2 flex flex-col items-center">
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center border-2 shadow-sm"
                              style={{
                                backgroundColor: medal.fill,
                                borderColor: medal.rim,
                                color: medal.textColor,
                              }}
                            >
                              <Award className="w-5 h-5" />
                            </div>
                            <span className="mt-1.5 text-xs font-semibold text-slate-800">
                              {medal.name}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-col items-center">
                            <div className="w-11 h-11 rounded-full border border-dashed border-slate-300 bg-slate-100/70 flex items-center justify-center text-slate-400">
                              <Award className="w-5 h-5" />
                            </div>
                            <span className="mt-1.5 text-xs text-slate-400">Chưa đạt</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-center gap-3 pl-2">
                        <div>
                          <div className="text-xs font-medium text-slate-500">Điểm số</div>
                          <div className="font-mono-nums text-2xl font-bold text-slate-900 leading-tight">
                            {score}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500">Kỷ lục</div>
                          <div className="font-mono-nums text-xl font-bold text-amber-600 leading-tight">
                            {currentBest}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleStartFromButton}
                        className="w-full h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-slate-950 font-display text-base font-bold shadow-[0_3px_0_#B45309] inline-flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Chơi lại</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRestartToReady}
                        className="w-full h-10 px-4 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 whitespace-nowrap cursor-pointer"
                      >
                        Đổi cài đặt
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Clean Side Control & Scoreboard Panel */}
          <aside className="w-full max-w-[440px] mx-auto lg:max-w-none bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-6">
            {/* Score Summary */}
            <div className="flex items-baseline justify-between border-b border-slate-100 pb-5">
              <div>
                <div className="text-xs font-medium text-slate-500">Điểm lượt này</div>
                <div className="font-mono-nums text-3xl font-bold text-slate-900 mt-0.5">
                  {score}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-slate-500">
                  Kỷ lục ({DIFFICULTY_CONFIGS[difficulty].label})
                </div>
                <div className="font-mono-nums text-2xl font-bold text-amber-600 mt-0.5">
                  {currentBest}
                </div>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <div className="text-sm font-semibold text-slate-800 mb-2.5">Độ khó</div>
              <div
                role="group"
                aria-label="Chọn độ khó"
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
              >
                {(Object.keys(DIFFICULTY_CONFIGS) as Difficulty[]).map((diffKey) => {
                  const cfg = DIFFICULTY_CONFIGS[diffKey];
                  const active = difficulty === diffKey;
                  return (
                    <button
                      key={diffKey}
                      type="button"
                      onClick={() => handleSelectDifficulty(diffKey)}
                      className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {difficulty === 'easy' && 'Khoảng trống rộng và tốc độ vừa phải.'}
                {difficulty === 'normal' && 'Nhịp bay cân bằng theo phong cách cổ điển.'}
                {difficulty === 'hard' && 'Ống nước hẹp hơn và tốc độ bay nhanh.'}
              </p>
            </div>

            {/* Sky Theme Selector */}
            <div>
              <div className="text-sm font-semibold text-slate-800 mb-2.5">Khung cảnh</div>
              <div
                role="group"
                aria-label="Chọn khung cảnh"
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
              >
                {(Object.keys(SKY_PALETTES) as SkyTheme[]).map((themeKey) => {
                  const palette = SKY_PALETTES[themeKey];
                  const active = skyTheme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => handleSelectSkyTheme(themeKey)}
                      className={`h-9 px-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {palette.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Medals & Controls Guide */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1.5">Mốc huy chương</div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-mono-nums">
                  <span>Đồng 10+</span>
                  <span aria-hidden="true">·</span>
                  <span>Bạc 20+</span>
                  <span aria-hidden="true">·</span>
                  <span>Vàng 30+</span>
                  <span aria-hidden="true">·</span>
                  <span>Bạch Kim 50+</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1.5">Phím tắt</div>
                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Vỗ cánh</span>
                    <span className="font-mono-nums text-slate-700">Space / ↑ / Click</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tạm dừng</span>
                    <span className="font-mono-nums text-slate-700">P / Esc</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tắt / bật tiếng</span>
                    <span className="font-mono-nums text-slate-700">M</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
