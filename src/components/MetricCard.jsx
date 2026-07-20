import { useState } from 'react';
import Card from './Card';
import { T } from '../lib/design-tokens';

// info (opcional): texto explicativo de la métrica; aparece en un tooltip al
// hacer hover sobre la tarjeta (escritorio). El ⓘ junto a la etiqueta avisa
// que hay explicación disponible.
export default function MetricCard({ label, value, sub, trend, info }) {
  const [hovered, setHovered] = useState(false);
  const subColor =
    trend === 'up' ? T.green : trend === 'down' ? T.red : T.muted;
  const arrow = trend === 'up' ? '↑ ' : trend === 'down' ? '↓ ' : '';

  return (
    <div
      style={{ position: 'relative', flex: '1 1 150px', minWidth: 150 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Card style={{ cursor: info ? 'help' : 'default' }}>
        <div
          style={{
            fontSize: 11,
            color: T.muted,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
          {info && (
            <span style={{ marginLeft: 5, color: T.muted, opacity: 0.7, letterSpacing: 0 }}>ⓘ</span>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: T.text, lineHeight: 1.15 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: subColor, marginTop: 4, whiteSpace: 'nowrap' }}>
            {arrow}
            {sub}
          </div>
        )}
      </Card>
      {info && hovered && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 260,
            maxWidth: '80vw',
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 12,
            lineHeight: 1.5,
            color: T.text,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            zIndex: 50,
            fontFamily: "'DM Sans', sans-serif",
            pointerEvents: 'none',
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}
