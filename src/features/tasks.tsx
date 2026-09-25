// mobile/src/features/tasks.tsx — 任务 / 终端（docs/03 §5 #6）

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/rpc';
import { useStoreState } from '../state/store';
import { Button, Card, EmptyState, ErrorState, ListRow, Skeleton } from '../ui/base';
import { getLink } from '../net/link-client';

interface Job { id: string; title?: string; status?: string; pid?: number }
interface TermFrame { streamId: string; frame?: { data?: string }; error?: { message: string } }

export const TasksPage: React.FC = () => {
  const s = useStoreState();
  const [tab, setTab] = useState<'jobs' | 'terminal'>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [termOut, setTermOut] = useState('');
  const [input, setInput] = useState('');
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try { setJobs(((await api.listJobs()).jobs ?? []) as Job[]); }
      catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, []);

  // 终端输出订阅（骨架：跟随会话终端，实际需 terminal.create 拿 id）
  useEffect(() => {
    if (tab !== 'terminal' || !s.activeSessionId) return;
    const streamId = `st_${Date.now().toString(36)}`;
    void api.follow(s.activeSessionId, streamId).catch(() => undefined);
    const off = getLink().subscribe('term.frame', (params) => {
      const f = params as unknown as TermFrame;
      if (f.frame?.data) setTermOut(prev => (prev + f.frame!.data).slice(-20000));
      if (f.error) setError(f.error.message);
    });
    return () => off();
  }, [tab, s.activeSessionId]);

  useEffect(() => { termRef.current?.scrollTo({ top: termRef.current.scrollHeight }); }, [termOut]);

  const sendTerm = async () => {
    if (!input.trim() || !s.activeSessionId) return;
    const line = input; setInput('');
    setTermOut(prev => prev + `$ ${line}\n`);
    try { await api.writeTerminal(s.activeSessionId, 't0', line + '\n'); }   // expectConfirm → 弹确认
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <Button variant={tab === 'jobs' ? 'primary' : 'secondary'} block onClick={() => setTab('jobs')}>任务</Button>
        <Button variant={tab === 'terminal' ? 'primary' : 'secondary'} block onClick={() => setTab('terminal')}>终端</Button>
      </div>

      {tab === 'jobs' && (
        loading ? <Skeleton height={56} count={4} />
          : error ? <ErrorState message={error} />
          : jobs.length === 0 ? <EmptyState text="暂无后台任务" />
          : jobs.map(j => (
            <ListRow key={j.id}
              title={j.title ?? j.id}
              subtitle={`${j.status ?? ''}${j.pid ? ` · pid ${j.pid}` : ''}`}
              trailing={<Button variant="ghost" onClick={() => void api.killJob(j.id)}>终止</Button>} />
          ))
      )}

      {tab === 'terminal' && (
        <div style={{ padding: '0 16px 16px' }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div ref={termRef} style={{
              height: '50vh', overflowY: 'auto', padding: 12, margin: 0,
              font: 'var(--dsh-text-s)/1.5 var(--dsh-font-mono)',
              background: 'var(--dsw-alias-bg-layer-2)',
              color: 'var(--dsw-alias-label-primary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{termOut || '$ （连接电脑端会话终端后可输入）'}</div>
          </Card>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void sendTerm(); }}
              placeholder="输入命令…" aria-label="终端输入"
              style={{
                flex: 1, minHeight: 44, padding: '0 12px', font: 'var(--dsh-text-s) var(--dsh-font-mono)',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: 'var(--dsh-radius-m)', color: 'var(--dsw-alias-label-primary)',
              }} />
            <Button onClick={() => void sendTerm()}>执行</Button>
          </div>
          <p style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-xs)' }}>
            终端写入为敏感操作，需二次确认（可在电脑端配置关闭）。
          </p>
        </div>
      )}
      {error && <ErrorState message={error} onRetry={() => setError(null)} />}
    </div>
  );
};
