/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aqi: {
          good: "#10b981",       // 0 - 50: Good
          moderate: "#eab308",   // 51 - 100: Satisfactory / Moderate
          poor: "#f97316",       // 101 - 200: Moderate / Poor
          unhealthy: "#ef4444",  // 201 - 300: Unhealthy / Very Poor
          severe: "#a855f7",     // 301 - 400: Severe
          hazardous: "#881337",  // 401 - 500+: Hazardous
        }
      }
    },
  },
  plugins: [],
};
