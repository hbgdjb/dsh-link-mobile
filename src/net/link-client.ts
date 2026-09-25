// mobile/src/net/link-client.ts — 连接单例：WebSocket · 心跳 · 重连 · seq/ack · 离线队列 · 加解密
// 对应 docs/02-protocol.md §5–§6。

import type {
  AuthParams, Envelope, EventHandler, EventName, LinkError, LinkState, Method, QueuedReq,
} from './protocol';
import { PROTO_VERSION, WS_SUBPROTOCOL } from './protocol';
import * as ciphers from './crypto';

export interface LinkClientOptions {
  /** 建连地址，如 wss://192.168.1.5:9443/dsh-link */
  url: string;
  deviceId?: string;
  pairingCode?: string;      // mode=pair 时
  fp?: string;               // 二维码/发现得到的服务器指纹
  onState?: (s: LinkState, info?: { error?: LinkError; queueSize?: number }) => void;
  onEvent?: (name: EventName, params: Record<string, unknown>, env: Envelope) => void;
  onConfirm?: (confirmId: string, action: string, detail?: Record<string, unknown>) => void;
}

const PING_INTERVAL = 15000;
const DEAD_AFTER = 45000;
const BACKOFF = [500, 1000, 2000, 4000, 8000, 15000, 30000];
const QUEUE_MAX = 200;
const ITEM_MAX = 64 * 1024;

export class LinkClient {
  private ws: WebSocket | null = null;
  private state: LinkState = 'idle';
  private txSeq = 0;
  private rxSeq = 0;                 // 对方方向最大连续
  private sessionKey: ArrayBuffer | null = null;
  private deviceId = '';
  private serverNonce = '';
  private clientNonce = '';
  private ephemeral: Awaited<ReturnType<typeof ciphers.generateEphemeral>> | null = null;

  private queue: QueuedReq[] = [];          // 离线队列（acked 才出队）
  private awaitingAck = new Map<string, QueuedReq>(); // 已发送待 ack
  private resolvers = new Map<string, { resolve: (v: any) => void; reject: (e: Error & { code?: string }) => void; timer: number }>();
  private handlers = new Map<string, EventHandler>();  // 事件订阅（sessionId/name 组合键）
  private pingTimer = 0;
  private lastInbound = 0;
  private backoffIdx = 0;
  private reconnectTimer = 0;
  private paused = false;
  private lastSeq = 0;                 // resume 基线
  private seenIds = new Set<string>(); // 重连去重

  private opts: LinkClientOptions;

  constructor(opts: LinkClientOptions) {
    this.opts = opts;
    this.deviceId = opts.deviceId ?? localStorage.getItem('dsh.deviceId') ?? '';
  }

  get currentState() { return this.state; }
  get queueSize() { return this.queue.length + this.awaitingAck.size; }

  // ---------- 连接 ----------
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.#setState(this.backoffIdx > 0 ? 'reconnecting' : 'connecting');
    try {
      this.ws = new WebSocket(this.opts.url, WS_SUBPROTOCOL);
    } catch (e) {
      this.#scheduleReconnect();
      return;
    }
    this.ws.onopen = () => void this.#handshake();
    this.ws.onmessage = (ev) => void this.#onMessage(ev);
    this.ws.onclose = () => this.#onClose();
    this.ws.onerror = () => { /* onclose 统一处理 */ };
  }

  disconnect() {
    this.paused = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    this.ws?.close(1000, 'user');
    this.#setState('idle');
  }

  resumeNetwork() {  // 页面回到前台 / 网络恢复
    this.paused = false;
    this.backoffIdx = 0;
    if (this.state !== 'online') this.connect();
    else this.#pingNow();
  }

  // ---------- 握手 ----------
  async #handshake() {
    try {
      this.#setState('authing');
      this.ephemeral = await ciphers.generateEphemeral();
      this.clientNonce = ciphers.bufToB64(crypto.getRandomValues(new Uint8Array(16)).buffer);
      // hello 等待 PC 发送（见 #onMessage hello 分支）
    } catch {
      this.#fail({ code: 'DECRYPT_FAILED', message: '本机不支持 X25519，无法安全连接' });
    }
  }

  async #sendAuth(hello: { serverEphPub: string; serverNonce: string; fp: string }) {
    this.serverNonce = hello.serverNonce;
    const shared = await ciphers.x25519Shared(this.ephemeral!.priv, hello.serverEphPub);
    const params: AuthParams = { mode: 'device', clientEphPub: this.ephemeral!.pubDerB64, clientNonce: this.clientNonce, lastSeq: this.lastSeq };

    if (this.opts.pairingCode) {
      // 首次配对：码不直接上线，只发证明
      const ck = await ciphers.confirmKey(this.opts.pairingCode, hello.fp);
      params.mode = 'pair';
      params.clientStaticPub = (await ciphers.generateDeviceIdentity()).pubDerB64;
      params.codeProof = await ciphers.pairProof(ck, hello.serverNonce, this.clientNonce);
      params.label = navigator.userAgent.slice(0, 40);
      this.sessionKey = await ciphers.deriveSessionKey(shared, hello.serverNonce, this.clientNonce);
    } else {
      const identity = await this.#loadIdentity();
      params.clientStaticPub = identity.pubDerB64;
      params.sig = await ciphers.signChallenge(
        identity.priv,
        `dlp-auth:${hello.serverNonce}:${this.clientNonce}:${params.clientEphPub}`,
      );
      this.sessionKey = await ciphers.deriveSessionKey(shared, hello.serverNonce, this.clientNonce);
    }
    this.#sendRaw({ v: PROTO_VERSION, id: this.#id('auth'), kind: 'auth', seq: this.txSeq++, ts: Date.now(), params: params as unknown as Record<string, unknown> });
  }

  // ---------- 收消息 ----------
  async #onMessage(ev: MessageEvent) {
    this.lastInbound = Date.now();
    let env: Envelope;
    try { env = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }

    // 握手段（明文）
    if (env.kind === 'hello') {
      const hello = env.params as unknown as { serverEphPub: string; serverNonce: string; fp: string };
      await this.#sendAuth(hello);
      return;
    }
    if (env.kind === 'pong') return;

    // ack 累计
    if (typeof env.ack === 'number') this.#onAck(env.ack);

    if (env.kind === 'res' && env.result && 'accepted' in (env.result as object)) {
      await this.#onAuthed(env);
      return;
    }
    if (env.kind === 'error' && env.error) {
      const r = env.id ? this.resolvers.get(env.id) : undefined;
      if (r) { clearTimeout(r.timer); this.resolvers.delete(env.id); r.reject(Object.assign(new Error(env.error.message), env.error)); }
      else if (!env.id) this.#fail(env.error);
      return;
    }
    if (env.kind === 'res') {
      // res 捎带 ack：对应 req 出队（ack 累计语义见 docs/02 §5.2）
      if (env.id) { this.awaitingAck.delete(env.id); this.seenIds.add(env.id); }
      if (typeof env.ack === 'number') this.#onAck(env.ack);
      const r = env.id ? this.resolvers.get(env.id) : undefined;
      if (r) { clearTimeout(r.timer); this.resolvers.delete(env.id); r.resolve(env.result); }
      return;
    }
    if (env.kind === 'confirm') {
      this.opts.onConfirm?.(env.id, env.confirm?.action ?? '', env.confirm?.detail);
      return;
    }
    if (env.kind === 'evt' && env.method) {
      // 去重（resume 补发可能与实时重叠）
      if (this.seenIds.has(env.id)) { this.#sendAck(); return; }
      this.seenIds.add(env.id);
      if (this.seenIds.size > 2000) this.seenIds = new Set([...this.seenIds].slice(-1000));
      if (typeof env.seq === 'number') { this.rxSeq = Math.max(this.rxSeq, env.seq); this.lastSeq = env.seq; }
      let params = env.params;
      if (env.payload && this.sessionKey && this.deviceId) {
        try { params = await ciphers.open(this.sessionKey, this.deviceId, env.seq!, env.payload) as Record<string, unknown>; }
        catch { this.#fail({ code: 'DECRYPT_FAILED', message: '事件解密失败' }); return; }
      }
      this.opts.onEvent?.(env.method as EventName, params ?? {}, env);
      for (const [key, fn] of this.handlers) {
        if (key === env.method || (env.sessionId && key === `${env.method}:${env.sessionId}`)) fn(params ?? {}, env);
      }
      this.#sendAck();
      return;
    }
  }

  async #onAuthed(env: Envelope) {
    const r = env.result as { deviceId: string; tag: string; perms: { tier: string }; resume: { lastSeq: number } };
    this.deviceId = r.deviceId;
    localStorage.setItem('dsh.deviceId', this.deviceId);
    const ok = this.sessionKey && await ciphers.verifyTag(this.sessionKey, this.serverNonce, this.clientNonce, r.tag);
    if (!ok) { this.#fail({ code: 'DECRYPT_FAILED', message: '会话密钥确认失败' }); return; }
    this.backoffIdx = 0;
    this.#setState('online');
    this.#startHeartbeat();
    this.#flushQueue();               // 重发离线队列
    void env;
  }

  // ---------- 发送 ----------
  /** 远程调用（挂离线队列与超时）。 */
  call<T = unknown>(method: Method, params: Record<string, unknown> = {}, opts: { expectConfirm?: boolean; timeoutMs?: number } = {}): Promise<T> {
    const item: QueuedReq = {
      id: this.#id('req'), method, params, ts: Date.now(),
      expectConfirm: opts.expectConfirm, bytes: JSON.stringify(params).length,
    };
    if (item.bytes > ITEM_MAX) {
      return Promise.reject(Object.assign(new Error('操作数据过大'), { code: 'OFFLINE_QUEUE_FULL' }));
    }
    if (this.queueSize >= QUEUE_MAX) {
      return Promise.reject(Object.assign(new Error('离线队列已满，请稍后重试'), { code: 'OFFLINE_QUEUE_FULL' }));
    }
    const p = new Promise<T>((resolve, reject) => {
      this.resolvers.set(item.id, {
        resolve, reject,
        timer: window.setTimeout(() => {
          this.resolvers.delete(item.id);
          reject(Object.assign(new Error('请求超时'), { code: 'TIMEOUT', retryable: true }));
        }, opts.timeoutMs ?? 30000),
      });
    });
    if (this.state === 'online') this.#transmit(item);
    else this.queue.push(item);
    return p;
  }

  /** 确认二次确认应答。 */
  respondConfirm(confirmId: string, approved: boolean) {
    this.#sendRaw({
      v: PROTO_VERSION, id: confirmId, kind: 'confirm', seq: this.txSeq++, ts: Date.now(),
      confirm: { action: '', approved },
      ...(this.sessionKey && this.deviceId
        ? { payload: undefined }
        : {}),
    });
  }

  subscribe(name: EventName | string, handler: EventHandler): () => void {
    this.handlers.set(name, handler);
    return () => this.handlers.delete(name);
  }

  // ---------- 内部 ----------
  #transmit(item: QueuedReq) {
    this.awaitingAck.set(item.id, item);
    void this.#sendReq(item);
  }

  async #sendReq(item: QueuedReq) {
    if (!this.sessionKey || this.ws?.readyState !== WebSocket.OPEN) return;
    const payload = await ciphers.seal(this.sessionKey, this.deviceId, this.txSeq, item.params);
    this.#sendRaw({
      v: PROTO_VERSION, id: item.id, kind: 'req', seq: this.txSeq++, ts: item.ts,
      method: item.method, payload, expectConfirm: item.expectConfirm, ack: this.rxSeq,
    });
  }

  #onAck(ack: number) {
    // 对方 seq 为累计确认；本方向以“res 按 id 出队”为主路径，
    // 纯 ack 帧仅用于提前释放尚未收到 res 的已确认条目。
    void ack;
  }

  #flushQueue() {
    // res 收到即从 awaitingAck 移除；重连后把 awaitingAck+queue 全部重发（幂等窗口去重）
    const pending = [...this.queue.splice(0), ...this.awaitingAck.values()];
    for (const item of pending) this.#transmit(item);
  }

  #sendAck() {
    this.#sendRaw({ v: PROTO_VERSION, id: this.#id('ack'), kind: 'ack', seq: this.txSeq, ack: this.rxSeq, ts: Date.now() });
  }

  #sendRaw(env: Envelope) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(env));
  }

  #startHeartbeat() {
    clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (Date.now() - this.lastInbound > DEAD_AFTER) { this.ws?.close(); return; }
      this.#pingNow();
    }, PING_INTERVAL);
  }
  #pingNow() {
    this.#sendRaw({ v: PROTO_VERSION, id: this.#id('ping'), kind: 'ping', seq: this.txSeq++, ts: Date.now() });
  }

  #onClose() {
    clearInterval(this.pingTimer);
    this.ws = null;
    for (const [, r] of this.resolvers) clearTimeout(r.timer);   // 保留队列、清超时器：重连后重建
    this.#setState(this.paused ? 'idle' : 'offline', { queueSize: this.queueSize });
    if (!this.paused) this.#scheduleReconnect();
  }

  #scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const base = BACKOFF[Math.min(this.backoffIdx, BACKOFF.length - 1)];
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));   // ±20% 抖动
    this.backoffIdx++;
    this.#setState('reconnecting', { queueSize: this.queueSize });
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  #fail(error: LinkError) {
    this.#setState('error', { error });
    this.ws?.close(4003, error.code);
  }

  #setState(s: LinkState, info?: { error?: LinkError; queueSize?: number }) {
    this.state = s;
    this.opts.onState?.(s, info);
  }

  #id(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

  async #loadIdentity(): Promise<{ pubDerB64: string; priv: CryptoKey }> {
    const stored = localStorage.getItem('dsh.identity');
    if (stored) {
      const jwk = JSON.parse(stored);
      const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
      const pub = await crypto.subtle.importKey('jwk', { ...jwk, private: undefined, key_ops: ['verify'], type: 'public' }, { name: 'Ed25519' }, true, ['verify']);
      const spki = await crypto.subtle.exportKey('spki', pub);
      return { pubDerB64: ciphers.bufToB64(spki), priv };
    }
    const id = await ciphers.generateDeviceIdentity();
    const jwk = await crypto.subtle.exportKey('jwk', id.priv);
    localStorage.setItem('dsh.identity', JSON.stringify(jwk));
    return id;
  }
}

/** 全局单例：设置页保存连接参数后由 store 调用 reset() 重建。 */
let instance: LinkClient | null = null;
export function getLink(opts?: LinkClientOptions): LinkClient {
  if (!instance && opts) instance = new LinkClient(opts);
  return instance!;
}
export function resetLink(): void {
  instance?.disconnect();
  instance = null;
}
