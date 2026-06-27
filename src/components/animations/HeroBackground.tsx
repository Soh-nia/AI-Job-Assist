import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

/**
 * HeroBackground — Mind-blowing morphing particle sphere.
 *
 * Three signature effects:
 *  1. Cinematic entrance — particles implode from scattered chaos into sphere
 *  2. Magnetic cursor — force field repels nearby particles + click/tap shockwave
 *  3. Trails + color shift — fading motion trails with white→cyan velocity coloring
 *
 * Technical:
 *  • 1 000 Fibonacci-distributed particles on a noise-displaced sphere
 *  • Per-particle staggered entrance timing for organic assembly feel
 *  • Spring-damped offset system for smooth force-field interactions
 *  • Formation-complete pulse (auto-shockwave from centre when sphere assembles)
 */

/* ── Sphere & rendering ── */
const PARTICLE_COUNT_DESKTOP = 1000;
const PARTICLE_COUNT_MOBILE = 400;
const SPHERE_RADIUS_FACTOR = 0.375;
const DOT_RADIUS = 1.5;
const LINE_DISTANCE = 30;
const NOISE_SPEED = 0.0004;
const NOISE_AMPLITUDE = 0.22;
const AUTO_ROTATE_Y = 0.0003;
const AUTO_ROTATE_X = 0.00012;
const MOUSE_TILT = 0.15;

/* ── Cinematic entrance ── */
const ENTRANCE_DELAY = 800; // ms after mount before convergence starts
const ENTRANCE_DURATION = 3000; // ms to fully assemble

/* ── Magnetic cursor force field ── */
const FORCE_RADIUS = 160; // px repulsion range
const FORCE_STRENGTH = 30;

/* ── Click / tap shockwave ── */
const SW_SPEED = 500; // px/s ring expansion
const SW_DURATION = 1000; // ms lifetime
const SW_FORCE = 40;
const SW_RING_WIDTH = 60; // px force-ring thickness

/* ── Trails ── */
const TRAIL_LENGTH_DESKTOP = 8;
const TRAIL_LENGTH_MOBILE = 4;

/* ── Noise (fast pseudo-3D) ── */
function noise3D(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 1.27 + y * 3.71 + z * 2.53) *
    Math.sin(y * 2.18 + z * 1.34 + x * 3.92) *
    Math.cos(z * 1.83 + x * 2.47 + y * 1.69)
  );
}

/* ── Fibonacci sphere distribution ── */
function fibonacciSphere(count: number) {
  const pts: { ux: number; uy: number; uz: number }[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = ga * i;
    pts.push({ ux: Math.cos(th) * r, uy: y, uz: Math.sin(th) * r });
  }
  return pts;
}

/* ── Easing ── */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/* ── Types ── */
interface Shockwave {
  cx: number;
  cy: number;
  start: number;
  radius: number;
}

interface Proj {
  sx: number;
  sy: number;
  z: number;
  alpha: number;
  vel: number;
  idx: number;
}

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const mouseNorm = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const mousePx = useRef({ x: -9999, y: -9999 });
  const shockwaves = useRef<Shockwave[]>([]);
  const mountTime = useRef(0);
  const formationFired = useRef(false);

  /** Spawn a shockwave ring at screen-space coordinates */
  const spawnShockwave = useCallback((px: number, py: number) => {
    shockwaves.current.push({
      cx: px,
      cy: py,
      start: performance.now(),
      radius: 0,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    mountTime.current = performance.now();
    formationFired.current = false;

    /* Adaptive particle count for mobile performance */
    const isMobile =
      window.innerWidth < 768 ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const particleCount = isMobile
      ? PARTICLE_COUNT_MOBILE
      : PARTICLE_COUNT_DESKTOP;
    const trailLen = isMobile ? TRAIL_LENGTH_MOBILE : TRAIL_LENGTH_DESKTOP;

    const points = fibonacciSphere(particleCount);

    /* Per-particle staggered entrance delay (0–0.3 of total duration) */
    const entranceStagger = points.map(() => Math.random() * 0.3);

    /* Spawn positions — scattered in a large sphere around viewport centre */
    const spawnPos = points.map(() => {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dist = 500 + Math.random() * 1200;
      return {
        x: Math.sin(phi) * Math.cos(angle) * dist,
        y: Math.sin(phi) * Math.sin(angle) * dist,
        z: Math.cos(phi) * dist * 0.6,
      };
    });

    /* Per-particle force-field offset & velocity */
    const offsets = points.map(() => ({ ox: 0, oy: 0, vx: 0, vy: 0 }));

    /* Trail histories */
    const trails: { x: number; y: number }[][] = points.map(() => []);

    let w = 0,
      h = 0;

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

    const onMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseNorm.current = {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      };
      mousePx.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    window.addEventListener("mousemove", onMouseMove);

    /* Click → shockwave (only within canvas bounds) */
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        spawnShockwave(px, py);
      }
    };
    /* Touch → shockwave */
    const onTouch = (e: TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches[0];
      if (!t) return;
      const px = t.clientX - r.left;
      const py = t.clientY - r.top;
      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        spawnShockwave(px, py);
      }
    };
    window.addEventListener("click", onClick);
    window.addEventListener("touchstart", onTouch, { passive: true });

    /* ── Animation loop ── */
    let rotY = 0,
      rotX = 0,
      lastT = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(now - lastT, 33) / 1000; // seconds, capped ~30fps
      lastT = now;
      const noiseT = now * NOISE_SPEED;

      /* ── Entrance progress ── */
      const rawElapsed = now - mountTime.current - ENTRANCE_DELAY;
      const entranceGlobal = Math.max(
        0,
        Math.min(1, rawElapsed / ENTRANCE_DURATION),
      );

      /* ── Smooth mouse ── */
      const sm = smoothMouse.current;
      const tm = mouseNorm.current;
      sm.x += (tm.x - sm.x) * 0.04;
      sm.y += (tm.y - sm.y) * 0.04;

      /* ── Rotation ── */
      rotY += AUTO_ROTATE_Y;
      rotX += AUTO_ROTATE_X;
      const tRotY = rotY + (sm.x - 0.5) * MOUSE_TILT;
      const tRotX = rotX + (sm.y - 0.5) * -MOUSE_TILT;
      const cY = Math.cos(tRotY),
        sY = Math.sin(tRotY);
      const cX = Math.cos(tRotX),
        sX = Math.sin(tRotX);

      const sphereR = Math.min(w, h) * SPHERE_RADIUS_FACTOR;
      const cx = w * 0.5;
      const cy = h * 0.48;

      ctx.clearRect(0, 0, w, h);

      /* ── Ambient glow ── */
      const ambientGlow = ctx.createRadialGradient(
        cx,
        cy,
        sphereR * 0.2,
        cx,
        cy,
        sphereR * 1.6,
      );
      ambientGlow.addColorStop(
        0,
        `rgba(2, 91, 223, ${0.08 * entranceGlobal})`,
      );
      ambientGlow.addColorStop(
        0.5,
        `rgba(2, 91, 223, ${0.03 * entranceGlobal})`,
      );
      ambientGlow.addColorStop(1, "transparent");
      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, w, h);

      /* ── Shockwaves — update & prune ── */
      const activeSW = shockwaves.current.filter(
        (s) => now - s.start < SW_DURATION,
      );
      shockwaves.current = activeSW;
      for (const s of activeSW)
        s.radius = ((now - s.start) / 1000) * SW_SPEED;

      /* ── Project particles ── */
      const mp = mousePx.current;
      const projected: Proj[] = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const off = offsets[i];

        /* Per-particle entrance with stagger */
        const pEntRaw = Math.max(
          0,
          Math.min(
            1,
            (rawElapsed - entranceStagger[i] * ENTRANCE_DURATION) /
              (ENTRANCE_DURATION * 0.7),
          ),
        );
        const pEnt = easeOutExpo(pEntRaw);

        /* Noise displacement on sphere surface */
        const nv = noise3D(
          p.ux * 3 + noiseT,
          p.uy * 3 + noiseT * 0.7,
          p.uz * 3 + noiseT * 0.5,
        );
        const disp = 1 + nv * NOISE_AMPLITUDE;

        /* Target position on sphere */
        let tx = p.ux * sphereR * disp;
        let ty = p.uy * sphereR * disp;
        let tz = p.uz * sphereR * disp;

        /* Lerp from spawn to target during entrance */
        if (pEnt < 1) {
          const sp = spawnPos[i];
          tx = sp.x + (tx - sp.x) * pEnt;
          ty = sp.y + (ty - sp.y) * pEnt;
          tz = sp.z + (tz - sp.z) * pEnt;
        }

        /* Rotate Y then X */
        const x1 = tx * cY - tz * sY;
        const z1 = tx * sY + tz * cY;
        const y1 = ty * cX - z1 * sX;
        const z2 = ty * sX + z1 * cX;

        /* Perspective projection */
        const persp = 800;
        const sc = persp / (persp + z2);
        let sx = cx + x1 * sc;
        let sy = cy + y1 * sc;

        /* ── Force field & shockwave displacement ── */
        if (pEnt > 0.6) {
          /* Mouse repulsion (quadratic falloff) */
          const fdx = sx - mp.x;
          const fdy = sy - mp.y;
          const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
          if (fdist < FORCE_RADIUS && fdist > 1) {
            const f = ((1 - fdist / FORCE_RADIUS) ** 2) * FORCE_STRENGTH;
            off.vx += (fdx / fdist) * f * dt;
            off.vy += (fdy / fdist) * f * dt;
          }

          /* Shockwave ring forces */
          for (const sw of activeSW) {
            const sdx = sx - sw.cx;
            const sdy = sy - sw.cy;
            const sd = Math.sqrt(sdx * sdx + sdy * sdy);
            const ringDist = Math.abs(sd - sw.radius);
            if (ringDist < SW_RING_WIDTH && sd > 1) {
              const age = (now - sw.start) / SW_DURATION;
              const intensity =
                (1 - age) ** 1.5 * (1 - ringDist / SW_RING_WIDTH);
              off.vx += (sdx / sd) * intensity * SW_FORCE * dt;
              off.vy += (sdy / sd) * intensity * SW_FORCE * dt;
            }
          }
        }

        /* Damping + spring return to origin */
        off.vx *= 0.9;
        off.vy *= 0.9;
        off.ox += off.vx;
        off.oy += off.vy;
        off.ox *= 0.93;
        off.oy *= 0.93;

        sx += off.ox;
        sy += off.oy;

        const vel = Math.sqrt(off.vx * off.vx + off.vy * off.vy);

        /* Depth alpha, scaled by entrance */
        const depthFact = (z2 + sphereR) / (2 * sphereR);
        const alpha = pEnt * (0.08 + depthFact * 0.65);

        /* Update trail history */
        const trail = trails[i];
        trail.push({ x: sx, y: sy });
        if (trail.length > trailLen) trail.shift();

        projected.push({ sx, sy, z: z2, alpha, vel, idx: i });
      }

      /* Sort back-to-front */
      projected.sort((a, b) => a.z - b.z);

      /* ── Draw trails (velocity-based cyan streaks) ── */
      if (entranceGlobal > 0.3) {
        for (const pt of projected) {
          const trail = trails[pt.idx];
          if (trail.length < 2) continue;
          const trailIntensity =
            Math.min(pt.vel * 2.5, 1) * pt.alpha * 0.5;
          if (trailIntensity < 0.015) continue;

          for (let ti = 1; ti < trail.length; ti++) {
            const segAlpha = trailIntensity * (ti / trail.length);
            ctx.beginPath();
            ctx.moveTo(trail[ti - 1].x, trail[ti - 1].y);
            ctx.lineTo(trail[ti].x, trail[ti].y);
            ctx.strokeStyle = `rgba(0, 200, 255, ${segAlpha})`;
            ctx.lineWidth =
              DOT_RADIUS * (0.3 + (ti / trail.length) * 0.6);
            ctx.stroke();
          }
        }
      }

      /* ── Draw connections (fade in after 70% assembled) ── */
      if (entranceGlobal > 0.7) {
        ctx.lineWidth = 0.4;
        const connFade = Math.min((entranceGlobal - 0.7) / 0.3, 1);
        for (let i = 0; i < projected.length; i++) {
          for (let j = i + 1; j < projected.length; j++) {
            const dx = projected[i].sx - projected[j].sx;
            const dy = projected[i].sy - projected[j].sy;
            const d2 = dx * dx + dy * dy;
            if (d2 < LINE_DISTANCE * LINE_DISTANCE) {
              const la =
                (1 - Math.sqrt(d2) / LINE_DISTANCE) *
                Math.min(projected[i].alpha, projected[j].alpha) *
                0.35 *
                connFade;
              ctx.beginPath();
              ctx.moveTo(projected[i].sx, projected[i].sy);
              ctx.lineTo(projected[j].sx, projected[j].sy);
              ctx.strokeStyle = `rgba(2, 91, 223, ${la})`;
              ctx.stroke();
            }
          }
        }
      }

      /* ── Draw shockwave rings ── */
      for (const sw of activeSW) {
        const age = (now - sw.start) / SW_DURATION;
        const ringAlpha = (1 - age) ** 1.5 * 0.4;
        const ringW = 2.5 * (1 - age) + 0.5;
        /* Outer ring (cyan) */
        ctx.beginPath();
        ctx.arc(sw.cx, sw.cy, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 200, 255, ${ringAlpha})`;
        ctx.lineWidth = ringW;
        ctx.stroke();
        /* Inner echo ring */
        if (sw.radius > 20) {
          ctx.beginPath();
          ctx.arc(sw.cx, sw.cy, sw.radius * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(2, 91, 223, ${ringAlpha * 0.4})`;
          ctx.lineWidth = ringW * 0.5;
          ctx.stroke();
        }
      }

      /* ── Draw particles ── */
      for (const pt of projected) {
        const vf = Math.min(pt.vel * 4, 1); // velocity factor 0→1

        /* White → Cyan colour shift based on velocity */
        const r = Math.round(255 - vf * 255);
        const g = Math.round(255 - vf * 55);
        const b = 255;

        /* Dot */
        ctx.beginPath();
        ctx.arc(
          pt.sx,
          pt.sy,
          DOT_RADIUS * (0.6 + pt.alpha * 0.6),
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pt.alpha * 0.85})`;
        ctx.fill();

        /* Glow — bigger & brighter when moving fast */
        if (pt.alpha > 0.25 || vf > 0.2) {
          const glowR = DOT_RADIUS * (3 + vf * 5);
          const glowA = Math.max(
            (pt.alpha - 0.25) * 0.18,
            vf * 0.12,
          );
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, glowR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 140, 255, ${glowA})`;
          ctx.fill();
        }
      }

      /* ── Mouse force-field soft glow ── */
      if (entranceGlobal > 0.8) {
        const mx = mp.x,
          my = mp.y;
        if (mx > -100 && mx < w + 100 && my > -100 && my < h + 100) {
          const grad = ctx.createRadialGradient(
            mx,
            my,
            0,
            mx,
            my,
            FORCE_RADIUS * 0.6,
          );
          grad.addColorStop(0, "rgba(0, 200, 255, 0.025)");
          grad.addColorStop(0.6, "rgba(2, 91, 223, 0.01)");
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(mx, my, FORCE_RADIUS * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* ── Formation-complete pulse ── */
      if (entranceGlobal >= 0.99 && !formationFired.current) {
        formationFired.current = true;
        spawnShockwave(cx, cy);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouch);
    };
  }, [spawnShockwave]);

  return (
    <>
      {/* Base solid dark navy */}
      <motion.div
        className="absolute inset-0 bg-[#070c48]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      />

      {/* Canvas — particle sphere layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Subtle noise texture for depth */}
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
