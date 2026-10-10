import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' — приложение работает из любой папки (GitHub Pages, Netlify, локально).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon-192.png', 'icon-512.png', 'sirian/*.jpg'],
      manifest: {
        name: 'Моя Мастерская',
        short_name: 'Мастерская',
        description: 'Личный инженерный мир знаний, исследований и проектов',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d1828',
        theme_color: '#0d1828',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Оболочка приложения кэшируется для офлайна. Данные пользователя — в IndexedDB.
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: { port: 5173, host: true },
});
