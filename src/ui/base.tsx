// mobile/src/ui/base.tsx — 组件库（对齐 docs/03-mobile-ui-spec.md §6）
// 只使用 var(--dsw-alias-*) 与 tokens.css 派生 token；样式以 React 元素内联渲染，随卸载移除。
// 不 import 任何 Harness Client 包——手机端是独立应用，token 同名复刻。

import React, { useEffect, useRef, useState } from 'react';

const s = (o: React.CSSProperties) => o;

// ---------- Button ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export const Button: React.FC<{
  variant?: ButtonVariant; block?: boolean; disabled?: boolean; loading?: boolean;
  onClick?: () => void; children: React.ReactNode; 'aria-label'?: string;
}> = ({ variant = 'primary', block, disabled, loading, onClick, children, ...aria }) => {
  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--dsw-alias-brand-primary)', color: '#fff', border: 'none' },
    secondary: { background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l2)' },
    ghost: { background: 'transparent', color: 'var(--dsw-alias-brand-primary)', border: 'none' },
    danger: { background: 'var(--dsw-alias-state-error-primary)', color: '#fff', border: 'none' },
  };
  return (
    <button
      {...aria}
      disabled={disabled || loading}
      onClick={onClick}
      style={s({
        ...styles[variant],
        minHeight: 40, padding: '0 16px', borderRadius: 'var(--dsh-radius-m)',
        font: 'inherit', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, width: block ? '100%' : undefined,
        transition: `transform var(--dsh-motion-fast) var(--dsh-ease), opacity var(--dsh-motion-fast)`,
      })}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.98)')}
      onPointerUp={e => (e.currentTarget.style.transform = '')}
      onPointerLeave={e => (e.currentTarget.style.transform = '')}
    >
      {loading ? '…' : children}
    </button>
  );
};

// ---------- Card ----------
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={s({
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: 'var(--dsh-radius-l)',
    boxShadow: 'var(--dsh-shadow-s)',
    padding: 16, ...style,
  })}>{children}</div>
);

// ---------- ListRow ----------
export const ListRow: React.FC<{
  icon?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode;
  trailing?: React.ReactNode; onClick?: () => void; badge?: string;
}> = ({ icon, title, subtitle, trailing, onClick, badge }) => (
  <div
    role={onClick ? 'button' : undefined}
    onClick={onClick}
    style={s({
      display: 'flex', alignItems: 'center', gap: 12,
      minHeight: 56, padding: '8px 16px', cursor: onClick ? 'pointer' : 'default',
      background: 'var(--dsw-alias-bg-layer-1)',
      borderBottom: '1px solid var(--dsw-alias-border-l1)',
      transition: `background var(--dsh-motion-fast) var(--dsh-ease)`,
    })}
  >
    {icon && <span style={{ color: 'var(--dsw-alias-label-secondary)', display: 'flex' }}>{icon}</span>}
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 'var(--dsh-text-m)', color: 'var(--dsw-alias-label-primary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      {subtitle && <span style={{ display: 'block', fontSize: 'var(--dsh-text-s)', color: 'var(--dsw-alias-label-secondary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>}
    </span>
    {badge && <span style={{ fontSize: 'var(--dsh-text-xs)', color: 'var(--dsw-alias-brand-primary)',
      background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 'var(--dsh-radius-pill)', padding: '2px 8px' }}>{badge}</span>}
    {trailing ?? (onClick && <ChevronRight />)}
  </div>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--dsw-alias-state-idle-primary)' }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// ---------- 状态：空 / 错误 / 骨架 ----------
export const EmptyState: React.FC<{ icon?: React.ReactNode; text: string; action?: React.ReactNode }> = ({ icon, text, action }) => (
  <div style={s({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px', maxWidth: 280, margin: '0 auto', textAlign: 'center' })}>
    <span style={{ fontSize: 40, color: 'var(--dsw-alias-state-idle-primary)' }}>{icon ?? '◌'}</span>
    <p style={{ margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-s)' }}>{text}</p>
    {action}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div style={s({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px', maxWidth: 280, margin: '0 auto', textAlign: 'center' })}>
    <span style={{ fontSize: 36, color: 'var(--dsw-alias-state-error-primary)' }}>⚠</span>
    <p style={{ margin: 0, color: 'var(--dsw-alias-label-primary)', fontSize: 'var(--dsh-text-s)' }}>{message}</p>
    {onRetry && <Button variant="secondary" onClick={onRetry}>重试</Button>}
  </div>
);

export const Skeleton: React.FC<{ height?: number; count?: number }> = ({ height = 16, count = 1 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} style={s({
        height, borderRadius: 'var(--dsh-radius-m)', margin: '8px 16px',
        background: 'var(--dsw-alias-bg-layer-2)',
        animation: 'dsh-pulse 1.2s ease-in-out infinite',
      })} />
    ))}
    <style>{`@keyframes dsh-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
  </>
);

// ---------- 连接状态点 ----------
export const StatusDot: React.FC<{ state: 'online' | 'reconnecting' | 'offline' | 'idle' }> = ({ state }) => {
  const color = state === 'online' ? 'var(--dsw-alias-state-success-primary)'
    : state === 'reconnecting' ? 'var(--dsw-alias-state-warn-primary)'
    : state === 'offline' ? 'var(--dsw-alias-state-error-primary)'
    : 'var(--dsw-alias-state-idle-primary)';
  return <span aria-label={state} style={s({
    width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block',
    animation: state === 'reconnecting' ? 'dsh-breathe 1s ease-in-out infinite' : undefined,
  })}>
    <style>{`@keyframes dsh-breathe{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
  </span>;
};

// ---------- Sheet（底部弹层） ----------
export const Sheet: React.FC<{ open: boolean; title?: string; onClose: () => void; children: React.ReactNode }> = ({ open, title, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      style={s({
        position: 'fixed', inset: 0, background: 'var(--dsw-alias-bg-overlay)', opacity: 0.5, zIndex: 40,
      })} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={s({
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--dsw-alias-bg-overlay)', borderRadius: '16px 16px 0 0',
        boxShadow: 'var(--dsh-shadow-sheet)',
        padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
        maxHeight: '80vh', overflowY: 'auto',
        animation: 'dsh-up var(--dsh-motion) var(--dsh-ease)',
        outline: 'none',
      })}>
        <div aria-hidden style={s({ width: 36, height: 4, borderRadius: 2, background: 'var(--dsw-alias-state-idle-primary)', margin: '0 auto 12px' })} />
        {title && <h2 style={{ margin: '0 0 12px', fontSize: 'var(--dsh-text-l)' }}>{title}</h2>}
        {children}
        <style>{`@keyframes dsh-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}`}</style>
      </div>
    </div>
  );
};

// ---------- 二次确认弹窗（敏感操作） ----------
export const ConfirmDialog: React.FC<{
  open: boolean; action: string; detail?: string;
  onApprove: () => void; onReject: () => void;
}> = ({ open, action, detail, onApprove, onReject }) => (
  <Sheet open={open} title="确认敏感操作" onClose={onReject}>
    <p style={{ fontSize: 'var(--dsh-text-m)', fontWeight: 600 }}>{action}</p>
    {detail && <p style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 'var(--dsh-text-s)', whiteSpace: 'pre-wrap' }}>{detail}</p>}
    <div style={s({ display: 'flex', gap: 12, marginTop: 16 })}>
      <Button variant="secondary" block onClick={onReject}>取消</Button>
      <Button variant="danger" block onClick={onApprove}>确认执行</Button>
    </div>
  </Sheet>
);

// ---------- Toast ----------
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 3000); };
  const node = msg ? (
    <div role="status" style={s({
      position: 'fixed', top: 'calc(env(safe-area-inset-top) + 8px)', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--dsw-alias-bg-overlay)', color: 'var(--dsw-alias-label-primary)',
      border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 'var(--dsh-radius-m)',
      boxShadow: 'var(--dsh-shadow-m)', padding: '8px 16px', fontSize: 'var(--dsh-text-s)', zIndex: 60,
    })}>{msg}</div>
  ) : null;
  return { show, node };
}

// ---------- 代码块（高亮 + 复制，本地能力） ----------
export const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={s({ position: 'relative' })}>
      <pre style={s({
        background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 'var(--dsh-radius-m)', padding: '12px 14px', margin: 0, overflowX: 'auto',
        font: 'var(--dsh-text-s)/1.6 var(--dsh-font-mono)', color: 'var(--dsw-alias-label-primary)',
      })}>
        <code data-lang={lang}>{code}</code>
      </pre>
      <button onClick={copy} aria-label="复制代码" style={s({
        position: 'absolute', top: 8, right: 8, minHeight: 28, padding: '0 10px',
        background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsh-radius-s)', color: 'var(--dsw-alias-label-secondary)',
        font: 'var(--dsh-text-xs) var(--dsh-font-sans)', cursor: 'pointer',
      })}>{copied ? '已复制' : '复制'}</button>
    </div>
  );
};
