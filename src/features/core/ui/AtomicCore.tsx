import { useEffect, useRef } from 'react';
import { t } from '../../../shared/i18n';
import { Language } from '../../../core/types';

interface AtomicCoreProps {
  reducedMotion: boolean;
  language: Language;
}

interface Particle {
  angle: number;
  radius: number;
  jitterSeed: number;
  proton: boolean;
}

interface ElectronOrbit {
  radius: number;
  speed: number;
  phase: number;
}

interface Point {
  x: number;
  y: number;
}

interface SparkSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface SparkEvent {
  until: number;
  segments: SparkSegment[];
}

const MIN_SIZE = 180;
const MAX_SIZE = 280;
const BASE_SIZE = 180;

const particles: Particle[] = Array.from({ length: 11 }, (_, index) => ({
  angle: (Math.PI * 2 * index) / 11,
  radius: 10 + (index % 4) * 4,
  jitterSeed: index * 0.37,
  proton: index % 2 === 0
}));

const orbits: ElectronOrbit[] = [
  { radius: 44, speed: 0.0009, phase: 0 },
  { radius: 58, speed: 0.0007, phase: 1.6 },
  { radius: 72, speed: 0.00055, phase: 3.2 }
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function AtomicCore({ reducedMotion, language }: AtomicCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const hasRequiredApi = typeof ctx.save === 'function'
      && typeof ctx.restore === 'function'
      && typeof ctx.ellipse === 'function';
    if (!hasRequiredApi) return;

    let rafId: number | null = null;
    let cssSize = MIN_SIZE;
    let dpr = window.devicePixelRatio || 1;
    let nextSparkAt = performance.now() + 2000 + Math.random() * 3000;
    let sparkEvent: SparkEvent | null = null;
    const trails: Point[][] = orbits.map(() => []);
    const starfield = Array.from({ length: 9 }, (_, index) => ({
      angle: (Math.PI * 2 * index) / 9,
      radius: 22 + ((index * 17) % 54),
      twinkleSeed: index * 1.31
    }));

    const setupCanvas = () => {
      const nextDpr = window.devicePixelRatio || 1;
      const containerWidth = wrapper.getBoundingClientRect().width;
      const nextCssSize = clamp(Math.floor(Math.min(containerWidth || MAX_SIZE, MAX_SIZE)), MIN_SIZE, MAX_SIZE);
      if (nextCssSize === cssSize && nextDpr === dpr) {
        return false;
      }

      cssSize = nextCssSize;
      dpr = nextDpr;
      canvas.width = Math.floor(cssSize * dpr);
      canvas.height = Math.floor(cssSize * dpr);
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const spawnSpark = (now: number, cx: number, cy: number, scale: number) => {
      const segments: SparkSegment[] = [];
      const count = 2 + Math.floor(Math.random() * 3);
      let currentAngle = Math.random() * Math.PI * 2;
      let currentRadius = (24 + Math.random() * 16) * scale;
      let x = cx + Math.cos(currentAngle) * currentRadius;
      let y = cy + Math.sin(currentAngle) * currentRadius;

      for (let index = 0; index < count; index += 1) {
        currentAngle += (Math.random() - 0.5) * 1.1;
        currentRadius += (Math.random() - 0.2) * 10 * scale;
        const nx = x + Math.cos(currentAngle) * (12 + Math.random() * 12) * scale;
        const ny = y + Math.sin(currentAngle) * (8 + Math.random() * 10) * scale;
        segments.push({ x1: x, y1: y, x2: nx, y2: ny });
        x = nx;
        y = ny;
      }

      sparkEvent = {
        until: now + 120 + Math.random() * 130,
        segments
      };
      nextSparkAt = now + 2000 + Math.random() * 3000;
    };

    const canUseRadialGradient = typeof ctx.createRadialGradient === 'function';

    const drawFrame = (now: number) => {
      const scale = cssSize / BASE_SIZE;
      const cx = cssSize / 2;
      const cy = cssSize / 2;
      const electronRadius = 3.1 * scale;
      const trailLength = clamp(6 + Math.floor((cssSize - MIN_SIZE) / 18), 6, 10);

      ctx.clearRect(0, 0, cssSize, cssSize);

      ctx.fillStyle = 'rgba(197,216,255,0.06)';
      starfield.forEach((star) => {
        const twinkle = reducedMotion ? 0 : Math.sin(now * 0.00065 + star.twinkleSeed) * 0.5 + 0.5;
        const sr = 0.8 + twinkle * 0.5;
        const x = cx + Math.cos(star.angle + (reducedMotion ? 0 : now * 0.00003)) * star.radius * scale;
        const y = cy + Math.sin(star.angle + (reducedMotion ? 0 : now * 0.00002)) * star.radius * scale * 0.8;
        ctx.globalAlpha = 0.2 + twinkle * 0.28;
        ctx.beginPath();
        ctx.arc(x, y, sr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      orbits.forEach((orbit, index) => {
        const orbitRadius = orbit.radius * scale;
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(131,166,236,0.2)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbitRadius, orbitRadius * 0.6, Math.PI / 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(174,205,255,0.48)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbitRadius, orbitRadius * 0.6, Math.PI / 9, 0, Math.PI * 2);
        ctx.stroke();

        const angle = orbit.phase + now * orbit.speed;
        const ex = cx + Math.cos(angle) * orbitRadius;
        const ey = cy + Math.sin(angle) * orbitRadius * 0.6;

        const trail = trails[index];
        if (reducedMotion) {
          trail.length = 0;
        } else {
          trail.unshift({ x: ex, y: ey });
          if (trail.length > trailLength) {
            trail.length = trailLength;
          }
        }

        trail.forEach((point, trailIndex) => {
          const progress = 1 - trailIndex / Math.max(1, trail.length);
          ctx.fillStyle = 'rgba(167,204,255,1)';
          ctx.globalAlpha = progress * 0.26;
          ctx.beginPath();
          ctx.arc(point.x, point.y, electronRadius * (0.5 + progress * 0.5), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#deeeff';
        ctx.beginPath();
        ctx.arc(ex, ey, electronRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      particles.forEach((particle) => {
        const jitterX = reducedMotion ? 0 : Math.sin(now * 0.004 + particle.jitterSeed) * 1.15 * scale;
        const jitterY = reducedMotion ? 0 : Math.cos(now * 0.005 + particle.jitterSeed) * 1.15 * scale;
        const px = cx + Math.cos(particle.angle) * particle.radius * scale + jitterX;
        const py = cy + Math.sin(particle.angle) * (particle.radius * 0.92 * scale) + jitterY;
        ctx.fillStyle = particle.proton ? '#ff927f' : '#c4d3ff';
        ctx.beginPath();
        ctx.arc(px, py, 3.6 * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      if (canUseRadialGradient) {
        const coreGradient = ctx.createRadialGradient(cx - 4 * scale, cy - 5 * scale, 3 * scale, cx, cy, 22 * scale);
        coreGradient.addColorStop(0, 'rgba(255,251,224,0.95)');
        coreGradient.addColorStop(0.45, 'rgba(255,176,112,0.7)');
        coreGradient.addColorStop(1, 'rgba(255,130,81,0.2)');
        ctx.fillStyle = coreGradient;
      } else {
        ctx.fillStyle = 'rgba(255,176,112,0.75)';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 15 * scale, 0, Math.PI * 2);
      ctx.fill();

      if (!reducedMotion && now > nextSparkAt && !sparkEvent) {
        spawnSpark(now, cx, cy, scale);
      }

      if (sparkEvent && now > sparkEvent.until) {
        sparkEvent = null;
      }

      if (sparkEvent) {
        ctx.strokeStyle = 'rgba(121,224,255,0.8)';
        ctx.lineWidth = 1.3 * scale;
        sparkEvent.segments.forEach((segment) => {
          ctx.beginPath();
          ctx.moveTo(segment.x1, segment.y1);
          ctx.lineTo(segment.x2, segment.y2);
          ctx.stroke();
        });
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      if (canUseRadialGradient) {
        const coreGlow = ctx.createRadialGradient(cx, cy, 5 * scale, cx, cy, 28 * scale);
        coreGlow.addColorStop(0, 'rgba(255,178,103,0.46)');
        coreGlow.addColorStop(1, 'rgba(255,178,103,0)');
        ctx.fillStyle = coreGlow;
      } else {
        ctx.fillStyle = 'rgba(255,178,103,0.25)';
      }
      ctx.shadowColor = 'rgba(255,180,116,0.75)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * scale, 0, Math.PI * 2);
      ctx.fill();

      orbits.forEach((orbit) => {
        const orbitRadius = orbit.radius * scale;
        const angle = orbit.phase + now * orbit.speed;
        const ex = cx + Math.cos(angle) * orbitRadius;
        const ey = cy + Math.sin(angle) * orbitRadius * 0.6;
        ctx.fillStyle = 'rgba(182,221,255,0.38)';
        ctx.shadowColor = 'rgba(132,193,255,0.88)';
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.arc(ex, ey, electronRadius * 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      particles.forEach((particle) => {
        const jitterX = reducedMotion ? 0 : Math.sin(now * 0.004 + particle.jitterSeed) * 1.15 * scale;
        const jitterY = reducedMotion ? 0 : Math.cos(now * 0.005 + particle.jitterSeed) * 1.15 * scale;
        const px = cx + Math.cos(particle.angle) * particle.radius * scale + jitterX;
        const py = cy + Math.sin(particle.angle) * (particle.radius * 0.92 * scale) + jitterY;
        ctx.fillStyle = particle.proton ? 'rgba(255,147,123,0.36)' : 'rgba(196,216,255,0.34)';
        ctx.shadowColor = particle.proton ? 'rgba(255,147,123,0.72)' : 'rgba(180,212,255,0.7)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(px, py, 3.8 * scale, 0, Math.PI * 2);
        ctx.fill();
      });

      if (sparkEvent) {
        ctx.strokeStyle = 'rgba(130,235,255,0.95)';
        ctx.lineWidth = 1.5 * scale;
        ctx.shadowColor = 'rgba(130,235,255,0.92)';
        ctx.shadowBlur = 8;
        sparkEvent.segments.forEach((segment) => {
          ctx.beginPath();
          ctx.moveTo(segment.x1, segment.y1);
          ctx.lineTo(segment.x2, segment.y2);
          ctx.stroke();
        });
      }

      ctx.restore();
      ctx.shadowBlur = 0;

      if (!reducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    const redraw = () => {
      setupCanvas();
      drawFrame(performance.now());
    };

    setupCanvas();
    drawFrame(performance.now());

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        redraw();
      })
      : null;

    if (resizeObserver) {
      resizeObserver.observe(wrapper);
    }

    const onWindowResize = () => {
      redraw();
    };

    window.addEventListener('resize', onWindowResize);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [reducedMotion]);

  return (
    <div ref={wrapperRef} className="atomic-core-canvas-shell">
      <canvas ref={canvasRef} aria-label={t('chaosCoreVisualization', language)} role="img" />
    </div>
  );
}
