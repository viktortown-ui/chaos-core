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

export function AtomicCore({ reducedMotion, language }: AtomicCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 180;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let rafId: number | null = null;
    let sparkUntil = 0;
    let nextSparkAt = performance.now() + 2000 + Math.random() * 3000;

    const draw = (now: number) => {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;

      orbits.forEach((orbit) => {
        ctx.strokeStyle = 'rgba(139,174,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbit.radius, orbit.radius * 0.6, Math.PI / 9, 0, Math.PI * 2);
        ctx.stroke();

        const angle = orbit.phase + now * orbit.speed;
        const ex = cx + Math.cos(angle) * orbit.radius;
        const ey = cy + Math.sin(angle) * orbit.radius * 0.6;
        ctx.fillStyle = '#d9ebff';
        ctx.shadowColor = '#9ec8ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      particles.forEach((particle) => {
        const jitterX = reducedMotion ? 0 : Math.sin(now * 0.004 + particle.jitterSeed) * 1.6;
        const jitterY = reducedMotion ? 0 : Math.cos(now * 0.005 + particle.jitterSeed) * 1.6;
        const px = cx + Math.cos(particle.angle) * particle.radius + jitterX;
        const py = cy + Math.sin(particle.angle) * (particle.radius * 0.9) + jitterY;
        ctx.fillStyle = particle.proton ? '#ff8b7a' : '#b7c9ff';
        ctx.shadowColor = particle.proton ? 'rgba(255,139,122,0.6)' : 'rgba(183,201,255,0.6)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      if (now > nextSparkAt && now > sparkUntil) {
        sparkUntil = now + 150 + Math.random() * 150;
        nextSparkAt = now + 2000 + Math.random() * 3000;
      }

      if (now < sparkUntil) {
        const startAngle = Math.random() * Math.PI * 2;
        const startRadius = 24 + Math.random() * 18;
        const x1 = cx + Math.cos(startAngle) * startRadius;
        const y1 = cy + Math.sin(startAngle) * startRadius;
        const x2 = x1 + (Math.random() - 0.5) * 22;
        const y2 = y1 + (Math.random() - 0.5) * 22;
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw(performance.now());

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} aria-label={t('chaosCoreVisualization', language)} role="img" />;
}
