// mobile/src/features/sessions.tsx — 会话列表（docs/03 §5 #1）

import React, { useEffect, useState } from 'react';
import { api } from '../api/rpc';
import { navigate } from '../app/router';
import { store, useStoreState, type SessionSummary } from '../state/store';
import { Button, EmptyState, ErrorState, ListRow, Skeleton } from '../ui/base';

export const SessionsPage: React.FC = () => {
  const s = useStoreState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const connected = s.connection.state === 'online';
      if (!connected) {
        // 离线：显示缓存骨架 + 离线提示（空态引导去连接）
        store.set({ sessions: JSON.parse(localStorage.getItem('dsh.sessions') ?? '[]') });
        return;
      }
      const res = await api.listSessions();
      const sessions = (res.sessions ?? []) as SessionSummary[];
      store.set({ sessions });
      localStorage.setItem('dsh.sessions', JSON.stringify(sessions));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-line */ }, [s.connection.state]);

  const create = async () => {
    try {
      const r = await api.createSession();
      navigate('chat', r.id);
    } catch (e) { setError((e as Error).message); }
  };

  const filtered = s.sessions.filter(x => !query || x.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div style={{ padding: '12px 16px 4px', display: 'flex', gap: 8 }}>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="搜索会话" aria-label="搜索会话"
          style={{
            flex: 1, minHeight: 40, padding: '0 12px',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 'var(--dsh-radius-m)',
            color: 'var(--dsw-alias-label-primary)', font: 'inherit',
          }}
        />
        <Button onClick={create}>新建</Button>
      </div>

      {loading && <Skeleton height={56} count={5} />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState text={s.connection.state === 'online' ? '还没有会话' : '尚未连接电脑，先去配对吧'}
          action={<Button onClick={() => navigate(s.connection.state === 'online' ? 'sessions' : 'pair')}>
            {s.connection.state === 'online' ? '新建会话' : '连接电脑'}
          </Button>} />
      )}
      {!loading && !error && filtered.map(x => (
        <ListRow key={x.id}
          title={x.title || '未命名会话'}
          subtitle={`${x.model ?? ''} ${x.running ? '· 运行中' : ''}`}
          trailing={<span style={{ fontSize: 'var(--dsh-text-xs)', color: 'var(--dsw-alias-label-secondary)' }}>
            {new Date(x.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>}
          onClick={() => navigate('chat', x.id)}
        />
      ))}
    </div>
  );
};
