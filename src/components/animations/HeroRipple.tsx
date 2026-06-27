import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * HeroRipple — Pulsing concentric ripple / radar animation for the Contact page.
 *
 * Expanding concentric rings pulse outward from a central point,
 * with scattered particles. Represents reaching out and making connections.
 */

const RING_MAX = 6;
const RING_SPEED = 0.0004;
const SCATTER_COUNT = 60;
const DOT_RADIUS = 1.3;

interface ScatterParticle {
  angle: number;
  distance: number; // 0-1
  speed: number;
  size: number;
  phase: number;
}

function createScatter(): ScatterParticle[] {
  const particles: ScatterParticle[] = [];
  for (let i = 0; i < SCATTER_COUNT; i++) {
    particles.push({
      angle: Math.random() * Math.PI * 2,
      distance: 0.2 + Math.random() * 0.8,
      speed: 0.0001 + Math.random() * 0.0003,
      size: 0.5 + Math.random() * 1,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

export default function HeroRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scatter = createScatter();
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
      const t = timestamp * RING_SPEED;

      const sm = smoothMouseRef.current;
      const tm = mouseRef.current;
      sm.x += (tm.x - sm.x) * 0.03;
      sm.y += (tm.y - sm.y) * 0.03;

      const cx = w * 0.5;
      const cy = h * 0.48;
      const maxRadius = Math.min(w, h) * 0.42;

      ctx.clearRect(0, 0, w, h);

      // Central glow
      const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, maxRadius * 1.5);
      glow.addColorStop(0, "rgba(2, 91, 223, 0.12)");
      glow.addColorStop(0.3, "rgba(2, 91, 223, 0.04)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Central pulsing dot
      const pulse = 0.5 + Math.sin(t * 3) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(2, 91, 223, ${0.4 + pulse * 0.3})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 12 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(2, 91, 223, ${0.06 + pulse * 0.04})`;
      ctx.fill();

      // Expanding ripple rings
      for (let i = 0; i < RING_MAX; i++) {
        const phase = (t + (i / RING_MAX) * Math.PI * 2) % (Math.PI * 2);
        const progress = phase / (Math.PI * 2); // 0 to 1
        const radius = progress * maxRadius;
        const alpha = (1 - progress) * 0.15;

        if (alpha > 0.005) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(2, 91, 223, ${alpha})`;
          ctx.lineWidth = 1 + (1 - progress) * 1.5;
          ctx.stroke();

          // Small dots on ring circumference
          const dotCount = 8;
          for (let d = 0; d < dotCount; d++) {
            const dotAngle = (Math.PI * 2 * d) / dotCount + t * 0.1;
            const dx = cx + Math.cos(dotAngle) * radius;
            const dy = cy + Math.sin(dotAngle) * radius;
            ctx.beginPath();
            ctx.arc(dx, dy, DOT_RADIUS * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 2.5})`;
            ctx.fill();
          }
        }
      }

      // Crosshair lines (subtle radar feel)
      ctx.lineWidth = 0.3;
      ctx.strokeStyle = "rgba(2, 91, 223, 0.04)";
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.stroke();

      // Rotating scan line
      const scanAngle = t * 0.5;
      const scanEndX = cx + Math.cos(scanAngle) * maxRadius;
      const scanEndY = cy + Math.sin(scanAngle) * maxRadius;
      const scanGrad = ctx.createLinearGradient(cx, cy, scanEndX, scanEndY);
      scanGrad.addColorStop(0, "rgba(2, 91, 223, 0.08)");
      scanGrad.addColorStop(1, "rgba(2, 91, 223, 0)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(scanEndX, scanEndY);
      ctx.strokeStyle = scanGrad;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Scatter particles
      for (const p of scatter) {
        const pa = p.angle + timestamp * p.speed;
        const breathe = 1 + Math.sin(timestamp * 0.001 + p.phase) * 0.15;
        const dist = p.distance * maxRadius * breathe;
        const px = cx + Math.cos(pa) * dist;
        const py = cy + Math.sin(pa) * dist;

        // Proximity to mouse adds brightness
        const mdx = px - sm.x * w;
        const mdy = py - sm.y * h;
        const mouseDist = Math.sqrt(mdx * mdx + mdy * mdy);
        const mouseBoost = mouseDist < 120 ? (1 - mouseDist / 120) * 0.3 : 0;

        const alpha =
          0.1 + mouseBoost + Math.sin(timestamp * 0.001 + p.phase) * 0.1;

        ctx.beginPath();
        ctx.arc(px, py, DOT_RADIUS * p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        if (alpha > 0.25) {
          ctx.beginPath();
          ctx.arc(px, py, DOT_RADIUS * p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(2, 91, 223, ${(alpha - 0.25) * 0.2})`;
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
