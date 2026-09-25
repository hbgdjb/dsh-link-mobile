// mobile/src/app/App.tsx — 外壳：底部导航 + 抽屉 + 安全区 + 离线条 + 二次确认挂载

import React, { useEffect, useState } from 'react';
import { navigate, RouteName, useRoute } from './router';
import { applyTheme, store, useStoreState } from '../state/store';
import { Button, ConfirmDialog, StatusDot } from '../ui/base';
import { SessionsPage } from '../features/sessions';
import { ChatPage } from '../features/chat';
import { TasksPage } from '../features/tasks';
import { FilesPage } from '../features/files';
import { SettingsPage } from '../features/settings';
import { ModelsPage } from '../features/models';
import { LogsPage } from '../features/logs';
import { PluginsPage } from '../features/plugins';
import { HistoryPage } from '../features/history';
import { NotificationsPage } from '../features/notifications';
import { AccountPage } from '../features/account';
import { PairPage } from '../features/pair';
import { useLinkEffects } from '../net/useLink';

const TABS: { name: RouteName; label: string; icon: string }[] = [
  { name: 'sessions', label: '会话', icon: '▤' },
  { name: 'tasks', label: '任务', icon: '◉' },
  { name: 'files', label: '文件', icon: '▢' },
  { name: 'history', label: '历史', icon: '◷' },
  { name: 'settings', label: '设置', icon: '⚙' },
];

/** “更多”抽屉可达的次级页面。 */
const DRAWER_ITEMS: { name: RouteName; label: string }[] = [
  { name: 'logs', label: '日志' },
  { name: 'plugins', label: '插件管理' },
  { name: 'notifications', label: '通知' },
  { name: 'models', label: '模型与参数' },
  { name: 'account', label: '账号与密钥' },
  { name: 'pair', label: '连接与配对' },
];

export const App: React.FC = () => {
  const route = useRoute();
  const s = useStoreState();
  const [drawer, setDrawer] = useState(false);
  useLinkEffects();

  useEffect(() => { applyTheme(s.theme); }, [s.theme]);

  // 会话内页把底部导航换成输入操作栏
  const inChat = route.name === 'chat';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* 顶栏 */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        minHeight: 48, padding: '0 16px',
        paddingTop: 'env(safe-area-inset-top)',
        background: 'var(--dsw-specific-sidebar-fill)',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button aria-label="菜单" onClick={() => setDrawer(true)} style={tabButtonStyle}>☰</button>
        <strong style={{ flex: 1, fontSize: 'var(--dsh-text-l)' }}>{titleOf(route.name)}</strong>
        <StatusDot state={s.connection.state === 'online' ? 'online'
          : s.connection.state === 'reconnecting' ? 'reconnecting'
          : s.connection.state === 'idle' ? 'idle' : 'offline'} />
        <button aria-label="通知" onClick={() => navigate('notifications')} style={tabButtonStyle}>
          ◔{s.notifications.filter(n => !n.read).length > 0 &&
            <sup style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{s.notifications.filter(n => !n.read).length}</sup>}
        </button>
      </header>

      {/* 离线条（队列提示） */}
      {s.connection.state === 'offline' && (
        <div role="status" style={{
          padding: '6px 16px', fontSize: 'var(--dsh-text-s)',
          background: 'var(--dsw-alias-state-warn-primary)', color: '#fff',
        }}>
          已离线，操作将在重连后发送（队列 {s.connection.queueSize}/200）
        </div>
      )}
      {s.connection.state === 'error' && s.connection.error && (
        <div role="alert" style={{
          padding: '6px 16px', fontSize: 'var(--dsh-text-s)',
          background: 'var(--dsw-alias-state-error-primary)', color: '#fff',
        }}>{s.connection.error.code} · {s.connection.error.message}</div>
      )}

      {/* 内容区 */}
      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <PageFor route={route.name} param={route.param} />
      </main>

      {/* 底部导航（会话内隐藏） */}
      {!inChat && (
        <nav aria-label="主导航" style={{
          display: 'flex',
          background: 'var(--dsw-alias-bg-layer-1)',
          borderTop: '1px solid ' + 'var(--dsw-alias-border-l1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          position: 'sticky', bottom: 0,
        }}>
          {TABS.map(t => {
            const active = route.name === t.name;
            return (
              <button key={t.name} aria-current={active ? 'page' : undefined}
                onClick={() => navigate(t.name)}
                style={{
                  ...tabButtonStyle, flex: 1, minHeight: 56,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
                  fontSize: 'var(--dsh-text-xs)',
                  background: 'transparent', border: 'none',
                }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* 抽屉 */}
      {drawer && (
        <div role="dialog" aria-modal="true" aria-label="更多"
          onClick={() => setDrawer(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--dsw-alias-bg-overlay)', opacity: 0.5, zIndex: 40 }} />
      )}
      <aside aria-hidden={!drawer} style={{
        position: 'fixed', top: 0, bottom: 0, left: 0, width: 'min(78vw, 320px)',
        background: 'var(--dsw-alias-bg-layer-1)', zIndex: 50,
        transform: drawer ? 'none' : 'translateX(-102%)',
        transition: 'transform var(--dsh-motion) var(--dsh-ease)',
        padding: 'calc(env(safe-area-inset-top) + 16px) 0 calc(env(safe-area-inset-bottom) + 16px)',
        boxShadow: 'var(--dsh-shadow-m)', overflowY: 'auto',
      }}>
        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--dsw-alias-border-l1)' }}>
          <div style={{ fontWeight: 700 }}>DSH 端手互联</div>
          <div style={{ fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            {s.connection.host?.name ?? '未连接'} · {s.connection.tier ?? '—'}
          </div>
        </div>
        {DRAWER_ITEMS.map(it => (
          <button key={it.name} onClick={() => { setDrawer(false); navigate(it.name); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '14px 16px', minHeight: 'var(--dsh-tap)',
              background: 'transparent', border: 'none', font: 'inherit',
              color: 'var(--dsw-alias-label-primary)',
              borderBottom: '1px solid var(--dsw-alias-border-l1)',
            }}>{it.label}</button>
        ))}
        <div style={{ padding: 16 }}>
          <Button variant="secondary" block onClick={() => { applyTheme(s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'dark' : 'dark'); store.set({ theme: s.theme === 'dark' ? 'light' : 'dark' }); }}>
            切换{ s.theme === 'dark' ? '浅色' : '深色' }
          </Button>
        </div>
      </aside>

      {/* 敏感操作二次确认（全局唯一入口） */}
      <ConfirmDialog
        open={!!s.pendingConfirm}
        action={s.pendingConfirm?.action ?? ''}
        detail={s.pendingConfirm ? JSON.stringify(s.pendingConfirm.detail, null, 2) : undefined}
        onApprove={() => { window.dispatchEvent(new CustomEvent('dsh:confirm', { detail: { id: s.pendingConfirm!.id, approved: true } })); store.set({ pendingConfirm: null }); }}
        onReject={() => { window.dispatchEvent(new CustomEvent('dsh:confirm', { detail: { id: s.pendingConfirm!.id, approved: false } })); store.set({ pendingConfirm: null }); }}
      />
    </div>
  );
};

const tabButtonStyle: React.CSSProperties = {
  minHeight: 44, minWidth: 44, padding: '0 8px',
  background: 'transparent', border: 'none', font: 'inherit',
  color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer',
};

function titleOf(name: RouteName): string {
  const all = [...TABS, ...DRAWER_ITEMS, { name: 'chat' as RouteName, label: '对话' }];
  return all.find(t => t.name === name)?.label ?? 'DSH';
}

function PageFor({ route, param }: { route: RouteName; param?: string }) {
  switch (route) {
    case 'sessions': return <SessionsPage />;
    case 'chat': return <ChatPage sessionId={param ?? ''} />;
    case 'tasks': return <TasksPage />;
    case 'files': return <FilesPage />;
    case 'settings': return <SettingsPage />;
    case 'models': return <ModelsPage />;
    case 'logs': return <LogsPage />;
    case 'plugins': return <PluginsPage />;
    case 'history': return <HistoryPage />;
    case 'notifications': return <NotificationsPage />;
    case 'account': return <AccountPage />;
    case 'pair': return <PairPage />;
    default: return <SessionsPage />;
  }
}
