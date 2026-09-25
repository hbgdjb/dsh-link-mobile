// mobile/src/features/plugins.tsx — 插件管理（docs/03 §5 #8；全部 admin/owner + 二次确认）

import React, { useEffect, useState } from 'react';
import { api } from '../api/rpc';
import { Button, Card, EmptyState, ErrorState, Skeleton, useToast } from '../ui/base';
import { useStoreState } from '../state/store';

interface Bundle { name: string; enabled?: boolean; version?: string; description?: string }

export const PluginsPage: React.FC = () => {
  const s = useStoreState();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installSpec, setInstallSpec] = useState('');
  const toast = useToast();

  const canWrite = s.connection.tier === 'admin' || s.connection.tier === 'owner';

  const load = async () => {
    setLoading(true); setError(null);
    try { setBundles(((await api.listBundles()).bundles ?? []) as Bundle[]); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (b: Bundle) => {
    try {
      await api.setBundleEnabled(b.name, !b.enabled);   // expectConfirm → 全局确认弹窗
      toast.show(`${b.name} ${b.enabled ? '已停用' : '已启用'}`);
      await load();
    } catch (e) { setError((e as Error).message); }
  };

  const install = async () => {
    if (!installSpec.trim()) return;
    try {
      const r = await api.installBundle(installSpec.trim());
      toast.show(`安装已提交 ${r.requestId ?? ''}`);
      setInstallSpec('');
      await load();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      {loading && <Skeleton height={72} count={3} />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && bundles.length === 0 && <EmptyState text="未安装任何 bundle" />}

      {bundles.map(b => (
        <Card key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
            <div style={{ fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
              {b.version ?? ''} {b.description ? `· ${b.description}` : ''}
            </div>
          </div>
          <Button
            variant={b.enabled ? 'secondary' : 'primary'}
            disabled={!canWrite}
            onClick={() => void toggle(b)}>
            {b.enabled ? '停用' : '启用'}
          </Button>
        </Card>
      ))}

      <Card>
        <h3 style={{ margin: '0 0 8px', fontSize: 'var(--dsh-text-m)' }}>安装 bundle</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={installSpec} onChange={e => setInstallSpec(e.target.value)}
            placeholder="包名 / 本地目录 / registry spec" aria-label="安装来源"
            disabled={!canWrite}
            style={{
              flex: 1, minHeight: 40, padding: '0 12px', font: 'var(--dsh-text-s)',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 'var(--dsh-radius-m)', color: 'var(--dsw-alias-label-primary)',
            }} />
          <Button disabled={!canWrite} onClick={() => void install()}>安装</Button>
        </div>
        {!canWrite && (
          <p style={{ color: 'var(--dsw-alias-state-warn-primary)', fontSize: 'var(--dsh-text-s)', margin: '8px 0 0' }}>
            当前设备权限为 {s.connection.tier ?? '—'}，需要 admin 及以上。
          </p>
        )}
        <p style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-xs)', margin: '8px 0 0' }}>
          安装 / 卸载 / 启停均为敏感操作，需二次确认；安装日志见“日志”页。
        </p>
      </Card>
      {toast.node}
    </div>
  );
};
