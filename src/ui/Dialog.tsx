import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function IconButton({ children, label, onClick, active = false, disabled = false, className = '' }: { children: ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return <button type="button" className={`icon-btn ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} aria-pressed={active || undefined} onClick={onClick} disabled={disabled}>{children}</button>;
}

const focusable = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])';

/** Modal dialog with focus trap, Escape to close, scroll lock and focus restoration. */
export function Dialog({ children, title, eyebrow, onClose, wide = false }: { children: ReactNode; title: string; eyebrow?: string; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`dialog ${wide ? 'dialog-wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab') return;
      const items = ref.current?.querySelectorAll<HTMLElement>(focusable);
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }}>
      <div className="dialog-head">
        <div>{eyebrow && <span className="mono">{eyebrow}</span>}<h2 id={titleId}>{title}</h2></div>
        <IconButton label="Close dialog" onClick={onClose}><X size={18}/></IconButton>
      </div>
      {children}
    </div>
  </div>;
}
