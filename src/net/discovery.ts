// mobile/src/net/discovery.ts — 发现与直连：beacon · 扫码 · 手动 IP · 蓝牙
// 浏览器无 UDP 监听能力，PWA 通过 PC 端 HTTP 兜底端点 + 手动/扫码；
// Capacitor 原生壳可接 UDP/BLE 插件（接口已预留）。

import type { Beacon } from './protocol';

export interface DiscoveredHost {
  deviceId: string;
  name: string;
  host: string;
  port: number;
  fp?: string;
  paired?: boolean;
  source: 'beacon' | 'manual' | 'qr' | 'bluetooth';
}

export type DiscoverListener = (hosts: DiscoveredHost[]) => void;

export class Discovery {
  private hosts = new Map<string, DiscoveredHost>();
  private listeners = new Set<DiscoverListener>();
  private pollTimer = 0;

  /** PWA 模式：向已知 PC 轮询 /discovery 兜底端点，或由设置页手动 IP 触发。 */
  startPolling(pollUrl?: string, intervalMs = 5000) {
    this.stop();
    if (pollUrl) {
      const tick = async () => {
        try {
          const res = await fetch(pollUrl, { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            const data = (await res.json()) as Beacon & { address?: string };
            if (data.proto === 'dlp/1') this.#upsert(data, data.address ?? '', 'beacon');
          }
        } catch { /* PC 不在线时静默 */ }
      };
      void tick();
      this.pollTimer = window.setInterval(tick, intervalMs);
    }
    // Capacitor：原生 UDP 监听在插件层注入（window['__dshUdpListen'] 骨架钩子）
    const native = (window as unknown as Record<string, any>).__dshUdpListen;
    if (typeof native === 'function') {
      native((msg: string, from: string) => {
        try {
          const data = JSON.parse(msg) as Beacon;
          if (data.proto === 'dlp/1') this.#upsert(data, from, 'beacon');
        } catch { /* ignore */ }
      });
    }
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = 0;
  }

  /** 手动输入 IP:端口。 */
  addManual(input: string): DiscoveredHost | null {
    const m = /^(?:https?:\/\/)?([\w.-]+|\[[0-9a-f:]+\])(?::(\d{1,5}))?$/i.exec(input.trim());
    if (!m) return null;
    const host: DiscoveredHost = {
      deviceId: `manual:${m[1]}:${m[2] ?? 9443}`,
      name: m[1],
      host: m[1],
      port: Number(m[2] ?? 9443),
      source: 'manual',
    };
    this.#upsert({ proto: 'dlp/1', kind: 'query', deviceId: host.deviceId, name: host.name, port: host.port }, host.host, 'manual');
    return host;
  }

  /**
   * 扫码解析：dshlink://pair?h=&p=&fp=&d=（PC pairing.qrPayload 生成）。
   * BarcodeDetector 可用时直接识别；否则由用户粘贴 URI。
   */
  parsePairUri(uri: string): DiscoveredHost | null {
    let u: URL;
    try { u = new URL(uri); } catch { return null; }
    if (u.protocol !== 'dshlink:') return null;
    const host = u.hostname || u.host;          // dshlink://pair?... 形态下 h 在 searchParams
    const h = u.searchParams.get('h') ?? host;
    const p = Number(u.searchParams.get('p') ?? 9443);
    if (!h) return null;
    const out: DiscoveredHost = {
      deviceId: u.searchParams.get('d') ?? `qr:${h}:${p}`,
      name: h, host: h, port: p,
      fp: u.searchParams.get('fp') ?? undefined,
      paired: false, source: 'qr',
    };
    this.#upsert({ proto: 'dlp/1', kind: 'answer', deviceId: out.deviceId, name: out.name, port: out.port, fp: out.fp }, h, 'qr');
    return out;
  }

  /** 扫码识别（支持 BarcodeDetector 的浏览器）。 */
  async scanFromCamera(): Promise<DiscoveredHost | null> {
    const detector = (window as any).BarcodeDetector;
    if (!detector) return null;   // 降级：设置页显示输入框
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    try {
      const d = new detector({ formats: ['qr_code'] });
      for (let i = 0; i < 60; i++) {   // ~30s 超时
        const codes = await d.detect(video);
        if (codes[0]?.rawValue) return this.parsePairUri(codes[0].rawValue);
        await new Promise(r => setTimeout(r, 500));
      }
      return null;
    } finally {
      stream.getTracks().forEach(t => t.stop());
    }
  }

  /** 蓝牙：仅交换连接参数（PWA 不可用 → Capacitor BLE 插件）。 */
  async viaBluetooth(): Promise<DiscoveredHost | null> {
    const ble = (window as unknown as Record<string, any>).__dshBleScan;
    if (typeof ble !== 'function') return null;   // UI 提示“请使用配对码/扫码”
    const params = await ble('dsh-link');
    if (!params?.h) return null;
    return this.parsePairUri(`dshlink://pair?h=${encodeURIComponent(params.h)}&p=${params.p ?? 9443}&fp=${encodeURIComponent(params.fp ?? '')}&d=${encodeURIComponent(params.d ?? '')}`);
  }

  list(): DiscoveredHost[] { return [...this.hosts.values()]; }
  subscribe(fn: DiscoverListener): () => void {
    this.listeners.add(fn);
    fn(this.list());
    return () => this.listeners.delete(fn);
  }

  #upsert(data: Beacon, address: string, source: DiscoveredHost['source']) {
    const host = address.replace(/^::ffff:/, '') || data.deviceId;
    this.hosts.set(data.deviceId, {
      deviceId: data.deviceId, name: data.name, host, port: data.port,
      fp: data.fp, paired: data.paired, source,
    });
    const snapshot = this.list();
    for (const fn of this.listeners) fn(snapshot);
  }
}

export const discovery = new Discovery();
