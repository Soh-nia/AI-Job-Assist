import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * HeroDNA — Flowing particle nebula for the About page.
 *
 * A cloud of particles orbiting invisible attractor points, creating
 * organic flowing motion with depth layering and connection lines.
 * Responds to mouse position with a gentle gravitational pull.
 */

const PARTICLE_COUNT = 220;
const ATTRACTOR_COUNT = 5;
const CONNECTION_DIST = 65;
const MOUSE_RADIUS = 180;
const TIME_SCALE = 0.0003;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSpeed: number;
  size: number;
  brightness: number;
  attractorIdx: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  layer: number; // 0 = back, 1 = mid, 2 = front
}

interface Attractor {
  cx: number; // fraction of w
  cy: number; // fraction of h
  driftAngle: number;
  driftRadius: number;
  driftSpeed: number;
}

function createAttractors(): Attractor[] {
  return Array.from({ length: ATTRACTOR_COUNT }, (_, i) => ({
    cx: 0.3 + (i % 3) * 0.2 + (Math.random() - 0.5) * 0.1,
    cy: 0.25 + Math.floor(i / 3) * 0.3 + (Math.random() - 0.5) * 0.1,
    driftAngle: Math.random() * Math.PI * 2,
    driftRadius: 0.04 + Math.random() * 0.06,
    driftSpeed: 0.15 + Math.random() * 0.2,
  }));
}

function createParticles(w: number, h: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const layer = Math.random() < 0.3 ? 0 : Math.random() < 0.6 ? 1 : 2;
    const sizeBase = layer === 0 ? 0.6 : layer === 1 ? 1.2 : 1.8;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      baseSpeed: 0.15 + Math.random() * 0.25,
      size: sizeBase + Math.random() * 0.6,
      brightness: 0.15 + Math.random() * 0.6,
      attractorIdx: Math.floor(Math.random() * ATTRACTOR_COUNT),
      orbitRadius: 40 + Math.random() * 160,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: (0.3 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1),
      layer,
    };
  });
}

export default function HeroDNA() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const particlesRef = useRef<Particle[]>([]);
  const attractorsRef = useRef<Attractor[]>(createAttractors());

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

      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(w, h);
      }
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
      const t = timestamp * TIME_SCALE;

      // Smooth mouse
      const sm = smoothMouseRef.current;
      const tm = mouseRef.current;
      sm.x += (tm.x - sm.x) * 0.04;
      sm.y += (tm.y - sm.y) * 0.04;

      const mx = sm.x * w;
      const my = sm.y * h;

      ctx.clearRect(0, 0, w, h);

      // Multi-layered ambient glow
      const cx = w * 0.5;
      const cy = h * 0.45;
      const g1 = ctx.createRadialGradient(
        cx * 0.8,
        cy * 0.9,
        0,
        cx * 0.8,
        cy * 0.9,
        w * 0.4,
      );
      g1.addColorStop(0, "rgba(2, 91, 223, 0.08)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(
        cx * 1.3,
        cy * 1.1,
        0,
        cx * 1.3,
        cy * 1.1,
        w * 0.35,
      );
      g2.addColorStop(0, "rgba(2, 91, 223, 0.05)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Compute attractor positions (they drift slowly)
      const attractors = attractorsRef.current;
      const attractorPositions = attractors.map((a) => ({
        x:
          a.cx * w +
          Math.cos(t * a.driftSpeed + a.driftAngle) * w * a.driftRadius,
        y:
          a.cy * h +
          Math.sin(t * a.driftSpeed * 0.7 + a.driftAngle) * h * a.driftRadius,
      }));

      // Update particles
      const particles = particlesRef.current;
      for (const p of particles) {
        // Orbit around attractor
        p.orbitAngle += p.orbitSpeed * 0.008;
        const att = attractorPositions[p.attractorIdx];
        const targetX = att.x + Math.cos(p.orbitAngle) * p.orbitRadius;
        const targetY = att.y + Math.sin(p.orbitAngle) * p.orbitRadius;

        // Steer toward orbital target
        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const steerForce = 0.012;
        p.vx += dx * steerForce;
        p.vy += dy * steerForce;

        // Mouse influence — gentle attraction
        const mdx = mx - p.x;
        const mdy = my - p.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < MOUSE_RADIUS && mDist > 1) {
          const force = ((MOUSE_RADIUS - mDist) / MOUSE_RADIUS) * 0.4;
          p.vx += (mdx / mDist) * force;
          p.vy += (mdy / mDist) * force;
        }

        // Damping
        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx * p.baseSpeed;
        p.y += p.vy * p.baseSpeed;

        // Soft boundary wrapping
        const margin = 60;
        if (p.x < -margin) p.x = w + margin;
        if (p.x > w + margin) p.x = -margin;
        if (p.y < -margin) p.y = h + margin;
        if (p.y > h + margin) p.y = -margin;
      }

      // Sort by layer for proper rendering order
      const sorted = [...particles].sort((a, b) => a.layer - b.layer);

      // Draw connection lines (only mid and front layers)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].layer === 0) continue;
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].layer === 0) continue;
          const dx = sorted[i].x - sorted[j].x;
          const dy = sorted[i].y - sorted[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(sorted[i].x, sorted[i].y);
            ctx.lineTo(sorted[j].x, sorted[j].y);
            ctx.strokeStyle = `rgba(2, 91, 223, ${alpha})`;
            ctx.stroke();
          }
        }
      }

      // Draw particles with layer-based rendering
      for (const p of sorted) {
        const layerAlpha = p.layer === 0 ? 0.2 : p.layer === 1 ? 0.5 : 0.85;
        const pulse = 0.85 + Math.sin(t * 3 + p.orbitAngle * 2) * 0.15;
        const finalAlpha = p.brightness * layerAlpha * pulse;

        // Soft glow halo (front particles only)
        if (p.layer === 2 && p.brightness > 0.4) {
          const glowR = p.size * 4;
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          glow.addColorStop(0, `rgba(2, 91, 223, ${finalAlpha * 0.2})`);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
        const isBlue = p.layer === 2 && p.brightness > 0.5;
        ctx.fillStyle = isBlue
          ? `rgba(80, 160, 255, ${finalAlpha})`
          : `rgba(255, 255, 255, ${finalAlpha})`;
        ctx.fill();
      }

      // Faint large orbiting ring decorations
      ctx.lineWidth = 0.3;
      for (let i = 0; i < 3; i++) {
        const ringCx = cx + Math.cos(t * 0.4 + i * 2.1) * w * 0.1;
        const ringCy = cy + Math.sin(t * 0.3 + i * 2.1) * h * 0.08;
        const ringR = 80 + i * 60 + Math.sin(t + i) * 20;
        ctx.beginPath();
        ctx.arc(ringCx, ringCy, ringR, t + i, t + i + Math.PI * 1.2);
        ctx.strokeStyle = `rgba(2, 91, 223, ${0.04 + i * 0.01})`;
        ctx.stroke();
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
