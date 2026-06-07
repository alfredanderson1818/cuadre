import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base '/cuadre/' solo en build (GitHub Pages sirve bajo /cuadre/).
// En dev queda en '/' y el proxy /api apunta al backend local.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cuadre/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
}))
