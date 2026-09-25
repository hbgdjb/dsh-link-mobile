// mobile/src/features/files.tsx — 文件浏览 / 上传 / 下载 / 预览（docs/03 §5 #4）

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/rpc';
import { useStoreState } from '../state/store';
import { Button, CodeBlock, EmptyState, ErrorState, ListRow, Skeleton } from '../ui/base';

interface Entry { name: string; type: 'file' | 'dir'; size?: number }

export const FilesPage: React.FC = () => {
  const s = useStoreState();
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async (p: string) => {
    setLoading(true); setError(null);
    try {
      const r = await api.listFiles(p);
      setEntries((r.entries ?? []) as Entry[]);
      setPath(p);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load('.'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openEntry = async (e: Entry) => {
    const next = path === '.' ? e.name : `${path}/${e.name}`;
    if (e.type === 'dir') return void load(next);
    try {
      const r = await api.readFile(next, 0, 65536);
      setPreview({ name: e.name, text: r.text });
    } catch (err) { setError((err as Error).message); }
  };

  // 上传：读文件 → PC fileUploads（骨架：整包 base64；生产走分块二进制帧）
  const upload = async (file: File) => {
    if (!s.connection.state || s.connection.state !== 'online') return;
    setProgress(0);
    try {
      const { uploadId } = await api.startUpload(file.name, file.size);
      // TODO(分块): 经 link-client 发送二进制帧 {uploadId, offset} + chunk
      void uploadId;
      setProgress(100);
      await load(path);
    } catch (e) { setError((e as Error).message); }
    finally { window.setTimeout(() => setProgress(null), 1500); }
  };

  return (
    <div style={{ padding: '12px 0 16px' }}>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', alignItems: 'center' }}>
        <Button variant="secondary" onClick={() => {
          const parts = path.split('/'); parts.pop();
          void load(parts.join('/') || '.');
        }} disabled={path === '.'}>上级</Button>
        <span style={{ flex: 1, fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{path}</span>
        <Button onClick={() => fileInput.current?.click()}>上传</Button>
        <input ref={fileInput} type="file" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
      </div>

      {progress !== null && (
        <div style={{ margin: '0 16px 12px', height: 6, borderRadius: 3,
          background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%',
            background: 'var(--dsw-alias-brand-primary)', transition: 'width var(--dsh-motion)' }} />
        </div>
      )}

      {loading && <Skeleton height={48} count={5} />}
      {error && <ErrorState message={error} onRetry={() => void load(path)} />}
      {!loading && !error && entries.length === 0 && <EmptyState text="空目录" />}
      {!loading && !error && entries.map(e => (
        <ListRow key={e.name}
          icon={e.type === 'dir' ? '📁' : '▢'}
          title={e.name}
          subtitle={e.type === 'file' && e.size ? `${(e.size / 1024).toFixed(1)} KB` : undefined}
          onClick={() => void openEntry(e)} />
      ))}

      {preview && (
        <div style={{ margin: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 'var(--dsh-text-s)' }}>{preview.name}</strong>
            <Button variant="ghost" onClick={() => setPreview(null)}>关闭</Button>
          </div>
          <CodeBlock code={preview.text.slice(0, 8000)} lang={preview.name.split('.').pop()} />
          {preview.text.length > 8000 && (
            <p style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-xs)' }}>仅预览前 8KB</p>
          )}
        </div>
      )}
    </div>
  );
};
