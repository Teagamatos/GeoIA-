/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Azul-marinho da marca (foursales-company.com) — usado na sidebar.
        ink: {
          950: "#04101F",
          900: "#011E41",
          800: "#0C2C52",
          700: "#123B66",
          600: "#2C5488",
        },
        // Texto claro sobre a sidebar navy.
        paper: {
          100: "#FFFFFF",
          200: "#C9D3E0",
          300: "#8FA0BA",
        },
        // Fundo e bordas do conteúdo principal (claro, como o site institucional).
        surface: {
          0: "#FFFFFF",
          50: "#F6F8FB",
          100: "#EEF1F6",
          200: "#E1E6EE",
        },
        // Texto escuro sobre o conteúdo claro.
        slate: {
          900: "#0B1A2E",
          700: "#42506A",
          500: "#76839C",
          400: "#9AA6BC",
          300: "#C4CBD8",
        },
        signal: {
          amber: "#C9973E",
          teal: "#1E9E86",
          rose: "#D6455F",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
