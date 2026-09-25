// mobile/src/net/useLink.ts — LinkClient 与 store 的粘合（连接生命周期 + 事件路由 + 确认弹窗）

import { useEffect } from 'react';
import { getLink, LinkClient } from './link-client';
import { store } from '../state/store';
import type { EventName } from './protocol';

let client: LinkClient | null = null;

/** 由配对页在拿到 host 后调用。 */
export function ensureLink(host: { host: string; port: number; fp?: string; paired?: boolean }, pairingCode?: string): LinkClient {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${host.host}:${host.port}/dsh-link`;
  client = getLink({
    url,
    fp: host.fp,
    pairingCode,
    onState: (state, info) => store.setConnection({
      state,
      queueSize: info?.queueSize ?? store.get().connection.queueSize,
      error: info?.error,
    }),
    onEvent: (name, params, env) => handleEvent(name, params, env.sessionId),
    onConfirm: (id, action, detail) => store.set({ pendingConfirm: { id, action, detail } }),
  });
  client.connect();
  return client;
}

/** 敏感操作确认应答（App 的 ConfirmDialog 经 window 事件回流）。 */
function handleEvent(name: EventName, params: Record<string, unknown>, sessionId?: string) {
  const s = store.get();
  switch (name) {
    case 'session.added':
    case 'session.removed':
    case 'session.status':
    case 'session.activity':
      // 骨架：真实实现触发 session.list 增量刷新
      break;
    case 'notify.push':
      store.pushNotification({
        kind: (params.kind as never) ?? 'system',
        title: String(params.title ?? '来自电脑的通知'),
        body: params.body ? String(params.body) : undefined,
        sessionId: params.sessionId ? String(params.sessionId) : undefined,
      });
      break;
    case 'approval.request':
      store.set({ pendingConfirm: { id: String(params.id), action: 'Agent 请求审批', detail: params } });
      break;
    default:
      void s; void sessionId;
  }
}

/** App 挂载一次：网络恢复/前台切换 → 重连；确认事件 → link。 */
export function useLinkEffects(): void {
  useEffect(() => {
    const onOnline = () => client?.resumeNetwork();
    const onVisibility = () => { if (!document.hidden) client?.resumeNetwork(); };
    const onConfirm = (e: Event) => {
      const { id, approved } = (e as CustomEvent).detail as { id: string; approved: boolean };
      client?.respondConfirm(id, approved);
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('dsh:confirm', onConfirm);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('dsh:confirm', onConfirm);
    };
  }, []);
}
