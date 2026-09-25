// mobile/src/state/store.ts — 极简订阅式全局状态（无第三方依赖）

import { useEffect, useState } from 'react';
import type { LinkState, Tier } from '../net/protocol';
import type { DiscoveredHost } from '../net/discovery';

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: number;
  running?: boolean;
  pinned?: boolean;
  model?: string;
}

export interface NotificationItem {
  id: string;
  kind: 'turn-done' | 'approval' | 'job-failed' | 'plugin' | 'system';
  title: string;
  body?: string;
  sessionId?: string;
  ts: number;
  read: boolean;
}

export interface AppState {
  theme: 'system' | 'light' | 'dark';
  connection: {
    state: LinkState;
    host?: DiscoveredHost;
    tier: Tier | null;
    queueSize: number;
    serverTimeSkew: number;
    error?: { code: string; message: string };
  };
  hosts: DiscoveredHost[];
  sessions: SessionSummary[];
  activeSessionId: string | null;
  notifications: NotificationItem[];
  pendingConfirm: { id: string; action: string; detail?: Record<string, unknown> } | null;
}

const initial: AppState = {
  theme: 'system',
  connection: { state: 'idle', tier: null, queueSize: 0, serverTimeSkew: 0 },
  hosts: [],
  sessions: [],
  activeSessionId: null,
  notifications: [],
  pendingConfirm: null,
};

type Listener = (s: AppState) => void;

class Store {
  private state: AppState = { ...initial };
  private listeners = new Set<Listener>();

  get(): Readonly<AppState> { return this.state; }

  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** 连接状态子树更新。 */
  setConnection(patch: Partial<AppState['connection']>): void {
    this.set(s => ({ connection: { ...s.connection, ...patch } }));
  }

  pushNotification(n: Omit<NotificationItem, 'id' | 'ts' | 'read'>): void {
    const item: NotificationItem = { ...n, id: `n_${Date.now().toString(36)}`, ts: Date.now(), read: false };
    this.set(s => ({ notifications: [item, ...s.notifications].slice(0, 200) }));
  }
}

export const store = new Store();

/** 主题应用（含系统跟随）。 */
export function applyTheme(theme: AppState['theme']): void {
  const dark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  localStorage.setItem('dsh.theme', theme);
}

/** React 订阅 hook（组件内使用）。 */
export function useStoreState(): Readonly<AppState> {
  const [state, setState] = useState<AppState>(() => store.get());
  useEffect(() => store.subscribe(setState), []);
  return state;
}
