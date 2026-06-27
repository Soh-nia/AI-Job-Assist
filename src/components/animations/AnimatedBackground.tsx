import { motion } from "framer-motion";

/**
 * AnimatedBackground — Floating blobs, decorative rings, and subtle grid overlay.
 *
 * Mirrors the hero-section background aesthetic but tuned for light and tinted sections.
 * Drop this inside any `relative overflow-hidden` section for an ambient, living background.
 *
 * @param variant  'light' for white sections, 'tinted' for off-white/section-tinted areas
 */
interface AnimatedBackgroundProps {
  variant?: "light" | "tinted";
}

export default function AnimatedBackground({
  variant = "light",
}: AnimatedBackgroundProps) {
  const isLight = variant === "light";

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* ── Floating blobs ── */}
      <motion.div
        className="blob-1 absolute rounded-full blur-[120px]"
        style={{
          width: 420,
          height: 420,
          top: "8%",
          right: "-5%",
          background: isLight
            ? "rgba(2, 91, 223, 0.045)"
            : "rgba(2, 91, 223, 0.06)",
        }}
      />
      <motion.div
        className="blob-2 absolute rounded-full blur-[100px]"
        style={{
          width: 340,
          height: 340,
          bottom: "10%",
          left: "-4%",
          background: isLight
            ? "rgba(7, 12, 72, 0.03)"
            : "rgba(7, 12, 72, 0.04)",
        }}
      />
      <motion.div
        className="blob-3 absolute rounded-full blur-[90px]"
        style={{
          width: 260,
          height: 260,
          top: "55%",
          right: "25%",
          background: isLight
            ? "rgba(2, 91, 223, 0.03)"
            : "rgba(2, 91, 223, 0.04)",
        }}
      />

      {/* ── Decorative rings ── */}
      <div
        className="absolute rounded-full"
        style={{
          width: 500,
          height: 500,
          top: "-12%",
          right: "-8%",
          border: `1px solid ${isLight ? "rgba(2, 91, 223, 0.06)" : "rgba(2, 91, 223, 0.08)"}`,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          bottom: "-6%",
          left: "-6%",
          border: `1px solid ${isLight ? "rgba(7, 12, 72, 0.04)" : "rgba(7, 12, 72, 0.06)"}`,
        }}
      />

      {/* ── Subtle grid overlay ── */}
      <div
        className="absolute inset-0"
        style={{
          opacity: isLight ? 0.025 : 0.035,
          backgroundImage:
            "linear-gradient(rgba(7,12,72,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(7,12,72,0.15) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* ── Slow-moving gradient mesh ── */}
      <div
        className={isLight ? "gradient-mesh" : "gradient-mesh"}
        style={{
          position: "absolute",
          inset: 0,
          opacity: isLight ? 0.6 : 0.8,
        }}
      />
    </div>
  );
}
