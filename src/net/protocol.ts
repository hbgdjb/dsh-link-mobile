// mobile/src/net/protocol.ts — dlp/1 类型（与 ../protocol/envelope.schema.json 对齐）

export const PROTO_VERSION = 1 as const;
export const WS_SUBPROTOCOL = 'dlp.1';

export type Kind =
  | 'hello' | 'auth' | 'resume'
  | 'req' | 'res' | 'evt' | 'ack'
  | 'ping' | 'pong' | 'error' | 'confirm';

export interface SecurePayload { n: string; ct: string }

export interface LinkError {
  code:
    | 'BAD_ENVELOPE' | 'DECRYPT_FAILED' | 'UNKNOWN_METHOD' | 'FORBIDDEN'
    | 'CONFIRM_TIMEOUT' | 'DECLINED' | 'RATE_LIMITED' | 'OFFLINE_QUEUE_FULL'
    | 'UPSTREAM' | 'TIMEOUT' | 'NOT_PAIRED' | 'KEY_EXPIRED';
  message: string;
  retryable?: boolean;
  detail?: Record<string, unknown>;
}

export interface Envelope {
  v: 1;
  id: string;
  kind: Kind;
  seq: number;
  ack?: number;
  ts: number;
  sessionId?: string;
  method?: string;
  params?: Record<string, unknown>;       // 握手帧明文
  payload?: SecurePayload;                // 业务帧密文（解密后为 params/result）
  result?: Record<string, unknown>;
  error?: LinkError;
  expectConfirm?: boolean;
  confirm?: {
    action: string;
    detail?: Record<string, unknown>;
    expiresAt?: number;
    approved?: boolean;
    channel?: 'pc' | 'device' | 'any' | 'both';
  };
  proof?: string;
}

/** UDP beacon（docs/02 §2）。 */
export interface Beacon {
  proto: 'dlp/1';
  kind: 'announce' | 'query' | 'answer';
  deviceId: string;
  name: string;
  port: number;
  fp?: string;
  paired?: boolean;
  auth?: 'code' | 'known-device';
}

/** 权限等级（与 PC 端 permissions.js 一致）。 */
export type Tier = 'viewer' | 'operator' | 'admin' | 'owner';
export const TIER_ORDER: Record<Tier, number> = { viewer: 1, operator: 2, admin: 3, owner: 4 };

/** 连接状态机。 */
export type LinkState =
  | 'idle'        // 未配对/未连接
  | 'connecting'
  | 'authing'
  | 'online'
  | 'reconnecting'
  | 'offline'     // 断线（队列中）
  | 'error';

/** 离线队列条目。 */
export interface QueuedReq {
  id: string;
  method: string;
  params: Record<string, unknown>;
  ts: number;
  expectConfirm?: boolean;
  bytes: number;
}

export interface HandshakeHello {
  proto: 'dlp/1';
  serverEphPub: string;   // base64 DER SPKI
  serverNonce: string;    // base64
  fp: string;
  serverTime: number;
}

export interface AuthParams {
  mode: 'pair' | 'device';
  clientEphPub: string;
  clientNonce: string;
  clientStaticPub?: string;   // pair
  codeProof?: string;         // pair: HMAC(confirmKey, "pair"|sn|cn)
  label?: string;
  deviceId?: string;          // device
  sig?: string;               // device: Ed25519("dlp-auth:sn:cn:clientEphPub")
  lastSeq?: number;           // resume 基线
}

/** 方法名联合（新增方法必须同步 protocol/methods.md 与 PC rpc.js）。 */
export type Method =
  | 'sys.ping' | 'sys.info'
  | 'device.list' | 'device.grant' | 'device.revoke'
  | 'session.list' | 'session.search' | 'session.page' | 'session.create'
  | 'session.rename' | 'session.fork' | 'session.prompt' | 'session.cancel'
  | 'session.updateQueue' | 'session.selectModel' | 'session.modelCatalog'
  | 'session.attach' | 'session.projections' | 'session.follow'
  | 'file.list' | 'file.stat' | 'file.read' | 'file.readBytes'
  | 'file.download' | 'file.upload.start' | 'file.preview' | 'file.watch' | 'file.write'
  | 'job.list' | 'job.follow' | 'job.kill'
  | 'terminal.list' | 'terminal.create' | 'terminal.follow'
  | 'terminal.write' | 'terminal.resize' | 'terminal.close'
  | 'log.tail'
  | 'plugin.listPlugins' | 'plugin.listBundles' | 'plugin.registries' | 'plugin.inspect'
  | 'plugin.setPluginEnabled' | 'plugin.setBundleEnabled'
  | 'plugin.installBundle' | 'plugin.waitForInstall' | 'plugin.removeBundle'
  | 'plugin.listVersionExemptions' | 'plugin.setVersionExemption'
  | 'history.search'
  | 'schedule.list' | 'schedule.catalog' | 'schedule.history'
  | 'schedule.create' | 'schedule.update' | 'schedule.delete'
  | 'settings.describe' | 'settings.get' | 'settings.set'
  | 'credentials.list' | 'credentials.set' | 'credentials.unset'
  | 'account.state' | 'account.signIn' | 'account.signOut'
  | 'stream.cancel' | 'approval.decide';

/** 事件名。 */
export type EventName =
  | 'session.frame' | 'session.added' | 'session.removed' | 'session.status' | 'session.activity'
  | 'agent.delta' | 'approval.request'
  | 'job.frame' | 'term.frame'
  | 'file.changed' | 'file.chunk'
  | 'log.line'
  | 'plugin.changed' | 'plugin.installLog' | 'plugin.installState'
  | 'notify.push' | 'sched.changed' | 'tools.changed'
  | 'device.online' | 'device.offline' | 'confirm.expired'
  | 'stream.cancel';

export type EventHandler = (params: Record<string, unknown>, env: Envelope) => void;
