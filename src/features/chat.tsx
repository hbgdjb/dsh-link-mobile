// mobile/src/features/chat.tsx — 对话（docs/03 §5 #2 + #5 代码高亮复制）

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/rpc';
import { navigate } from '../app/router';
import { useStoreState } from '../state/store';
import { Button, CodeBlock, EmptyState, ErrorState, Skeleton } from '../ui/base';
import { getLink } from '../net/link-client';

interface Msg {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  code?: { lang: string; content: string };
  ts: number;
}

export const ChatPage: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const s = useStoreState();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 拉历史 + 订阅流
  useEffect(() => {
    let off: (() => void) | undefined;
    (async () => {
      setLoading(true); setError(null);
      try {
        const page = await api.page(sessionId);
        setMsgs((page.messages ?? []) as unknown as Msg[]);
        const streamId = `sf_${sessionId}_${Date.now().toString(36)}`;
        await api.follow(sessionId, streamId);
        off = getLink().subscribe(`session.frame:${sessionId}`, (params) => {
          const frame = params.frame as Partial<Msg> | undefined;
          if (!frame) return;
          setMsgs(prev => {
            const i = prev.findIndex(m => m.id === frame.id);
            if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], ...frame } as Msg; return next; }
            return [...prev, frame as Msg];
          });
        });
      } catch (e) {
        setError((e as Error).message);
      } finally { setLoading(false); }
    })();
    return () => off?.();
  }, [sessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft(''); setSending(true);
    const tempId = `local_${Date.now().toString(36)}`;
    setMsgs(prev => [...prev, { id: tempId, role: 'user', text, ts: Date.now() }]);
    try {
      await api.prompt(sessionId, text);
    } catch (e) {
      setError((e as Error).message);
      setDraft(text);   // 失败回填，可重发
    } finally { setSending(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶栏（会话内替代全局头部下沿：返回 + 标题） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)' }}>
        <button aria-label="返回" onClick={() => navigate('sessions')}
          style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--dsw-alias-label-primary)', minHeight: 44 }}>‹</button>
        <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.sessions.find(x => x.id === sessionId)?.title ?? '对话'}
        </span>
        <Button variant="ghost" onClick={() => navigate('models')}>模型</Button>
        <Button variant="ghost" onClick={() => void api.cancel(sessionId)}>停止</Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 4px' }}>
        {loading && <Skeleton height={48} count={3} />}
        {!loading && error && <ErrorState message={error} onRetry={() => navigate('chat', sessionId)} />}
        {!loading && !error && msgs.length === 0 &&
          <EmptyState text="发送第一条消息，电脑端 Agent 将开始工作" />}
        {msgs.map(m => (
          <div key={m.id} style={{
            margin: '8px 0', display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '86%', padding: '10px 14px',
              borderRadius: 'var(--dsh-radius-l)',
              background: m.role === 'user' ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
              color: m.role === 'user' ? '#fff' : 'var(--dsw-alias-label-primary)',
              border: m.role === 'user' ? 'none' : '1px solid var(--dsw-alias-border-l1)',
              fontSize: 'var(--dsh-text-m)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.text}
              {m.code && <div style={{ marginTop: 8 }}><CodeBlock code={m.code.content} lang={m.code.lang} /></div>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入操作栏（替代底部导航） */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 12px calc(8px + env(safe-area-inset-bottom))',
        background: 'var(--dsw-alias-bg-layer-1)', borderTop: '1px solid var(--dsw-alias-border-l1)',
        position: 'sticky', bottom: 0,
      }}>
        <input
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send(); }}
          placeholder="输入消息…" aria-label="消息输入"
          style={{
            flex: 1, minHeight: 44, padding: '0 14px',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 'var(--dsh-radius-pill)',
            color: 'var(--dsw-alias-label-primary)', font: 'inherit',
          }}
        />
        <Button onClick={() => void send()} loading={sending} aria-label="发送">发送</Button>
      </div>
    </div>
  );
};
