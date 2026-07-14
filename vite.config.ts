import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig(() => {
  const isTest = process.env.VITEST === 'true'

  return {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'scripts/**/*.test.mjs'],
    },
    plugins: [
      react(),
      ...(
        isTest
          ? []
          : [
              electron([
                {
                  entry: 'electron/main.ts',
                  vite: {
                    build: {
                      outDir: 'dist-electron',
                      rollupOptions: {
                        external: ['better-sqlite3']
                      }
                    }
                  }
                },
                {
                  entry: 'electron/preload.ts',
                  onstart(args) {
                    args.reload()
                  },
                  vite: {
                    build: {
                      outDir: 'dist-electron'
                    }
                  }
                }
              ])
            ]
      )
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
})
