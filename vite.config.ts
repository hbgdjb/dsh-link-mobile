import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 手机端构建：PWA（可安装、离线壳）+ Capacitor 原生打包共用此产物。
// 局域网明文 ws:// 需要开发期关闭安全约束时用 dev: --secure false 或本文注释配置。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DSH 端手互联',
        short_name: 'DSH Link',
        theme_color: '#101014',
        background_color: '#101014',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    host: true,        // 局域网可访问（调试时手机直连电脑 IP）
    port: 5183,
    // https: false,    // ws:// 与 https 页面不兼容：PWA 用 https 域名调试时需 PC 端开 TLS
  },
  build: { target: 'es2022', sourcemap: true },
});
