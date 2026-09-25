// mobile/src/api/rpc.ts — 类型化远程调用封装（全部能力经此走 PC，不本地执行 DSH 逻辑）

import { getLink } from '../net/link-client';
import type { Method } from '../net/protocol';
import type { SessionSummary } from '../state/store';

type Params = Record<string, unknown>;

async function call<M extends Method, T = unknown>(method: M, params: Params = {}, opts?: { expectConfirm?: boolean; timeoutMs?: number }): Promise<T> {
  return getLink().call<T>(method, params, opts);
}

export const api = {
  // 会话
  listSessions: (p?: Params) => call<'session.list', { sessions: SessionSummary[] }>('session.list', p ?? {}),
  searchSessions: (q: string) => call<'session.search', { hits: unknown[] }>('session.search', { query: q }),
  page: (sessionId: string, cursor?: string) =>
    call<'session.page', { messages: unknown[]; next?: string }>('session.page', { sessionId, cursor }),
  createSession: (p?: { cwd?: string }) => call<'session.create', { id: string }>('session.create', p ?? {}),
  prompt: (sessionId: string, text: string, attachments?: string[]) =>
    call<'session.prompt', { queued: boolean }>('session.prompt', { sessionId, text, attachments }, { timeoutMs: 60000 }),
  cancel: (sessionId: string) => call<'session.cancel', unknown>('session.cancel', { sessionId }),
  follow: (sessionId: string, streamId: string, fromSeq?: number) =>
    call<'session.follow', { streamId: string }>('session.follow', { sessionId, streamId, fromSeq }),
  modelCatalog: () => call<'session.modelCatalog', { models: unknown[] }>('session.modelCatalog'),
  selectModel: (sessionId: string, model: string) => call<'session.selectModel', unknown>('session.selectModel', { sessionId, model }),

  // 文件
  listFiles: (path: string, workspaceId?: string) =>
    call<'file.list', { entries: unknown[] }>('file.list', { path, workspaceId }),
  readFile: (path: string, offset = 0, length = 65536) =>
    call<'file.read', { text: string }>('file.read', { path, offset, length }),
  startUpload: (name: string, size: number, sessionId?: string) =>
    call<'file.upload.start', { uploadId: string }>('file.upload.start', { name, size, sessionId }),
  download: (path: string) => call<'file.download', { chunks: number }>('file.download', { path }),

  // 任务 / 终端 / 日志
  listJobs: () => call<'job.list', { jobs: unknown[] }>('job.list'),
  killJob: (jobId: string) => call<'job.kill', unknown>('job.kill', { jobId }),
  listTerminals: (sessionId: string) => call<'terminal.list', { terminals: unknown[] }>('terminal.list', { sessionId }),
  writeTerminal: (sessionId: string, id: string, data: string) =>
    call<'terminal.write', unknown>('terminal.write', { sessionId, id, data }, { expectConfirm: true }),
  tailLog: (lines: number, streamId: string) => call<'log.tail', { streamId: string }>('log.tail', { lines, streamId }),

  // 插件（敏感：全部 expectConfirm）
  listPlugins: () => call<'plugin.listPlugins', { plugins: unknown[] }>('plugin.listPlugins'),
  listBundles: () => call<'plugin.listBundles', { bundles: unknown[] }>('plugin.listBundles'),
  setBundleEnabled: (name: string, enabled: boolean) =>
    call<'plugin.setBundleEnabled', unknown>('plugin.setBundleEnabled', { name, enabled }, { expectConfirm: true }),
  installBundle: (spec: string) =>
    call<'plugin.installBundle', { requestId: string }>('plugin.installBundle', { spec }, { expectConfirm: true, timeoutMs: 120000 }),
  removeBundle: (name: string) =>
    call<'plugin.removeBundle', unknown>('plugin.removeBundle', { name }, { expectConfirm: true }),

  // 历史 / 计划
  historySearch: (query: string) => call<'history.search', { hits: unknown[] }>('history.search', { query }),
  scheduleList: () => call<'schedule.list', { records: unknown[] }>('schedule.list', {}),

  // 设置 / 账号 / 设备
  settingsDescribe: () => call<'settings.describe', { descriptors: unknown[] }>('settings.describe'),
  settingsSet: (entry: string, change: Record<string, unknown>) =>
    call<'settings.set', unknown>('settings.set', { entry, change }, { expectConfirm: true }),
  credentialsList: () => call<'credentials.list', { records: unknown[] }>('credentials.list'),
  accountState: () => call<'account.state', { state: string }>('account.state'),
  deviceList: () => call<'device.list', { devices: unknown[] }>('device.list'),
  deviceGrant: (deviceId: string, tier: string) =>
    call<'device.grant', unknown>('device.grant', { deviceId, tier }, { expectConfirm: true }),
  deviceRevoke: (deviceId: string) =>
    call<'device.revoke', unknown>('device.revoke', { deviceId }, { expectConfirm: true }),

  sysInfo: () => call<'sys.info', { host: string; version: string }>('sys.info'),
};
