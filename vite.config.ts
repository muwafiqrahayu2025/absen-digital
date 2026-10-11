import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png'],
        manifest: {
          name: 'ABDI Absen',
          short_name: 'ABDI',
          description: 'Aplikasi Absensi Digital Multi-Online (Pusat & Cabang)',
          theme_color: '#4f46e5',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/login',
          icons: [
            {
              src: 'icon-aplikasi/logo-circle-desktop.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icon-aplikasi/icon-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 3000000, // Memperbesar limit cache hingga 3MB untuk file JS besar
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}']
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // ── Proxy /api/* ke backend Express di port 3001 ──────────────────────
      // Di development: client fetch('/api/attendance') → diteruskan ke localhost:3001/api/attendance
      // Menghindari CORS issue dan menyembunyikan URL backend dari network tab.
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      sourcemap: false,
      // PERF-001: Naikkan warning limit — beberapa chunks besar karena ML libraries
      // yang sudah di-lazy-load (face-api, mediapipe). Ini normal dan acceptable.
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // ── Core React ─────────────────────────────────────────────
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/react-router-dom')) {
              return 'vendor-router';
            }

            // ── Firebase ────────────────────────────────────────────────
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase';
            }

            // ── Charts ──────────────────────────────────────────────────
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
              return 'vendor-charts';
            }

            // ── UI Utils ────────────────────────────────────────────────
            if (
              id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/react-hot-toast') ||
              id.includes('node_modules/motion') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge')
            ) {
              return 'vendor-ui';
            }

            // ── Date / Crypto utilities ─────────────────────────────────
            if (id.includes('node_modules/date-fns') || id.includes('node_modules/crypto-js')) {
              return 'vendor-utils';
            }

            // ── PERF-001: PDF & Excel — Lazy loaded chunks ────────────
            // jspdf + jspdf-autotable (~2MB) — hanya dimuat saat export laporan
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
              return 'async-pdf';
            }
            // xlsx (~1.5MB) — hanya dimuat saat export Excel
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/file-saver')) {
              return 'async-excel';
            }

            // ── PERF-001: ML / Vision — Async chunks ──────────────────
            // face-api.js (~6MB) + @mediapipe/tasks-vision (~15MB+)
            // Keduanya harus TIDAK masuk bundle utama — dimuat on-demand
            if (id.includes('node_modules/face-api') || id.includes('node_modules/@mediapipe')) {
              return 'async-vision-ml';
            }

            // ── QR Libraries ────────────────────────────────────────────
            if (id.includes('node_modules/html5-qrcode') || id.includes('node_modules/qrcode') || id.includes('node_modules/qr-code-styling')) {
              return 'async-qr';
            }

            // ── Zustand state ───────────────────────────────────────────
            if (id.includes('node_modules/zustand')) {
              return 'vendor-state';
            }
          },
        },
      },
    },
  };
});
