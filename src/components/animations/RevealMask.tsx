import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

/**
 * RevealMask — offground-style content reveal with clip-path mask.
 * Content wipes into view from a chosen direction.
 */

type Direction = "left" | "right" | "top" | "bottom";

interface RevealMaskProps {
  children: ReactNode;
  className?: string;
  /** Direction the mask wipes from */
  direction?: Direction;
  /** Delay before animation starts */
  delay?: number;
  /** Duration of the mask reveal */
  duration?: number;
  /** Background color of the sliding mask bar */
  maskColor?: string;
}

const clipStart: Record<Direction, string> = {
  left: "inset(0 100% 0 0)",
  right: "inset(0 0 0 100%)",
  top: "inset(100% 0 0 0)",
  bottom: "inset(0 0 100% 0)",
};

const clipEnd = "inset(0 0 0 0)";

export default function RevealMask({
  children,
  className = "",
  direction = "left",
  delay = 0,
  duration = 0.9,
  maskColor = "#025bdf",
}: RevealMaskProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {/* Content with clip-path reveal */}
      <motion.div
        initial={{ clipPath: clipStart[direction] }}
        animate={
          isInView ? { clipPath: clipEnd } : { clipPath: clipStart[direction] }
        }
        transition={{
          duration,
          delay: delay + 0.35,
          ease: [0.77, 0, 0.175, 1],
        }}
      >
        {children}
      </motion.div>

      {/* Sliding mask bar — wipes across then leaves */}
      <motion.div
        className="absolute inset-0 z-10"
        initial={{
          scaleX: direction === "left" || direction === "right" ? 0 : 1,
          scaleY: direction === "top" || direction === "bottom" ? 0 : 1,
        }}
        animate={
          isInView
            ? {
                scaleX: [0, 1, 1, 0],
                scaleY:
                  direction === "top" || direction === "bottom"
                    ? [0, 1, 1, 0]
                    : 1,
              }
            : {}
        }
        transition={{
          duration: duration * 1.2,
          delay,
          ease: [0.77, 0, 0.175, 1],
          times: [0, 0.4, 0.6, 1],
        }}
        style={{
          backgroundColor: maskColor,
          transformOrigin:
            direction === "left"
              ? "left center"
              : direction === "right"
                ? "right center"
                : direction === "top"
                  ? "center top"
                  : "center bottom",
        }}
      />
    </div>
  );
}
