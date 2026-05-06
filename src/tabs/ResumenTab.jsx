import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/badges/StatusBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import { useChalets } from '../hooks/useChalets';
import { useRol } from '../hooks/useRol';
import { formatMoney } from '../lib/format';

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const ESTADOS_VALIDOS = ['confirmada', 'en_curso', 'completada'];
const ORIGEN_DIRECTO = new Set(['directa', 'agente_whatsapp', 'app_manual', 'walk_in', 'referido']);

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d) {
  return MES_LABELS[d.getMonth()];
}

function nightsInRange(entrada, salida, rangeStart, rangeEnd) {
  const a = new Date(`${entrada}T00:00:00`).getTime();
  const b = new Date(`${salida}T00:00:00`).getTime();
  const s = Math.max(a, rangeStart.getTime());
  const e = Math.min(b, rangeEnd.getTime());
  if (e <= s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: T.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: ${p.value?.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function ResumenTab() {
  const { data: chalets } = useChalets();
  const { isVentas } = useRol();
  const showFinancials = !isVentas;

  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rango: ultimos 6 meses + mes actual.
  const { sixMonthsAgo, monthStart, monthEnd, today } = useMemo(() => {
    const now = new Date();
    return {
      today: now,
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
      monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      sixMonthsAgo: new Date(now.getFullYear(), now.getMonth() - 5, 1),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('reservas')
        .select('id, monto_total, estado, origen, chalet_id, fecha_entrada, fecha_salida')
        .gte('fecha_entrada', sixMonthsAgo.toISOString().slice(0, 10))
        .lt('fecha_entrada', monthEnd.toISOString().slice(0, 10))
        .limit(1000);
      if (!cancelled) {
        setReservas(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sixMonthsAgo, monthEnd]);

  const chaletCount = chalets.length || 4;
  const daysInMonth = (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);

  const metrics = useMemo(() => {
    const active = reservas.filter((r) => ESTADOS_VALIDOS.includes(r.estado));
    const ofMonth = active.filter((r) => {
      const e = new Date(`${r.fecha_entrada}T00:00:00`);
      return e >= monthStart && e < monthEnd;
    });
    const ingresos = ofMonth.reduce((s, r) => s + Number(r.monto_total || 0), 0);
    const noches = active.reduce(
      (s, r) => s + nightsInRange(r.fecha_entrada, r.fecha_salida, monthStart, monthEnd),
      0,
    );
    const capacidad = chaletCount * daysInMonth;
    const ocupacion = capacidad > 0 ? Math.round((noches / capacidad) * 100) : 0;
    const totalCount = ofMonth.length;
    const directas = ofMonth.filter((r) => ORIGEN_DIRECTO.has(r.origen)).length;
    const pctDirectas = totalCount > 0 ? Math.round((directas / totalCount) * 100) : 0;
    return { ingresos, ocupacion, totalCount, pctDirectas };
  }, [reservas, monthStart, monthEnd, chaletCount, daysInMonth]);

  // Chart data: 6 ultimos meses por origen.
  const revenueData = useMemo(() => {
    const buckets = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets[monthKey(d)] = { month: monthLabel(d), airbnb: 0, directo: 0 };
    }
    reservas.filter((r) => ESTADOS_VALIDOS.includes(r.estado)).forEach((r) => {
      const d = new Date(`${r.fecha_entrada}T00:00:00`);
      const key = monthKey(d);
      const b = buckets[key];
      if (!b) return;
      const amount = Number(r.monto_total || 0);
      if (r.origen === 'airbnb' || r.origen === 'booking') b.airbnb += amount;
      else b.directo += amount;
    });
    return Object.values(buckets);
  }, [reservas, today]);

  const occupancyData = useMemo(() => {
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const days = (end - start) / (1000 * 60 * 60 * 24);
      const noches = reservas
        .filter((r) => ESTADOS_VALIDOS.includes(r.estado))
        .reduce((s, r) => s + nightsInRange(r.fecha_entrada, r.fecha_salida, start, end), 0);
      const capacidad = chaletCount * days;
      const rate = capacidad > 0 ? Math.round((noches / capacidad) * 100) : 0;
      buckets.push({ month: monthLabel(start), rate });
    }
    return buckets;
  }, [reservas, today, chaletCount]);

  const channelPie = useMemo(() => {
    let airbnb = 0, directo = 0, referido = 0;
    reservas.filter((r) => ESTADOS_VALIDOS.includes(r.estado)).forEach((r) => {
      if (r.origen === 'airbnb' || r.origen === 'booking') airbnb += 1;
      else if (r.origen === 'referido') referido += 1;
      else directo += 1;
    });
    const total = airbnb + directo + referido;
    if (total === 0) return [];
    return [
      { name: 'Airbnb', value: Math.round((airbnb / total) * 100), color: '#FF5A5F' },
      { name: 'Directo', value: Math.round((directo / total) * 100), color: T.gold },
      { name: 'Referido', value: Math.round((referido / total) * 100), color: T.green },
    ];
  }, [reservas]);

  const chaletEstado = useMemo(() => {
    const todayStr = today.toISOString().slice(0, 10);
    return chalets.map((c) => {
      const enCurso = reservas.find(
        (r) => r.chalet_id === c.id && r.estado === 'en_curso' &&
          r.fecha_entrada <= todayStr && r.fecha_salida > todayStr,
      );
      return {
        ...c,
        status: enCurso ? 'occupied' : 'available',
      };
    });
  }, [chalets, reservas, today]);

  const monthLabelTitle = MES_LABELS[today.getMonth()];

  return (
    <>
      <FadeIn>
        <SectionTitle>{monthLabelTitle} {today.getFullYear()}</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {showFinancials && (
            <MetricCard label="Ingresos" value={formatMoney(metrics.ingresos)} />
          )}
          <MetricCard label="Ocupación" value={`${metrics.ocupacion}%`} sub={`${chaletCount} chalets`} />
          <MetricCard label="Reservas" value={String(metrics.totalCount)} sub="del mes" />
          <MetricCard label="Directas" value={`${metrics.pctDirectas}%`} sub="del total" />
        </div>
      </FadeIn>

      <FadeIn delay={100}>
        <SectionTitle>Estado de chalets</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          {chaletEstado.map((c) => (
            <Card key={c.id} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8, gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>
                  {c.nombre}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>Capacidad: {c.capacidad}</div>
            </Card>
          ))}
        </div>
      </FadeIn>

      {showFinancials && (
        <FadeIn delay={200}>
          <SectionTitle>Ingresos por canal (6 meses)</SectionTitle>
          <Card>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="airbnb" name="Airbnb/Booking" fill="#FF5A5F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="directo" name="Directo" fill={T.gold} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={300}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
          <div>
            <SectionTitle>Ocupación mensual</SectionTitle>
            <Card>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={occupancyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => [`${v}%`, 'Ocupación']} labelStyle={{ color: T.muted }} />
                  <Line type="monotone" dataKey="rate" stroke={T.gold} strokeWidth={2} dot={{ fill: T.gold, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
          {channelPie.length > 0 && (
            <div>
              <SectionTitle>Canal de reserva</SectionTitle>
              <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={channelPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                      {channelPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {channelPie.map(c => (
                    <span key={c.name} style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                      {c.name} {c.value}%
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </FadeIn>

      {loading && (
        <div style={{ color: T.muted, fontSize: 12, padding: '12px 0' }}>Cargando métricas…</div>
      )}
    </>
  );
}
