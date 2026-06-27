import { s } from "framer-motion/client";

// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Helvetica", "Arial", "sans-serif"],
        display: ["Transforma Mix", "Playfair Display", "Georgia", "serif"],
      },
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0eaff",
          500: "#4f6ef7",
          600: "#3a56e8",
          900: "#1a2570",
          blue: "#025bdf",
          navy: "#070c48",
          secondary: "#19eba0",
          navyLight: "#0f1560",
          dark: "#ffffff",
          charcoal: "#1a1a1a",
        },
      },
    },
  },
  plugins: [],
};
