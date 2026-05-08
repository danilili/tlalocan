import { T } from '../../lib/design-tokens';

export default function SourceBadge({ source }) {
  if (!source) return null;
  const isAirbnb = source === 'airbnb';
  return (
    <span
      style={{
        background: isAirbnb ? 'rgba(255,90,95,0.12)' : 'rgba(181,134,11,0.12)',
        color: isAirbnb ? '#FF5A5F' : T.goldLight,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {isAirbnb ? 'Airbnb' : 'Directo'}
    </span>
  );
}
