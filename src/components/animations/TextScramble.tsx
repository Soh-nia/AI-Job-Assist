import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

/**
 * TextScramble — offground-style text scramble/shuffle effect.
 * Characters scramble through random glyphs before resolving.
 * Can also cycle through multiple phrases.
 */

const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";

interface TextScrambleProps {
  /** Array of phrases to cycle through, or a single string */
  phrases: string[];
  /** Time between phrase switches (ms) */
  interval?: number;
  /** Speed of the scramble effect (ms per character reveal) */
  speed?: number;
  /** Extra CSS classes */
  className?: string;
  /** Only trigger when in view */
  triggerOnView?: boolean;
  /** Play once or loop */
  loop?: boolean;
}

export default function TextScramble({
  phrases,
  interval = 3000,
  speed = 40,
  className = "",
  triggerOnView = true,
  loop = true,
}: TextScrambleProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: !loop, margin: "-60px" });
  const [displayText, setDisplayText] = useState(phrases[0]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrambling, setIsScrambling] = useState(false);
  const hasTriggered = useRef(false);

  const scrambleTo = useCallback(
    (targetText: string) => {
      setIsScrambling(true);
      const length = Math.max(displayText.length, targetText.length);
      let revealedCount = 0;

      const frameInterval = setInterval(() => {
        revealedCount++;
        const result = targetText
          .split("")
          .map((char, i) => {
            if (i < revealedCount) return char;
            if (char === " ") return " ";
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("");

        // Pad with random chars if target is shorter
        const padded =
          result.length < length
            ? result +
              Array.from(
                { length: length - result.length },
                () => CHARS[Math.floor(Math.random() * CHARS.length)],
              ).join("")
            : result;

        setDisplayText(
          padded.slice(
            0,
            Math.max(
              targetText.length,
              length - revealedCount + targetText.length,
            ),
          ),
        );

        if (revealedCount >= targetText.length) {
          clearInterval(frameInterval);
          setDisplayText(targetText);
          setIsScrambling(false);
        }
      }, speed);

      return () => clearInterval(frameInterval);
    },
    [displayText.length, speed],
  );

  // Initial scramble on view
  useEffect(() => {
    if (triggerOnView && isInView && !hasTriggered.current) {
      hasTriggered.current = true;
      scrambleTo(phrases[0]);
    }
  }, [isInView, triggerOnView, phrases, scrambleTo]);

  // Cycle through phrases
  useEffect(() => {
    if (!loop || phrases.length <= 1) return;
    if (triggerOnView && !isInView) return;

    const timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % phrases.length;
      setCurrentIndex(nextIndex);
      scrambleTo(phrases[nextIndex]);
    }, interval);

    return () => clearInterval(timer);
  }, [
    currentIndex,
    phrases,
    interval,
    loop,
    triggerOnView,
    isInView,
    scrambleTo,
  ]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        ref={ref}
        key={isScrambling ? "scrambling" : displayText}
        className={`inline-block ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        aria-label={phrases[currentIndex]}
      >
        {displayText.split("").map((char, i) => (
          <span
            key={`${i}-${char}`}
            className={
              i < displayText.length &&
              displayText[i] === phrases[currentIndex]?.[i]
                ? ""
                : "text-brand-blue/70"
            }
          >
            {char}
          </span>
        ))}
      </motion.span>
    </AnimatePresence>
  );
}
