import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import {
  DIFFICULTY_CONFIGS,
  Difficulty,
  GameState,
  Particle,
  Pipe,
  SKY_PALETTES,
  SkyTheme,
} from '../types/game';
import { soundEngine } from '../utils/sound';

export const CANVAS_WIDTH = 440;
export const CANVAS_HEIGHT = 620;
const GROUND_HEIGHT = 96;
const PLAYABLE_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;
const BIRD_X = 124;
const BIRD_RADIUS = 16;
const HITBOX_RADIUS = 13;
const PIPE_WIDTH = 64;
const PIPE_CAP_HEIGHT = 26;
const PIPE_CAP_OVERHANG = 5;

export interface FlappyCanvasHandle {
  flap: () => void;
  resetBoard: () => void;
}

interface FlappyCanvasProps {
  gameState: GameState;
  difficulty: Difficulty;
  skyTheme: SkyTheme;
  onStartPlay: () => void;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speedFactor: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
}

const INITIAL_CLOUDS: Cloud[] = [
  { x: 55, y: 88, scale: 0.9, speedFactor: 0.14 },
  { x: 210, y: 138, scale: 0.72, speedFactor: 0.1 },
  { x: 365, y: 74, scale: 1.05, speedFactor: 0.18 },
];

const STARS: Star[] = Array.from({ length: 28 }, (_, i) => ({
  x: ((i * 73) % (CANVAS_WIDTH - 20)) + 10,
  y: ((i * 47) % (PLAYABLE_HEIGHT - 160)) + 16,
  size: (i % 3) + 1.2,
  phase: i * 0.9,
}));

export const FlappyCanvas = forwardRef<FlappyCanvasHandle, FlappyCanvasProps>(
  function FlappyCanvas(
    { gameState, difficulty, skyTheme, onStartPlay, onScoreChange, onGameOver },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Mutable simulation state held in refs for 60/120fps delta-time loop
    const simRef = useRef({
      birdY: PLAYABLE_HEIGHT * 0.44,
      birdVy: 0,
      birdRotation: 0,
      wingPhase: 0,
      flapBoost: 0,
      pipes: [] as Pipe[],
      particles: [] as Particle[],
      clouds: INITIAL_CLOUDS.map((c) => ({ ...c })),
      groundOffset: 0,
      cityOffset: 0,
      hillOffset: 0,
      spawnTimer: 0.5,
      score: 0,
      nextPipeId: 1,
      flashAlpha: 0,
      shakeTimer: 0,
      idleTime: 0,
      isDead: false,
    });

    const propsRef = useRef({
      gameState,
      difficulty,
      skyTheme,
      onStartPlay,
      onScoreChange,
      onGameOver,
    });

    useEffect(() => {
      propsRef.current = {
        gameState,
        difficulty,
        skyTheme,
        onStartPlay,
        onScoreChange,
        onGameOver,
      };
    }, [gameState, difficulty, skyTheme, onStartPlay, onScoreChange, onGameOver]);

    const spawnFlapParticles = (y: number) => {
      const sim = simRef.current;
      for (let i = 0; i < 5; i++) {
        sim.particles.push({
          x: BIRD_X - 10 + (Math.random() - 0.5) * 8,
          y: y + 6 + (Math.random() - 0.5) * 6,
          vx: -40 - Math.random() * 55,
          vy: 30 + Math.random() * 60,
          radius: 2.5 + Math.random() * 2.5,
          alpha: 0.85,
          color: '#FFFFFF',
          life: 0,
          maxLife: 0.34 + Math.random() * 0.14,
        });
      }
    };

    const spawnScoreParticles = (x: number, y: number) => {
      const sim = simRef.current;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
        const speed = 55 + Math.random() * 65;
        sim.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2.5 + Math.random() * 2,
          alpha: 1,
          color: i % 2 === 0 ? '#FACC15' : '#FFFFFF',
          life: 0,
          maxLife: 0.45,
        });
      }
    };

    const resetSimulation = () => {
      const sim = simRef.current;
      sim.birdY = PLAYABLE_HEIGHT * 0.44;
      sim.birdVy = 0;
      sim.birdRotation = 0;
      sim.wingPhase = 0;
      sim.flapBoost = 0;
      sim.pipes = [];
      sim.particles = [];
      sim.spawnTimer = 0.35;
      sim.score = 0;
      sim.flashAlpha = 0;
      sim.shakeTimer = 0;
      sim.isDead = false;
    };

    const performFlap = () => {
      const { gameState: state, difficulty: diff, onStartPlay: startPlay } = propsRef.current;
      const cfg = DIFFICULTY_CONFIGS[diff];
      const sim = simRef.current;

      if (state === 'TITLE_MENU') {
        resetSimulation();
        sim.birdVy = cfg.flapVelocity;
        sim.flapBoost = 1;
        spawnFlapParticles(sim.birdY);
        soundEngine.playFlap();
        startPlay();
        return;
      }

      if (state === 'PLAYING' && !sim.isDead) {
        sim.birdVy = cfg.flapVelocity;
        sim.flapBoost = 1;
        spawnFlapParticles(sim.birdY);
        soundEngine.playFlap();
      }
    };

    useImperativeHandle(ref, () => ({
      flap: performFlap,
      resetBoard: () => {
        resetSimulation();
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;

      let animationFrameId = 0;
      let lastTime = performance.now();

      const spawnPipe = () => {
        const sim = simRef.current;
        const cfg = DIFFICULTY_CONFIGS[propsRef.current.difficulty];
        const minCenter = 74 + cfg.pipeGap / 2;
        const maxCenter = PLAYABLE_HEIGHT - 74 - cfg.pipeGap / 2;
        const gapY = minCenter + Math.random() * (maxCenter - minCenter);

        sim.pipes.push({
          id: sim.nextPipeId++,
          x: CANVAS_WIDTH + 20,
          gapY,
          gapHeight: cfg.pipeGap,
          passed: false,
        });
      };

      const checkCollision = (birdY: number, pipe: Pipe): boolean => {
        const halfGap = pipe.gapHeight / 2;
        const topPipeBottom = pipe.gapY - halfGap;
        const bottomPipeTop = pipe.gapY + halfGap;

        // Circle-to-AABB collision against upper and lower pipes
        const closestX = Math.max(pipe.x, Math.min(BIRD_X, pipe.x + PIPE_WIDTH));

        // Top pipe rect: [pipe.x, 0, PIPE_WIDTH, topPipeBottom]
        const closestTopY = Math.min(birdY, topPipeBottom);
        const dxTop = BIRD_X - closestX;
        const dyTop = birdY - closestTopY;
        if (dxTop * dxTop + dyTop * dyTop < HITBOX_RADIUS * HITBOX_RADIUS) {
          return true;
        }

        // Bottom pipe rect: [pipe.x, bottomPipeTop, PIPE_WIDTH, PLAYABLE_HEIGHT - bottomPipeTop]
        const closestBottomY = Math.max(birdY, bottomPipeTop);
        const dxBottom = BIRD_X - closestX;
        const dyBottom = birdY - closestBottomY;
        if (dxBottom * dxBottom + dyBottom * dyBottom < HITBOX_RADIUS * HITBOX_RADIUS) {
          return true;
        }

        return false;
      };

      const triggerCrash = () => {
        const sim = simRef.current;
        if (sim.isDead) return;
        sim.isDead = true;
        sim.flashAlpha = 0.65;
        sim.shakeTimer = 0.22;
        soundEngine.playHit();
        propsRef.current.onGameOver(sim.score);
      };

      const update = (dt: number) => {
        const { gameState: state, difficulty: diff, onScoreChange: notifyScore } = propsRef.current;
        const cfg = DIFFICULTY_CONFIGS[diff];
        const sim = simRef.current;

        sim.idleTime += dt;
        if (sim.flashAlpha > 0) {
          sim.flashAlpha = Math.max(0, sim.flashAlpha - dt * 2.6);
        }
        if (sim.shakeTimer > 0) {
          sim.shakeTimer = Math.max(0, sim.shakeTimer - dt);
        }

        // Update particles even after hit
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const p = sim.particles[i];
          p.life += dt;
          if (p.life >= p.maxLife) {
            sim.particles.splice(i, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha = 1 - p.life / p.maxLife;
        }

        if (state === 'PAUSED') {
          return;
        }

        if (state === 'TITLE_MENU') {
          // Gentle bobbing hover & scrolling scenery
          sim.birdY = PLAYABLE_HEIGHT * 0.43 + Math.sin(sim.idleTime * 3.8) * 8;
          sim.birdRotation = Math.sin(sim.idleTime * 3.8) * 0.06;
          sim.wingPhase += dt * 10;

          const idleSpeed = cfg.pipeSpeed * 0.45;
          sim.groundOffset = (sim.groundOffset + idleSpeed * dt) % 28;
          sim.cityOffset = (sim.cityOffset + idleSpeed * 0.18 * dt) % 160;
          sim.hillOffset = (sim.hillOffset + idleSpeed * 0.32 * dt) % 220;

          sim.clouds.forEach((c) => {
            c.x -= idleSpeed * c.speedFactor * dt;
            if (c.x < -80) c.x = CANVAS_WIDTH + 70;
          });
          return;
        }

        if (state === 'PLAYING') {
          // Parallax scroll
          sim.groundOffset = (sim.groundOffset + cfg.pipeSpeed * dt) % 28;
          sim.cityOffset = (sim.cityOffset + cfg.pipeSpeed * 0.16 * dt) % 160;
          sim.hillOffset = (sim.hillOffset + cfg.pipeSpeed * 0.3 * dt) % 220;

          sim.clouds.forEach((c) => {
            c.x -= cfg.pipeSpeed * c.speedFactor * dt;
            if (c.x < -80) c.x = CANVAS_WIDTH + 70;
          });

          // Bird physics
          sim.birdVy = Math.min(sim.birdVy + cfg.gravity * dt, 640);
          sim.birdY += sim.birdVy * dt;

          // Smooth pitch rotation
          if (sim.birdVy < 0) {
            const targetUp = -0.44;
            sim.birdRotation += (targetUp - sim.birdRotation) * Math.min(1, dt * 16);
          } else {
            const fallProgress = Math.min(1, Math.max(0, (sim.birdVy - 60) / 480));
            const targetDown = -0.44 + fallProgress * (Math.PI / 2 + 0.36);
            sim.birdRotation += (targetDown - sim.birdRotation) * Math.min(1, dt * 7);
          }

          sim.flapBoost = Math.max(0, sim.flapBoost - dt * 4);
          sim.wingPhase += dt * (11 + sim.flapBoost * 12);

          // Ceiling clamp (prevent flying over pipes off-screen)
          if (sim.birdY < BIRD_RADIUS + 4) {
            sim.birdY = BIRD_RADIUS + 4;
            if (sim.birdVy < 0) sim.birdVy = 0;
          }

          // Ground collision
          if (sim.birdY + HITBOX_RADIUS >= PLAYABLE_HEIGHT) {
            sim.birdY = PLAYABLE_HEIGHT - HITBOX_RADIUS;
            triggerCrash();
            return;
          }

          // Pipe spawning
          sim.spawnTimer -= dt;
          if (sim.spawnTimer <= 0) {
            spawnPipe();
            sim.spawnTimer = cfg.spawnInterval;
          }

          // Move pipes, score & collision check
          for (let i = sim.pipes.length - 1; i >= 0; i--) {
            const pipe = sim.pipes[i];
            pipe.x -= cfg.pipeSpeed * dt;

            if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < BIRD_X) {
              pipe.passed = true;
              sim.score += 1;
              notifyScore(sim.score);
              soundEngine.playScore();
              spawnScoreParticles(BIRD_X, sim.birdY - 22);
            }

            if (checkCollision(sim.birdY, pipe)) {
              triggerCrash();
              return;
            }

            if (pipe.x + PIPE_WIDTH + 20 < 0) {
              sim.pipes.splice(i, 1);
            }
          }
        }

        if (state === 'GAME_OVER') {
          // Let bird fall gently until resting on the ground
          if (sim.birdY + BIRD_RADIUS < PLAYABLE_HEIGHT) {
            sim.birdVy = Math.min(sim.birdVy + cfg.gravity * dt, 700);
            sim.birdY = Math.min(PLAYABLE_HEIGHT - BIRD_RADIUS, sim.birdY + sim.birdVy * dt);
            sim.birdRotation = Math.min(Math.PI / 2, sim.birdRotation + dt * 6.5);
          }
        }
      };

      const drawCloud = (x: number, y: number, scale: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.arc(20, -6, 24, 0, Math.PI * 2);
        ctx.arc(42, 0, 18, 0, Math.PI * 2);
        ctx.arc(20, 8, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      const drawPipe = (
        x: number,
        y: number,
        w: number,
        h: number,
        capAtBottom: boolean,
        palette: (typeof SKY_PALETTES)[SkyTheme]
      ) => {
        if (h <= 0) return;

        // Pipe shaft
        ctx.fillStyle = palette.pipeBody;
        ctx.fillRect(x, y, w, h);

        // Specular highlight & shadow stripes
        ctx.fillStyle = palette.pipeHighlight;
        ctx.fillRect(x + 6, y, 10, h);
        ctx.fillRect(x + 20, y, 4, h);

        ctx.fillStyle = palette.pipeShadow;
        ctx.fillRect(x + w - 12, y, 12, h);

        ctx.strokeStyle = palette.pipeOutline;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, w, h);

        // Overhanging cap
        const capX = x - PIPE_CAP_OVERHANG;
        const capW = w + PIPE_CAP_OVERHANG * 2;
        const capY = capAtBottom ? y + h - PIPE_CAP_HEIGHT : y;

        ctx.fillStyle = palette.pipeBody;
        ctx.fillRect(capX, capY, capW, PIPE_CAP_HEIGHT);

        ctx.fillStyle = palette.pipeHighlight;
        ctx.fillRect(capX + 6, capY + 2, 12, PIPE_CAP_HEIGHT - 4);

        ctx.fillStyle = palette.pipeShadow;
        ctx.fillRect(capX + capW - 14, capY + 2, 14, PIPE_CAP_HEIGHT - 4);

        ctx.strokeStyle = palette.pipeOutline;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(capX, capY, capW, PIPE_CAP_HEIGHT);
      };

      const drawBird = (y: number, rotation: number, wingPhase: number, isDead: boolean) => {
        ctx.save();
        ctx.translate(BIRD_X, y);
        ctx.rotate(rotation);

        // Subtle drop shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
        ctx.beginPath();
        ctx.ellipse(1, 3, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 17.5, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Warm golden top highlight
        ctx.fillStyle = '#FCD34D';
        ctx.beginPath();
        ctx.ellipse(-2, -4.5, 11.5, 6.5, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Belly shading
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.ellipse(-1, 6, 11, 5.5, 0, 0, Math.PI);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(7, -3.5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isDead) {
          // X eye on crash
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(5, -5.5);
          ctx.lineTo(9.5, -1.5);
          ctx.moveTo(9.5, -5.5);
          ctx.lineTo(5, -1.5);
          ctx.stroke();
        } else {
          // Crisp pupil + catchlight
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(8.8, -3.5, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(9.6, -4.6, 1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Two-part coral beak
        ctx.fillStyle = '#EA580C';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(23, 0, 23, 3.8);
        ctx.lineTo(12, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#C2410C';
        ctx.beginPath();
        ctx.moveTo(12, 4.5);
        ctx.lineTo(21.5, 4.5);
        ctx.quadraticCurveTo(20, 8.5, 12, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Animated wing
        const wingOffset = Math.sin(wingPhase) * 4.5;
        ctx.fillStyle = '#FFFBEB';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(-5, 1.5 + wingOffset * 0.45, 9, 6, -0.2 + wingOffset * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      };

      const render = () => {
        const sim = simRef.current;
        const { gameState: state, skyTheme: theme } = propsRef.current;
        const palette = SKY_PALETTES[theme];

        ctx.save();
        ctx.scale(dpr, dpr);

        // Micro screen shake on collision
        if (sim.shakeTimer > 0) {
          const intensity = (sim.shakeTimer / 0.22) * 5;
          ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
        }

        // 1. Sky Gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_HEIGHT);
        skyGrad.addColorStop(0, palette.skyTop);
        skyGrad.addColorStop(1, palette.skyBottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, PLAYABLE_HEIGHT);

        // Stars at night
        if (palette.starsVisible) {
          STARS.forEach((star) => {
            const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(sim.idleTime * 1.8 + star.phase));
            ctx.fillStyle = `rgba(255, 255, 240, ${twinkle.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
          });
          // Crescent / glowing moon
          ctx.fillStyle = 'rgba(254, 249, 195, 0.92)';
          ctx.beginPath();
          ctx.arc(360, 82, 22, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme === 'sunset') {
          // Warm low sun
          ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
          ctx.beginPath();
          ctx.arc(340, 290, 48, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(254, 249, 195, 0.85)';
          ctx.beginPath();
          ctx.arc(340, 290, 32, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Crisp daytime sun glow
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.arc(360, 80, 34, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Clouds
        sim.clouds.forEach((cloud) => {
          drawCloud(cloud.x, cloud.y, cloud.scale, palette.cloudColor);
        });

        // 3. Distant City Silhouette
        const buildings = [
          { w: 38, h: 92 },
          { w: 28, h: 66 },
          { w: 46, h: 112 },
          { w: 32, h: 76 },
          { w: 16, h: 52 },
        ];
        for (let rep = -1; rep < 4; rep++) {
          let bx = rep * 160 - sim.cityOffset;
          buildings.forEach((b) => {
            ctx.fillStyle = palette.cityFar;
            ctx.fillRect(bx, PLAYABLE_HEIGHT - b.h - 24, b.w, b.h + 24);
            ctx.fillStyle = palette.cityNear;
            ctx.fillRect(bx + 4, PLAYABLE_HEIGHT - b.h + 10, b.w - 8, b.h);
            bx += b.w;
          });
        }

        // 4. Rolling Foreground Hills
        ctx.fillStyle = palette.hillColor;
        for (let rep = -1; rep < 4; rep++) {
          const hx = rep * 220 - sim.hillOffset;
          ctx.beginPath();
          ctx.arc(hx + 55, PLAYABLE_HEIGHT + 12, 68, Math.PI, 0);
          ctx.arc(hx + 165, PLAYABLE_HEIGHT + 18, 82, Math.PI, 0);
          ctx.fill();
        }

        // 5. Pipes
        sim.pipes.forEach((pipe) => {
          const halfGap = pipe.gapHeight / 2;
          const topHeight = pipe.gapY - halfGap;
          const bottomY = pipe.gapY + halfGap;
          const bottomHeight = PLAYABLE_HEIGHT - bottomY;

          drawPipe(pipe.x, -4, PIPE_WIDTH, topHeight + 4, true, palette);
          drawPipe(pipe.x, bottomY, PIPE_WIDTH, bottomHeight + 4, false, palette);
        });

        // 6. Particles
        sim.particles.forEach((p) => {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // 7. Ground Strip & Scrolling Diagonal Grass
        ctx.fillStyle = palette.groundEarth;
        ctx.fillRect(0, PLAYABLE_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

        // Grass band
        const grassBandHeight = 20;
        ctx.fillStyle = palette.groundTop;
        ctx.fillRect(0, PLAYABLE_HEIGHT, CANVAS_WIDTH, grassBandHeight);

        // Diagonal scrolling stripes on grass
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, PLAYABLE_HEIGHT, CANVAS_WIDTH, grassBandHeight);
        ctx.clip();
        ctx.fillStyle = palette.groundStripe;
        for (let gx = -56; gx < CANVAS_WIDTH + 56; gx += 28) {
          const startX = gx - sim.groundOffset;
          ctx.beginPath();
          ctx.moveTo(startX, PLAYABLE_HEIGHT + grassBandHeight);
          ctx.lineTo(startX + 12, PLAYABLE_HEIGHT);
          ctx.lineTo(startX + 24, PLAYABLE_HEIGHT);
          ctx.lineTo(startX + 12, PLAYABLE_HEIGHT + grassBandHeight);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Crisp ground borders
        ctx.fillStyle = palette.pipeOutline;
        ctx.fillRect(0, PLAYABLE_HEIGHT, CANVAS_WIDTH, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(0, PLAYABLE_HEIGHT + grassBandHeight, CANVAS_WIDTH, 3);

        // 8. Bird
        drawBird(sim.birdY, sim.birdRotation, sim.wingPhase, sim.isDead);

        // 9. Live In-Game Score Counter (crisp outlined display text)
        if (state === 'PLAYING' || state === 'PAUSED') {
          const scoreText = String(sim.score);
          ctx.save();
          ctx.font = '800 44px "Bricolage Grotesque", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.strokeText(scoreText, CANVAS_WIDTH / 2, 26);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(scoreText, CANVAS_WIDTH / 2, 26);
          ctx.restore();
        }

        // 10. Hit Flash Overlay
        if (sim.flashAlpha > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${sim.flashAlpha.toFixed(2)})`;
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        ctx.restore();
      };

      const loop = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        update(dt);
        render();
        animationFrameId = requestAnimationFrame(loop);
      };

      animationFrameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationFrameId);
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Only primary mouse button or touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (gameState === 'PLAYING' || gameState === 'TITLE_MENU') {
        performFlap();
      }
    };

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        aria-label="Sân chơi Vỗ Cánh"
        className="block w-full h-full cursor-pointer select-none touch-none"
      />
    );
  }
);
