import { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';

interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export default function Parallax({ children, speed = 0.5, className = '' }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]) as MotionValue<number>;

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
