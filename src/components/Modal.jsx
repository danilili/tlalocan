import { useEffect } from 'react';
import { T } from '../lib/design-tokens';

export default function Modal({ open, onClose, title, children, maxWidth = 540 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.card,
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {title && (
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 400,
                color: T.text,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                letterSpacing: 0.5,
              }}
            >
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                background: 'none',
                border: 'none',
                color: T.muted,
                fontSize: 22,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}
