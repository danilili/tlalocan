import { T } from '../lib/design-tokens';

export default function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        padding: '20px 22px',
        transition: 'border-color 0.2s, transform 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = T.gold;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {children}
    </div>
  );
}
