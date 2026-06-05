import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      include: '**/*.{jsx,js,tsx,mjs}',
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)/,
              priority: 30,
            },
            {
              name: 'ui-vendor',
              test: /node_modules[\\/](lucide-react|framer-motion|@headlessui|motion-dom|motion-utils)/,
              priority: 25,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
