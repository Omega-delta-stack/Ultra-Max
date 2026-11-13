import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  brightness: number;
  baseBrightness: number;
  driftX: number;
  driftY: number;
}

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const backdropCanvas = document.createElement('canvas');
    const backdropCtx = backdropCanvas.getContext('2d');

    const colors = [
      '#ffffff',
      '#c4b5fd', // soft purple
      '#a7f3d0', // soft emerald
      '#67e8f9', // electric cyan
      '#93c5fd', // soft blue
      '#f472b6', // neon magenta
    ];

    let stars: Star[] = [];

    const renderBackdrop = () => {
      if (!backdropCtx || width <= 0 || height <= 0) return;
      backdropCanvas.width = width;
      backdropCanvas.height = height;

      backdropCtx.fillStyle = '#030308';
      backdropCtx.fillRect(0, 0, width, height);

      // Nebula glow 1 (Electric Blue)
      const g1X = width * 0.25;
      const g1Y = height * 0.35;
      const rad1 = Math.max(width, height) * 0.45;
      const grad1 = backdropCtx.createRadialGradient(g1X, g1Y, 0, g1X, g1Y, rad1);
      grad1.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
      grad1.addColorStop(0.4, 'rgba(14, 116, 144, 0.08)');
      grad1.addColorStop(1, 'rgba(3, 3, 8, 0)');
      backdropCtx.fillStyle = grad1;
      backdropCtx.fillRect(0, 0, width, height);

      // Nebula glow 2 (Cosmic Purple / Indigo)
      const g2X = width * 0.78;
      const g2Y = height * 0.55;
      const rad2 = Math.max(width, height) * 0.5;
      const grad2 = backdropCtx.createRadialGradient(g2X, g2Y, 0, g2X, g2Y, rad2);
      grad2.addColorStop(0, 'rgba(147, 51, 234, 0.18)');
      grad2.addColorStop(0.45, 'rgba(88, 28, 135, 0.09)');
      grad2.addColorStop(1, 'rgba(3, 3, 8, 0)');
      backdropCtx.fillStyle = grad2;
      backdropCtx.fillRect(0, 0, width, height);

      // Nebula glow 3 (Central Quantum Deep Blue)
      const g3X = width * 0.5;
      const g3Y = height * 0.2;
      const rad3 = Math.max(width, height) * 0.35;
      const grad3 = backdropCtx.createRadialGradient(g3X, g3Y, 0, g3X, g3Y, rad3);
      grad3.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
      grad3.addColorStop(1, 'rgba(3, 3, 8, 0)');
      backdropCtx.fillStyle = grad3;
      backdropCtx.fillRect(0, 0, width, height);

      // Elliptical galaxy ring
      backdropCtx.save();
      backdropCtx.translate(width * 0.5, height * 0.45);
      const ringGrad = backdropCtx.createRadialGradient(0, 0, 100, 0, 0, 360);
      ringGrad.addColorStop(0, 'rgba(168, 85, 247, 0.05)');
      ringGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.06)');
      ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      backdropCtx.fillStyle = ringGrad;
      backdropCtx.scale(1.8, 0.6);
      backdropCtx.beginPath();
      backdropCtx.arc(0, 0, 360, 0, Math.PI * 2);
      backdropCtx.fill();
      backdropCtx.restore();
    };

    const initStars = () => {
      if (width <= 0 || height <= 0) {
        stars = [];
        return;
      }
      const starCount = Math.min(Math.floor((width * height) / 6500), 130);
      stars = [];
      for (let i = 0; i < starCount; i++) {
        const base = 0.35 + Math.random() * 0.65;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() < 0.8 ? Math.random() * 1.4 + 0.5 : Math.random() * 1.9 + 1.1,
          color: colors[Math.floor(Math.random() * colors.length)],
          brightness: base,
          baseBrightness: base,
          driftX: (Math.random() - 0.5) * 0.12,
          driftY: (Math.random() - 0.5) * 0.12,
        });
      }
    };

    renderBackdrop();
    initStars();

    let time = 0;
    let lastDrawTime = 0;
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const drawFrame = (advance: boolean) => {
      if (width <= 0 || height <= 0) return;
      if (advance) {
        time += 0.025;
      }

      ctx.globalAlpha = 1;
      if (backdropCtx && backdropCanvas.width > 0 && backdropCanvas.height > 0) {
        ctx.drawImage(backdropCanvas, 0, 0);
      } else {
        ctx.fillStyle = '#030308';
        ctx.fillRect(0, 0, width, height);
      }

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        if (advance) {
          star.x += star.driftX;
          star.y += star.driftY;

          if (star.x < 0) star.x = width;
          if (star.x > width) star.x = 0;
          if (star.y < 0) star.y = height;
          if (star.y > height) star.y = 0;

          star.brightness =
            star.baseBrightness + Math.sin(time * 2 + i * 1.5) * (1 - star.baseBrightness) * 0.5;
        }

        const alpha = Math.max(0.15, Math.min(1, star.brightness));
        ctx.fillStyle = star.color;

        if (star.size > 1.7) {
          ctx.globalAlpha = alpha * 0.22;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (width <= 0 || height <= 0) return;
      renderBackdrop();
      initStars();
      drawFrame(false);
    };

    window.addEventListener('resize', handleResize);
    drawFrame(false);

    if (!prefersReducedMotion) {
      const loop = (now: number) => {
        if (!document.hidden && now - lastDrawTime >= 42) {
          lastDrawTime = now;
          drawFrame(true);
        }
        animationFrameId = requestAnimationFrame(loop);
      };
      animationFrameId = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.95 }}
    />
  );
};
