import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { defineExtensionManifest } from './src/manifest.config.js'

export default defineConfig(() => {
  const target = process.env.EXTENSION_TARGET || 'chrome'
  const manifest = defineExtensionManifest({ target })

  return {
    plugins: [
      vue(),
      crx({ manifest }),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    publicDir: 'public',
  }
})
