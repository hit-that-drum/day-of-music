/** @type {import('tailwindcss').Config} */
module.exports = {
  // Mobile uses Tailwind v3 via NativeWind 4. The web app uses Tailwind v4
  // independently — the two configs do not need to match.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        paper: "#f7f6f1",
        accent: "#ef5d75",
      },
      fontFamily: {
        display: ["System"],
      },
    },
  },
  plugins: [],
};
