import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * HeroOrbit — Orbiting rings / constellation animation for the Services page.
 *
 * Multiple concentric orbital rings with particles travelling along them,
 * connected by faint lines. Represents interconnected service offerings.
 */

const RING_COUNT = 4;
const PARTICLES_PER_RING = 20;
const ORBIT_SPEED_BASE = 0.0003;
const DOT_RADIUS = 1.6;
const CONNECTION_DISTANCE = 80;

interface OrbitParticle {
  ring: number;
  angle: number;
  speed: number;
  size: number;
}

function createParticles(): OrbitParticle[] {
  const particles: OrbitParticle[] = [];
  for (let r = 0; r < RING_COUNT; r++) {
    for (let i = 0; i < PARTICLES_PER_RING; i++) {
      particles.push({
        ring: r,
        angle: (Math.PI * 2 * i) / PARTICLES_PER_RING + Math.random() * 0.5,
        speed: ORBIT_SPEED_BASE * (1 + r * 0.3) * (r % 2 === 0 ? 1 : -1),
        size: 0.6 + Math.random() * 0.8,
      });
    }
  }
  return particles;
}

export default function HeroOrbit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles = createParticles();
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
      const t = timestamp;

      const sm = smoothMouseRef.current;
      const tm = mouseRef.current;
      sm.x += (tm.x - sm.x) * 0.03;
      sm.y += (tm.y - sm.y) * 0.03;

      const cx = w * 0.5 + (sm.x - 0.5) * w * 0.03;
      const cy = h * 0.48 + (sm.y - 0.5) * h * 0.03;
      const baseRadius = Math.min(w, h) * 0.12;

      ctx.clearRect(0, 0, w, h);

      // Central glow
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, baseRadius * 5);
      glow.addColorStop(0, "rgba(2, 91, 223, 0.1)");
      glow.addColorStop(0.4, "rgba(2, 91, 223, 0.03)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Draw orbital rings
      for (let r = 0; r < RING_COUNT; r++) {
        const ringRadius = baseRadius * (1.5 + r * 1.1);
        const tiltX = 0.55 + r * 0.05; // varying 3D tilt per ring
        const tiltShift = (sm.y - 0.5) * 0.1;

        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          ringRadius,
          ringRadius * (tiltX + tiltShift),
          r * 0.3 + t * 0.00005,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(2, 91, 223, ${0.06 + r * 0.01})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Compute projected particle positions
      interface Projected {
        x: number;
        y: number;
        alpha: number;
        size: number;
      }

      const projected: Projected[] = [];

      for (const p of particles) {
        p.angle += p.speed;
        const ringRadius = baseRadius * (1.5 + p.ring * 1.1);
        const tiltX = 0.55 + p.ring * 0.05;
        const tiltShift = (sm.y - 0.5) * 0.1;
        const ringRotation = p.ring * 0.3 + t * 0.00005;

        const cosR = Math.cos(ringRotation);
        const sinR = Math.sin(ringRotation);

        const rawX = Math.cos(p.angle) * ringRadius;
        const rawY = Math.sin(p.angle) * ringRadius * (tiltX + tiltShift);

        const px = cx + rawX * cosR - rawY * sinR;
        const py = cy + rawX * sinR + rawY * cosR;

        // Depth from sin of angle — back particles are dimmer
        const depth = Math.sin(p.angle);
        const alpha = 0.15 + (depth + 1) * 0.35;

        projected.push({ x: px, y: py, alpha, size: p.size });
      }

      // Draw connections
      ctx.lineWidth = 0.3;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECTION_DISTANCE) {
            const lineAlpha =
              (1 - d / CONNECTION_DISTANCE) *
              Math.min(projected[i].alpha, projected[j].alpha) *
              0.25;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.strokeStyle = `rgba(2, 91, 223, ${lineAlpha})`;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS * p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.85})`;
        ctx.fill();

        if (p.alpha > 0.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, DOT_RADIUS * p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(2, 91, 223, ${(p.alpha - 0.5) * 0.2})`;
          ctx.fill();
        }
      }

      // Central dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(2, 91, 223, 0.4)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(2, 91, 223, 0.08)";
      ctx.fill();

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
