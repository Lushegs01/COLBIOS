import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAF8",
        foreground: "#111111",
        ink: "#111111",
        muted: "#6B7280",
        line: "#E5E7EB",
        pine: {
          50: "#F1F7F4",
          100: "#DFF0E9",
          200: "#C2DFD3",
          300: "#93C5B1",
          400: "#5FA489",
          500: "#2F8567",
          600: "#0F6B51",
          700: "#0B5D4A",
          800: "#084234",
          900: "#063026",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "Inter",
          "-apple-system",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(17, 24, 39, 0.05)",
        soft: "0 1px 2px rgba(17, 24, 39, 0.04), 0 12px 32px -16px rgba(17, 24, 39, 0.14)",
        lift: "0 2px 4px rgba(17, 24, 39, 0.04), 0 24px 56px -20px rgba(17, 24, 39, 0.18)",
        device:
          "0 1px 2px rgba(17, 24, 39, 0.08), 0 40px 90px -28px rgba(17, 24, 39, 0.34)",
        elevated:
          "0 0 0 1px rgba(17, 24, 39, 0.03), 0 4px 8px -2px rgba(17, 24, 39, 0.06), 0 20px 48px -12px rgba(17, 24, 39, 0.12)",
        glow: "0 0 0 1px rgba(11, 93, 74, 0.08), 0 4px 16px -4px rgba(11, 93, 74, 0.14), 0 24px 48px -12px rgba(11, 93, 74, 0.08)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out both",
        "fade-in-up-delay": "fadeInUp 0.5s ease-out 0.1s both",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(11, 93, 74, 0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(11, 93, 74, 0.1)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
