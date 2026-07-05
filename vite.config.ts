import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project from https://<user>.github.io/companion-hr/,
  // so production builds need every asset URL prefixed with the repo name.
  // Local dev keeps serving from the root so `npm run dev` is unaffected.
  base: command === 'build' ? '/companion-hr/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
}))
