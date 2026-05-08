import Card from './Card';
import { T } from '../lib/design-tokens';

export default function MetricCard({ label, value, sub, trend }) {
  const subColor =
    trend === 'up' ? T.green : trend === 'down' ? T.red : T.muted;
  const arrow = trend === 'up' ? '↑ ' : trend === 'down' ? '↓ ' : '';

  return (
    <Card style={{ flex: '1 1 140px', minWidth: 140 }}>
      <div
        style={{
          fontSize: 11,
          color: T.muted,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: T.text, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: subColor, marginTop: 4 }}>
          {arrow}
          {sub}
        </div>
      )}
    </Card>
  );
}
