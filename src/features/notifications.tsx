// mobile/src/features/notifications.tsx — 通知中心（docs/03 §5 #10）

import React from 'react';
import { navigate } from '../app/router';
import { store, useStoreState } from '../state/store';
import { Button, EmptyState, ListRow } from '../ui/base';

const KIND_ICON: Record<string, string> = {
  'turn-done': '✓', approval: '❗', 'job-failed': '✕', plugin: '⬡', system: 'ⓘ',
};

export const NotificationsPage: React.FC = () => {
  const s = useStoreState();

  const markAll = () => store.set(st => ({
    notifications: st.notifications.map(n => ({ ...n, read: true })),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px' }}>
        <Button variant="ghost" onClick={markAll}>全部已读</Button>
      </div>

      {s.notifications.length === 0 && (
        <EmptyState text="暂无通知。电脑端回合完成、需要审批或任务失败时会推送到这里。" />
      )}

      {s.notifications.map(n => (
        <ListRow key={n.id}
          icon={<span aria-hidden>{KIND_ICON[n.kind] ?? 'ⓘ'}</span>}
          title={<span style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</span>}
          subtitle={n.body ?? new Date(n.ts).toLocaleString()}
          onClick={() => {
            store.set(st => ({ notifications: st.notifications.map(x => x.id === n.id ? { ...x, read: true } : x) }));
            if (n.sessionId) navigate('chat', n.sessionId);
          }}
        />
      ))}
    </div>
  );
};
