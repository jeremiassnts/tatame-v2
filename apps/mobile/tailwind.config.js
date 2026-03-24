/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["Poppins_400Regular"],
        "poppins-medium": ["Poppins_500Medium"],
        "poppins-semibold": ["Poppins_600SemiBold"],
        "poppins-bold": ["Poppins_700Bold"],
      },
      colors: {
        background: "#0C0C0C",
        surface: "#1A1A1A",
        "surface-border": "#2A2A2A",
        accent: "#A078E8",
        "accent-dark": "#7C5CBF",
        "accent-translucent": "rgba(160,120,232,0.125)",
        primary: "#FFFFFF",
        muted: "#ABABAB",
      },
    },
  },
  plugins: [],
};
