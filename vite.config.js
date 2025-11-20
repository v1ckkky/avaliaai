// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',              // importante pro Android WebView
  build: { outDir: 'dist' } // onde ficará o site pronto
})
