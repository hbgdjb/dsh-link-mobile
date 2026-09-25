// mobile/src/features/history.tsx — 历史检索 + 计划任务（docs/03 §5 #9）

import React, { useState } from 'react';
import { api } from '../api/rpc';
import { navigate } from '../app/router';
import { Button, Card, EmptyState, ErrorState, ListRow, Skeleton } from '../ui/base';

export const HistoryPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ sessionId: string; title?: string; snippet?: string; ts?: number }[]>([]);
  const [schedules, setSchedules] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const r = await api.historySearch(query.trim());
      setHits((r.hits ?? []) as typeof hits);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const loadSchedules = async () => {
    try { setSchedules(((await api.scheduleList()).records ?? [])); }
    catch { /* 计划任务只读展示，失败静默降级 */ }
  };
  React.useEffect(() => { void loadSchedules(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void search(); }}
          placeholder="搜索历史会话…" aria-label="搜索历史"
          style={{
            flex: 1, minHeight: 40, padding: '0 12px',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 'var(--dsh-radius-m)', color: 'var(--dsw-alias-label-primary)', font: 'inherit',
          }} />
        <Button onClick={() => void search()}>搜索</Button>
      </div>

      {loading && <Skeleton height={56} count={3} />}
      {error && <ErrorState message={error} />}
      {!loading && !error && searched && hits.length === 0 && <EmptyState text="没有匹配的记录" />}
      {!loading && hits.map((h, i) => (
        <ListRow key={i} title={h.title ?? h.sessionId}
          subtitle={h.snippet}
          onClick={() => navigate('chat', h.sessionId)} />
      ))}

      <h3 style={{ margin: '20px 16px 8px', fontSize: 'var(--dsh-text-m)' }}>计划任务</h3>
      <div style={{ padding: '0 16px 16px', display: 'grid', gap: 8 }}>
        {schedules.length === 0 && <Card><span style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-s)' }}>暂无计划任务</span></Card>}
        {schedules.map((sc, i) => (
          <Card key={i} style={{ fontSize: 'var(--dsh-text-s)' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'var(--dsh-text-s)/1.5 var(--dsh-font-mono)' }}>
              {JSON.stringify(sc, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
};
