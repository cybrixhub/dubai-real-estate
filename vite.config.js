import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// three.js / R3F are only reached through dynamic import() (hero, showcase,
// snapshot renderer), so they stay out of the critical path automatically.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  worker: { format: 'es' }, // snapshot renderer worker (OffscreenCanvas)
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    modulePreload: { resolveDependencies: (_, deps, { hostType }) => (hostType === 'html' ? deps.filter((d) => !/three|r3f|Scene/.test(d)) : deps) },
  },
})
