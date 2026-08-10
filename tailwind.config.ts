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
        background: "#08090C",
        surface: "#111117",
        border: "#22222C",
        foreground: "#F0F0F5",
        muted: "#84848E",
        accent: "#6C6CE5",
        source: {
          blog: "#D9A64E",
          youtube: "#E5708A",
          x: "#B4B4C4",
          academic: "#4CBB8A",
        },
      },
      borderColor: {
        DEFAULT: "#22222C",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
