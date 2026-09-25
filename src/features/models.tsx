// mobile/src/features/models.tsx — 模型与参数（docs/03 §5 #3）

import React, { useEffect, useState } from 'react';
import { api } from '../api/rpc';
import { useStoreState } from '../state/store';
import { Card, EmptyState, ErrorState, Skeleton } from '../ui/base';

interface ModelEntry { id?: string; name?: string; provider?: string }

export const ModelsPage: React.FC = () => {
  const s = useStoreState();
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState({ temperature: 0.7, maxTokens: 4096 });

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await api.modelCatalog();
        setModels((r.models ?? []) as ModelEntry[]);
      } catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, []);

  const select = async (model: string) => {
    if (!s.activeSessionId) return;
    try { await api.selectModel(s.activeSessionId, model); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <Card>
        <h3 style={{ margin: '0 0 8px', fontSize: 'var(--dsh-text-m)' }}>当前会话模型</h3>
        {loading && <Skeleton count={3} height={36} />}
        {error && <ErrorState message={error} />}
        {!loading && !error && models.length === 0 && <EmptyState text="暂无可用模型（需电脑端已配置提供方）" />}
        {models.map(m => {
          const id = m.id ?? m.name ?? '';
          const active = s.sessions.find(x => x.id === s.activeSessionId)?.model === id;
          return (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <input type="radio" name="model" checked={active} onChange={() => void select(id)} />
              <span>{m.name ?? id}{m.provider ? <em style={{ color: 'var(--dsw-alias-label-secondary)', fontStyle: 'normal', fontSize: 'var(--dsh-text-s)' }}> · {m.provider}</em> : null}</span>
            </label>
          );
        })}
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 12px', fontSize: 'var(--dsh-text-m)' }}>生成参数</h3>
        <ParamSlider label="温度" value={params.temperature} min={0} max={2} step={0.1}
          onChange={v => setParams(p => ({ ...p, temperature: v }))} />
        <ParamSlider label="最大 Token" value={params.maxTokens} min={256} max={32768} step={256}
          onChange={v => setParams(p => ({ ...p, maxTokens: v }))} />
        <p style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-s)', margin: '8px 0 0' }}>
          参数按会话保存，电脑端与手机端共享同一会话配置。
        </p>
      </Card>
    </div>
  );
};

const ParamSlider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }> =
  ({ label, value, min, max, step, onChange }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--dsh-text-s)' }}>
        <span>{label}</span><span style={{ color: 'var(--dsw-alias-label-secondary)' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        aria-label={label}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--dsw-alias-brand-primary)' }} />
    </div>
  );
