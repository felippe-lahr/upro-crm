import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Semantic tokens (swap automatically between light/dark)
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        sidebar: "var(--sidebar)",
        line: "var(--line)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        brand: {
          DEFAULT: "var(--brand)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          soft: "var(--brand-soft)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
