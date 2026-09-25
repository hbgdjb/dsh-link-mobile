// mobile/src/features/account.tsx — 账号与密钥（docs/03 §5 #11；owner + 二次确认）

import React, { useEffect, useState } from 'react';
import { api } from '../api/rpc';
import { Card, EmptyState, ErrorState, ListRow, Skeleton } from '../ui/base';
import { useStoreState } from '../state/store';

interface CredentialMeta { key?: string; name?: string; provider?: string; updatedAt?: number }

export const AccountPage: React.FC = () => {
  const s = useStoreState();
  const [account, setAccount] = useState<{ state?: string }>({});
  const [creds, setCreds] = useState<CredentialMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = s.connection.tier === 'owner';

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const [acc, list] = await Promise.allSettled([api.accountState(), api.credentialsList()]);
        if (acc.status === 'fulfilled') setAccount(acc.value);
        if (list.status === 'fulfilled') setCreds((list.value.records ?? []) as CredentialMeta[]);
        if (acc.status === 'rejected' && list.status === 'rejected') setError(acc.reason?.message ?? '加载失败');
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div style={{ padding: '12px 0 24px' }}>
      {loading && <Skeleton height={56} count={3} />}
      {error && <ErrorState message={error} />}

      {!loading && (
        <>
          <h3 style={{ margin: '0 16px 8px', fontSize: 'var(--dsh-text-xs)', color: 'var(--dsw-alias-label-secondary)' }}>账号</h3>
          <ListRow title="DeepSeek 账号" subtitle={account.state ?? '未知（电脑端未登录或不可读）'} />
          <p style={{ margin: '8px 16px 16px', fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
            登录 / 登出为敏感操作，会在电脑端或本机弹出确认。
          </p>

          <h3 style={{ margin: '0 16px 8px', fontSize: 'var(--dsh-text-xs)', color: 'var(--dsw-alias-label-secondary)' }}>密钥（只读元数据）</h3>
          {creds.length === 0 && <EmptyState text="电脑端未存储可列出的凭据" />}
          {creds.map((c, i) => (
            <ListRow key={i} icon={<span aria-hidden>🔑</span>}
              title={c.name ?? c.key ?? '凭据'}
              subtitle={[c.provider, c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : null].filter(Boolean).join(' · ')}
              trailing={<span style={{
                fontSize: 'var(--dsh-text-xs)',
                color: canEdit ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-idle-primary)',
              }}>{canEdit ? '管理' : '需 owner'}</span>}
              onClick={canEdit ? () => { /* 打开编辑 Sheet → credentials.set（confirm） */ } : undefined}
            />
          ))}
          <Card style={{ margin: 16 }}>
            <p style={{ margin: 0, fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)' }}>
              安全约定：手机端永不显示密钥明文；读取列表只包含元数据。写入 / 删除必须经
              二次确认（owner 权限）。
            </p>
          </Card>
        </>
      )}
    </div>
  );
};
