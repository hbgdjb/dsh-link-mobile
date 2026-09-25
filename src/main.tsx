// mobile/src/main.tsx — 入口

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTheme, store } from './state/store';
import './ui/tokens.css';

applyTheme((localStorage.getItem('dsh.theme') as 'system' | 'light' | 'dark') ?? 'system');
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const t = localStorage.getItem('dsh.theme') ?? 'system';
  if (t === 'system') applyTheme('system');
});

// 断网/恢复：驱动 link-client 重连与离线条
window.addEventListener('online', () => store.setConnection({ state: 'reconnecting' }));
window.addEventListener('offline', () => store.setConnection({ state: 'offline' }));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) store.setConnection({});   // 前台恢复时 ping 探活（link-client 订阅）
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
