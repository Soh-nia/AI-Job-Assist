import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * HeroWave — Flowing sine-wave particle field for the Blog page.
 *
 * A grid of particles that undulate in a smooth wave pattern,
 * representing the flow of knowledge, ideas and thought leadership.
 */

const COLS = 50;
const ROWS = 25;
const DOT_RADIUS = 1.2;
const WAVE_SPEED = 0.0008;
const WAVE_AMPLITUDE = 0.06; // fraction of viewport height
const WAVE_FREQUENCY = 0.15;

export default function HeroWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    window.addEventListener("mousemove", handleMouse);

    const animate = (timestamp: number) => {
      const t = timestamp * WAVE_SPEED;

      const sm = smoothMouseRef.current;
      const tm = mouseRef.current;
      sm.x += (tm.x - sm.x) * 0.03;
      sm.y += (tm.y - sm.y) * 0.03;

      ctx.clearRect(0, 0, w, h);

      // Ambient glow
      const glow = ctx.createRadialGradient(
        w * 0.5,
        h * 0.45,
        50,
        w * 0.5,
        h * 0.45,
        w * 0.5,
      );
      glow.addColorStop(0, "rgba(2, 91, 223, 0.06)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const spacingX = w / (COLS - 1);
      const spacingY = h / (ROWS - 1);
      const mouseDistortRadius = Math.min(w, h) * 0.2;

      interface WavePoint {
        x: number;
        y: number;
        alpha: number;
      }

      const points: WavePoint[] = [];

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const baseX = col * spacingX;
          const baseY = row * spacingY;

          // Multiple overlapping wave functions for organic feel
          const wave1 = Math.sin(col * WAVE_FREQUENCY + t) * h * WAVE_AMPLITUDE;
          const wave2 =
            Math.sin(row * WAVE_FREQUENCY * 0.7 + t * 0.6 + 1.5) *
            h *
            WAVE_AMPLITUDE *
            0.5;
          const wave3 =
            Math.cos((col + row) * WAVE_FREQUENCY * 0.4 + t * 0.3) *
            h *
            WAVE_AMPLITUDE *
            0.3;

          let x = baseX;
          let y = baseY + wave1 + wave2 + wave3;

          // Mouse distortion — particles push away from cursor
          const mdx = x - sm.x * w;
          const mdy = y - sm.y * h;
          const mouseDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mouseDist < mouseDistortRadius) {
            const force = (1 - mouseDist / mouseDistortRadius) * 25;
            x += (mdx / mouseDist) * force;
            y += (mdy / mouseDist) * force;
          }

          // Alpha based on wave height — crests are brighter
          const waveHeight =
            (wave1 + wave2 + wave3) / (h * WAVE_AMPLITUDE * 1.8);
          const alpha = 0.08 + (waveHeight + 1) * 0.3;

          points.push({ x, y, alpha });
        }
      }

      // Draw horizontal connections
      ctx.lineWidth = 0.3;
      for (let row = 0; row < ROWS; row++) {
        ctx.beginPath();
        const startIdx = row * COLS;
        ctx.moveTo(points[startIdx].x, points[startIdx].y);
        for (let col = 1; col < COLS; col++) {
          const p = points[startIdx + col];
          ctx.lineTo(p.x, p.y);
        }
        const rowAlpha = 0.04 + (Math.sin(row * 0.3 + t * 0.5) + 1) * 0.03;
        ctx.strokeStyle = `rgba(2, 91, 223, ${rowAlpha})`;
        ctx.stroke();
      }

      // Draw dots
      for (const p of points) {
        const r = DOT_RADIUS * (0.5 + p.alpha * 0.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.7})`;
        ctx.fill();

        if (p.alpha > 0.45) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(2, 91, 223, ${(p.alpha - 0.45) * 0.15})`;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <>
      <motion.div
        className="absolute inset-0 bg-[#070c48]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
    </>
  );
}
