/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#f9f9f9",
          100: "#eeeeee",
          200: "#d1d1d1",
          300: "#a3a3a3",
          400: "#5a5a5a",
          500: "#2f2f2f", // replace with #12031241 if needed
          600: "#1f1f1f",
          700: "#151515",
          800: "#0e0e0e",
          900: "#060606",
        },
        gloomy: {
          100: "#120312",
          200: "#1a0b1a",
          300: "#221122",
          400: "#2a162a",
        },
      },
      dropShadow: {
        glow: "0 0 10px rgba(255, 255, 255, 0.4)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.8s ease-out forwards",
        "slide-up": "slide-up 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};
