import { T } from '../lib/design-tokens';

export default function SectionTitle({ children }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: T.muted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        margin: '32px 0 14px',
      }}
    >
      {children}
    </h2>
  );
}
