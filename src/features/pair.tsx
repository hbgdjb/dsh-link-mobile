// mobile/src/features/pair.tsx — 发现与配对：beacon 列表 / 扫码 / 配对码 / 蓝牙 / 手动 IP（docs/02 §3）

import React, { useEffect, useState } from 'react';
import { discovery, type DiscoveredHost } from '../net/discovery';
import { ensureLink } from '../net/useLink';
import { store, useStoreState } from '../state/store';
import { navigate } from '../app/router';
import { Button, Card, EmptyState, ErrorState, ListRow } from '../ui/base';

type Mode = 'discover' | 'code' | 'qr' | 'manual' | 'bluetooth';

export const PairPage: React.FC = () => {
  const s = useStoreState();
  const [mode, setMode] = useState<Mode>('discover');
  const [hosts, setHosts] = useState<DiscoveredHost[]>(discovery.list());
  const [code, setCode] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  // 订阅发现结果（PWA：PC 端 /discovery 兜底；原生：UDP 监听钩子）
  useEffect(() => {
    const off = discovery.subscribe(setHosts);
    discovery.startPolling(undefined);
    return () => { off(); discovery.stop(); };
  }, []);

  const connect = async (host: DiscoveredHost, pairingCode?: string) => {
    setConnecting(host.deviceId); setError(null);
    try {
      store.set({ hosts: discovery.list() });
      store.setConnection({ host, state: 'connecting' });
      ensureLink(host, pairingCode);
      navigate('sessions');
    } catch (e) {
      setError((e as Error).message);
      store.setConnection({ state: 'error', error: { code: 'CONNECT', message: (e as Error).message } });
    } finally { setConnecting(null); }
  };

  const onManual = () => {
    const host = discovery.addManual(manual);
    if (!host) { setError('格式应为 IP 或 IP:端口，例如 192.168.1.5:9443'); return; }
    void connect(host, code || undefined);
  };

  const onScan = async () => {
    setError(null);
    try {
      const host = await discovery.scanFromCamera();
      if (!host) { setError('本浏览器不支持相机扫码，请使用配对码或手动输入'); return; }
      await connect(host, code || undefined);
    } catch (e) { setError(`扫码失败：${(e as Error).message}`); }
  };

  const onBluetooth = async () => {
    const host = await discovery.viaBluetooth();
    if (!host) { setError('本环境不支持蓝牙（PWA 限制），请改用配对码/扫码；原生包可用）'); return; }
    await connect(host, code || undefined);
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      {/* 连接状态 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              {s.connection.host ? `${s.connection.host.name}:${s.connection.host.port}` : '未连接'}
            </div>
            <div style={{ fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
              状态 {s.connection.state}{s.connection.tier ? ` · 权限 ${s.connection.tier}` : ''}
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('sessions')}>进入会话</Button>
        </div>
      </Card>

      {/* 方式切换 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['discover', '发现'], ['code', '配对码'], ['qr', '扫码'],
          ['bluetooth', '蓝牙'], ['manual', '手动 IP'],
        ] as [Mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
            style={{
              minHeight: 36, padding: '0 14px', borderRadius: 'var(--dsh-radius-pill)',
              border: '1px solid ' + (mode === m ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'),
              background: mode === m ? 'var(--dsw-alias-brand-primary)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--dsw-alias-label-secondary)',
              font: 'var(--dsh-text-s) var(--dsh-font-sans)', cursor: 'pointer',
            }}>{label}</button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      {/* 配对码输入（code/qr/bluetooth/manual 共用） */}
      {mode !== 'discover' && (
        <Card>
          <label htmlFor="paircode" style={{ fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            配对码（电脑端 设置 → 连接与配对 显示，10 分钟有效）
          </label>
          <input id="paircode" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            inputMode="text" maxLength={6} placeholder="6 位配对码"
            style={{
              width: '100%', minHeight: 48, marginTop: 8, textAlign: 'center',
              letterSpacing: '0.5em', font: '600 var(--dsh-text-l) var(--dsh-font-mono)',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 'var(--dsh-radius-m)', color: 'var(--dsw-alias-label-primary)',
            }} />
        </Card>
      )}

      {/* 方式内容 */}
      {mode === 'discover' && (
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 'var(--dsh-text-m)' }}>同一局域网的电脑</h3>
          {hosts.length === 0 && (
            <EmptyState text="未发现电脑。确认双方在同一局域网，或使用配对码 / 手动 IP。"
              action={<Button variant="secondary" onClick={() => setMode('manual')}>手动输入</Button>} />
          )}
          {hosts.map(h => (
            <ListRow key={h.deviceId}
              icon={<span aria-hidden>🖥</span>}
              title={h.name}
              subtitle={`${h.host}:${h.port} · ${h.source}${h.paired ? ' · 已配对' : ''}`}
              trailing={<Button
                loading={connecting === h.deviceId}
                onClick={() => void connect(h, code || undefined)}>
                {h.paired ? '直连' : '配对'}
              </Button>} />
          ))}
        </div>
      )}

      {mode === 'code' && (
        <Card>
          <p style={{ margin: 0, fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            若已通过“发现”找到电脑，直接点“配对”；否则结合手动 IP 使用。输入配对码后重试点。
          </p>
          <div style={{ marginTop: 12 }}>
            <Button block disabled={!code || hosts.length === 0}
              onClick={() => hosts[0] && void connect(hosts[0], code)}>用配对码连接</Button>
          </div>
        </Card>
      )}

      {mode === 'qr' && (
        <Card>
          <p style={{ margin: '0 0 12px', fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            扫描电脑端“设置 → 连接与配对”上的二维码，自动填入地址与指纹。
          </p>
          <Button block onClick={() => void onScan()}>打开相机扫码</Button>
          <input value={manual} onChange={e => setManual(e.target.value)}
            placeholder="或粘贴 dshlink://pair?... 链接" aria-label="粘贴配对链接"
            style={{
              width: '100%', minHeight: 40, marginTop: 12, padding: '0 12px',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 'var(--dsh-radius-m)', color: 'var(--dsw-alias-label-primary)', font: 'inherit',
            }} />
        </Card>
      )}

      {mode === 'bluetooth' && (
        <Card>
          <p style={{ margin: '0 0 12px', fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            蓝牙仅用于发现与交换连接参数，仍需配对码完成信任建立。
          </p>
          <Button block onClick={() => void onBluetooth()}>扫描蓝牙设备</Button>
        </Card>
      )}

      {mode === 'manual' && (
        <Card>
          <label htmlFor="manualip" style={{ fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            电脑 IP 与端口
          </label>
          <input id="manualip" value={manual} onChange={e => setManual(e.target.value)}
            placeholder="192.168.1.5:9443" inputMode="url"
            style={{
              width: '100%', minHeight: 44, marginTop: 8, padding: '0 12px',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 'var(--dsh-radius-m)', color: 'var(--dsw-alias-label-primary)',
              font: 'var(--dsh-text-s) var(--dsh-font-mono)',
            }} />
          <div style={{ marginTop: 12 }}>
            <Button block disabled={!manual} onClick={onManual}>连接</Button>
          </div>
        </Card>
      )}
    </div>
  );
};
