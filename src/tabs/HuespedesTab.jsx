import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import { useHuespedes } from '../hooks/useHuespedes';
import { formatMoney, formatDate } from '../lib/format';

function initialsOf(nombre, apellidos) {
  const n = (nombre || '').trim().split(/\s+/)[0]?.[0] || '';
  const a = (apellidos || '').trim().split(/\s+/)[0]?.[0] || '';
  return (n + a).toUpperCase() || '?';
}

export default function HuespedesTab() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { data: huespedes, loading, error } = useHuespedes({
    search: debouncedSearch,
    limit: 100,
  });

  const [stats, setStats] = useState({ total: null, repetidores: null, ticket: null });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: total }, { count: repetidores }, { data: aggRows }] = await Promise.all([
        supabase.from('huespedes').select('*', { count: 'exact', head: true }),
        supabase
          .from('huespedes')
          .select('*', { count: 'exact', head: true })
          .gt('total_estancias', 1),
        supabase
          .from('huespedes')
          .select('total_gastado, total_estancias')
          .gt('total_estancias', 0),
      ]);
      if (cancelled) return;
      const sumGastado = (aggRows ?? []).reduce(
        (s, r) => s + Number(r.total_gastado || 0),
        0,
      );
      const sumEstancias = (aggRows ?? []).reduce(
        (s, r) => s + Number(r.total_estancias || 0),
        0,
      );
      const ticket = sumEstancias > 0 ? sumGastado / sumEstancias : 0;
      setStats({ total: total ?? 0, repetidores: repetidores ?? 0, ticket });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const repetidoresPct = useMemo(() => {
    if (!stats.total) return null;
    return Math.round(((stats.repetidores ?? 0) / stats.total) * 100);
  }, [stats.total, stats.repetidores]);

  return (
    <>
      <FadeIn>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '32px 0 14px',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: T.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Huéspedes
          </h2>
          <input
            type="search"
            placeholder="Buscar por nombre o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchStyle}
          />
        </div>

        {loading && (
          <div style={{ color: T.muted, fontSize: 12 }}>Cargando huéspedes…</div>
        )}
        {error && <div style={{ color: T.red, fontSize: 12 }}>Error: {error.message}</div>}
        {!loading && !error && huespedes.length === 0 && (
          <Card>
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              {debouncedSearch ? 'Sin coincidencias.' : 'Aún no hay huéspedes registrados.'}
            </div>
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {huespedes.map((g, i) => (
            <FadeIn key={g.id} delay={Math.min(i, 8) * 40}>
              <Card
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(181,134,11,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 500,
                    color: T.goldLight,
                    flexShrink: 0,
                  }}
                >
                  {initialsOf(g.nombre, g.apellidos)}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {[g.nombre, g.apellidos].filter(Boolean).join(' ')}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                    {g.telefono} · {g.total_estancias} estancia{g.total_estancias === 1 ? '' : 's'}
                    {g.ultima_visita ? ` · Última: ${formatDate(g.ultima_visita)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.goldLight }}>
                    {formatMoney(g.total_gastado)}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted }}>total gastado</div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <SectionTitle>Resumen CRM</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricCard
            label="Total huéspedes"
            value={stats.total ?? '—'}
          />
          <MetricCard
            label="Repetidores"
            value={stats.repetidores ?? '—'}
            sub={repetidoresPct != null ? `${repetidoresPct}% del total` : undefined}
          />
          <MetricCard
            label="Ticket promedio"
            value={stats.ticket != null ? formatMoney(stats.ticket) : '—'}
            sub="por estancia"
          />
        </div>
      </FadeIn>
    </>
  );
}

const searchStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: T.text,
  fontSize: 13,
  outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
  minWidth: 240,
};
