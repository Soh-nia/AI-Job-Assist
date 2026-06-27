import { useRef } from "react";
import {
  motion,
  useScroll,
  useMotionValue,
  useTransform,
  useSpring,
  useAnimationFrame,
} from "framer-motion";

/**
 * ScrollVelocity — offground-style velocity-aware marquee.
 * Text skews based on scroll speed and accelerates on fast scroll.
 */

interface ScrollVelocityProps {
  children: string;
  baseVelocity?: number;
  className?: string;
}

function wrap(min: number, max: number, v: number): number {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
}

export default function ScrollVelocity({
  children,
  baseVelocity = -2,
  className = "",
}: ScrollVelocityProps) {
  const xPercent = useMotionValue(0);
  const baseXRef = useRef(0);
  const prevScrollRef = useRef(0);
  const prevTimeRef = useRef(Date.now());
  const velocityRef = useRef(0);

  const { scrollY } = useScroll();

  // Smooth skew driven by velocity
  const skewValue = useMotionValue(0);
  const smoothSkew = useSpring(skewValue, { stiffness: 200, damping: 40 });

  // Convert numeric xPercent to CSS percentage string
  const xPercentStr = useTransform(xPercent, (v) => `${v}%`);

  useAnimationFrame((_, delta) => {
    // Compute velocity from scroll position
    const currentScroll = scrollY.get();
    const now = Date.now();
    const dt = Math.max(now - prevTimeRef.current, 1);
    const rawVelocity = (currentScroll - prevScrollRef.current) / dt;
    prevScrollRef.current = currentScroll;
    prevTimeRef.current = now;

    // Smooth velocity tracking
    velocityRef.current += (rawVelocity - velocityRef.current) * 0.15;
    const velocity = velocityRef.current;

    // Apply skew based on velocity direction + magnitude
    skewValue.set(Math.max(-12, Math.min(12, velocity * 8)));

    // Speed scales with scroll velocity
    const velocityFactor = 1 + Math.min(Math.abs(velocity) * 25, 15);
    const moveBy = baseVelocity * velocityFactor * (delta / 1000) * 50;
    baseXRef.current += moveBy;
    xPercent.set(wrap(-25, 0, baseXRef.current));
  });

  const repeated = `${children} · `.repeat(8);

  return (
    <div className="overflow-hidden py-6">
      <motion.div
        style={{ x: xPercentStr, skewX: smoothSkew }}
        className="whitespace-nowrap will-change-transform"
      >
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`inline-block text-6xl md:text-8xl lg:text-[10rem] font-display font-bold leading-none tracking-tight ${className}`}
          >
            {repeated}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
