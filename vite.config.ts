import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  plugins: [
    react(),
    {
      name: 'subdirectory-html-links',
      transformIndexHtml(html) {
        const base = process.env.VITE_BASE_PATH;
        if (!base || base === './') return html;
        return html.replaceAll('href="/app"', `href="${base}app"`).replaceAll('href="/manual/"', `href="${base}manual/"`);
      },
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Rirekisho Studio',
        short_name: 'Rirekisho Studio',
        description: '個人情報を端末内で扱う、日本向け履歴書作成アプリ',
        lang: 'ja',
        theme_color: '#2f5d50',
        background_color: '#f3f5f1',
        display: 'standalone',
        scope: process.env.VITE_BASE_PATH ?? './',
        start_url: process.env.VITE_BASE_PATH ? `${process.env.VITE_BASE_PATH}app` : '/app',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,md,svg,png,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/manual\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/zipcloud\.ibsnet\.co\.jp\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
