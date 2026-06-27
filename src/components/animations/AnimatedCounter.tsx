import { useRef, useEffect, useState } from "react";
import { motion, useInView, useSpring, useMotionValue } from "framer-motion";

/**
 * AnimatedCounter — numbers that count up when scrolled into view.
 * offground-style: smooth spring-driven counting with optional suffix.
 */

interface AnimatedCounterProps {
  /** Target number to count towards */
  target: number;
  /** Optional prefix like "$" or "+" */
  prefix?: string;
  /** Optional suffix like "+", "%", "K", etc. */
  suffix?: string;
  /** Animation duration in seconds */
  duration?: number;
  /** Extra CSS classes */
  className?: string;
}

export default function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 2,
  className = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [displayValue, setDisplayValue] = useState(0);

  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, {
    stiffness: 60,
    damping: 20,
    duration: duration * 1000,
  });

  useEffect(() => {
    if (isInView) {
      motionVal.set(target);
    }
  }, [isInView, target, motionVal]);

  useEffect(() => {
    const unsubscribe = springVal.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return () => unsubscribe();
  }, [springVal]);

  return (
    <motion.span
      ref={ref}
      className={`tabular-nums ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {prefix}
      {displayValue}
      {suffix}
    </motion.span>
  );
}
