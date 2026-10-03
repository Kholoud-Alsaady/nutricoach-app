import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F9F9F7",
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F3F4F0",
          card: "#FFFFFF",
          hover: "#F7F8F5",
        },
        ink: {
          primary: "#1A1D1A",
          secondary: "#6B726A",
          muted: "#9CA39B",
        },
        border: {
          DEFAULT: "#EAECE8",
          subtle: "#F0F2EE",
          strong: "#D6D9D2",
        },
        brand: {
          DEFAULT: "#4C7C44",
          hover: "#3F6838",
          tint: "#EAF2E8",
          dark: "#2A4726",
        },
        status: {
          success: "#3D7842",
          warning: "#D27C2C",
          danger: "#C3483C",
          info: "#4A6B82",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      boxShadow: {
        hairline: "0 1px 2px 0 rgba(26, 29, 26, 0.03)",
        card: "0 1px 3px 0 rgba(26, 29, 26, 0.04), 0 1px 2px -1px rgba(26, 29, 26, 0.02)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
        fast: "120ms",
        normal: "180ms",
      },
      maxWidth: {
        app: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
