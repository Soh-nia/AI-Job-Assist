import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * HorizontalScroll — offground-style pinned horizontal scroll.
 * A section that pins in the viewport while cards scroll horizontally.
 * Uses Framer Motion + sticky positioning (no GSAP needed).
 */

interface HorizontalScrollProps {
  children: ReactNode[];
  /** Height multiplier — controls how much vertical scroll drives horizontal travel */
  scrollMultiplier?: number;
  className?: string;
  /** Show panel count indicator */
  showIndicator?: boolean;
}

export default function HorizontalScroll({
  children,
  scrollMultiplier = 1,
  className = "",
  showIndicator = true,
}: HorizontalScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelCount = children.length;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Map vertical scroll to horizontal movement
  // 0% scroll → 0% offset, 100% scroll → -(panelCount - 1) * 100vw
  const x = useTransform(
    scrollYProgress,
    [0, 1],
    ["0vw", `${-(panelCount - 1) * 100 * scrollMultiplier}vw`],
  );

  // Progress indicator
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      ref={containerRef}
      className={`relative ${className}`}
      style={{ height: `${panelCount * 100}vh` }}
    >
      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div style={{ x }} className="flex h-full will-change-transform">
          {children.map((child, i) => (
            <div
              key={i}
              className="w-screen h-full shrink-0 flex items-center justify-center"
            >
              {child}
            </div>
          ))}
        </motion.div>

        {/* Progress bar at bottom */}
        {showIndicator && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
            <div className="w-48 h-[2px] bg-brand-navy/10 rounded-full overflow-hidden">
              <motion.div
                style={{ width: progressWidth }}
                className="h-full bg-brand-blue rounded-full"
              />
            </div>
            <span className="text-brand-navy/30 text-xs font-mono tracking-wider">
              {String(panelCount).padStart(2, "0")} panels
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
