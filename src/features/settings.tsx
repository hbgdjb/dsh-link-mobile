// mobile/src/features/settings.tsx — 设置：外观 / 连接 / 通知偏好 / 说明（docs/03 §5 #11）

import React, { useEffect, useState } from 'react';
import { api } from '../api/rpc';
import { navigate } from '../app/router';
import { store, useStoreState, type AppState } from '../state/store';
import { ListRow, Sheet } from '../ui/base';

export const SettingsPage: React.FC = () => {
  const s = useStoreState();
  const [info, setInfo] = useState<{ host?: string; version?: string }>({});
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => { api.sysInfo().then(setInfo).catch(() => undefined); }, []);

  const themeLabel = { system: '跟随系统', light: '浅色', dark: '深色' } as const;

  return (
    <div style={{ padding: '12px 0 24px' }}>
      <Section title="外观">
        <ListRow title="主题" subtitle={themeLabel[s.theme]} onClick={() => setThemeOpen(true)} />
      </Section>

      <Section title="连接">
        <ListRow title="连接与配对" subtitle={s.connection.host ? `${s.connection.host.name}:${s.connection.host.port} · ${s.connection.tier ?? ''}` : '未连接'}
          onClick={() => navigate('pair')} />
        <ListRow title="已管理设备" subtitle="查看 / 调整权限 / 解绑（需 owner）"
          onClick={() => navigate('pair')} />
        <ListRow title="连接状态" subtitle={{ online: '已连接', reconnecting: '重连中', offline: '已离线', authing: '验证中', connecting: '连接中', error: '错误', idle: '未连接' }[s.connection.state]}
          trailing={<span style={{ fontSize: 'var(--dsh-text-xs)', color: 'var(--dsw-alias-label-secondary)' }}>
            队列 {s.connection.queueSize}
          </span>} />
      </Section>

      <Section title="能力">
        <ListRow title="模型与参数" onClick={() => navigate('models')} />
        <ListRow title="日志" onClick={() => navigate('logs')} />
        <ListRow title="插件管理" subtitle="需要 admin/owner 权限" onClick={() => navigate('plugins')} />
        <ListRow title="账号与密钥" subtitle="密钥仅显示元数据" onClick={() => navigate('account')} />
        <ListRow title="通知" onClick={() => navigate('notifications')} />
      </Section>

      <Section title="关于">
        <ListRow title="电脑" subtitle={info.host ?? '—'} />
        <ListRow title="版本" subtitle={`${info.version ?? '—'} · dlp/1`} />
        <ListRow title="协议文档" subtitle="docs/02-protocol.md" />
      </Section>

      <Sheet open={themeOpen} title="主题" onClose={() => setThemeOpen(false)}>
        {(['system', 'light', 'dark'] as AppState['theme'][]).map(t => (
          <ListRow key={t} title={themeLabel[t]}
            trailing={s.theme === t ? <span style={{ color: 'var(--dsw-alias-brand-primary)' }}>✓</span> : undefined}
            onClick={() => { store.set({ theme: t }); setThemeOpen(false); }} />
        ))}
      </Sheet>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ marginBottom: 20 }}>
    <h3 style={{
      margin: '0 16px 8px', fontSize: 'var(--dsh-text-xs)', fontWeight: 600,
      color: 'var(--dsw-alias-label-secondary)', textTransform: 'uppercase', letterSpacing: 0.4,
    }}>{title}</h3>
    <div style={{
      background: 'var(--dsw-alias-bg-layer-1)',
      borderTop: '1px solid var(--dsw-alias-border-l1)',
      borderBottom: '1px solid var(--dsw-alias-border-l1)',
    }}>{children}</div>
  </section>
);
