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
        brand: {
          50: "#f2f7f5",
          100: "#e0ebe6",
          200: "#c3d8cf",
          300: "#9bbdb0",
          400: "#709c8d",
          500: "#4e7f70",
          600: "#3a6558",
          700: "#2e5047",
          800: "#1f3a33",
          900: "#132621",
          950: "#0b1714",
        },
        sand: {
          50: "#faf9f6",
          100: "#f4f1ea",
          200: "#e8e2d5",
          300: "#d7ccb8",
          400: "#c0af94",
          500: "#ab9375",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
