// mobile/src/features/logs.tsx — 日志尾随（docs/03 §5 #7）

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/rpc';
import { Button, EmptyState, ErrorState } from '../ui/base';
import { getLink } from '../net/link-client';

type Level = 'all' | 'info' | 'warn' | 'error';
const LEVEL_COLOR: Record<Level, string> = {
  all: 'var(--dsw-alias-label-primary)',
  info: 'var(--dsw-alias-label-secondary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  error: 'var(--dsw-alias-state-error-primary)',
};

export const LogsPage: React.FC = () => {
  const [lines, setLines] = useState<{ text: string; level: Level }[]>([]);
  const [level, setLevel] = useState<Level>('all');
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const streamId = `sl_${Date.now().toString(36)}`;
    void api.tailLog(200, streamId).catch(e => setError((e as Error).message));
    const off = getLink().subscribe('log.line', (params) => {
      if (paused) return;
      const text = String(params.chunk ?? params.line ?? '');
      const lvl: Level = /error|fail/i.test(text) ? 'error' : /warn/i.test(text) ? 'warn' : 'info';
      setLines(prev => [...prev.slice(-999), { text, level: lvl }]);
    });
    return () => off();
  }, [paused]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [lines]);

  const shown = lines.filter(l => level === 'all' || l.level === level);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, padding: 16, alignItems: 'center' }}>
        {(['all', 'info', 'warn', 'error'] as Level[]).map(l => (
          <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l}
            style={{
              minHeight: 32, padding: '0 12px', borderRadius: 'var(--dsh-radius-pill)',
              border: '1px solid ' + (level === l ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'),
              background: level === l ? 'var(--dsw-alias-brand-primary)' : 'transparent',
              color: level === l ? '#fff' : 'var(--dsw-alias-label-secondary)',
              font: 'var(--dsh-text-xs) var(--dsh-font-sans)', cursor: 'pointer',
            }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => setPaused(p => !p)}>{paused ? '继续' : '暂停'}</Button>
        <Button variant="ghost" onClick={() => setLines([])}>清空</Button>
      </div>

      <div ref={boxRef} style={{
        flex: 1, overflowY: 'auto', margin: '0 16px 16px', padding: 12,
        background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 'var(--dsh-radius-m)',
        font: 'var(--dsh-text-xs)/1.6 var(--dsh-font-mono)',
        maxHeight: '60vh',
      }}>
        {error && <ErrorState message={error} />}
        {!error && shown.length === 0 && <EmptyState text="暂无日志（等待电脑端推送）" />}
        {shown.map((l, i) => (
          <div key={i} style={{ color: LEVEL_COLOR[l.level], whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l.text}</div>
        ))}
      </div>
    </div>
  );
};
