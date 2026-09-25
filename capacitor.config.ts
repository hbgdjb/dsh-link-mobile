import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'local.dsh.link',
  appName: 'DSH Link',
  webDir: 'dist',
  backgroundColor: '#101014',
  // iOS/Android 打包后可获得 BLE、后台保活、通知等 PWA 受限能力
  plugins: {
    Keyboard: { resize: 'body' },
  },
};

export default config;
