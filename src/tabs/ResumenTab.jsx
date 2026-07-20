import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { addDays, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/badges/StatusBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import { useChalets } from '../hooks/useChalets';
import { useConfig } from '../hooks/useConfig';
import { useRol } from '../hooks/useRol';
import { formatMoney, formatMoneyRounded, formatDate } from '../lib/format';

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const ESTADOS_VALIDOS = ['confirmada', 'en_curso', 'completada'];
const ORIGEN_DIRECTO = new Set(['directa', 'agente_whatsapp', 'app_manual', 'walk_in', 'referido']);

// Presets del selector de período. 'personalizado' habilita los inputs de fecha.
const PRESETS = [
  { id: 'mes_actual', label: 'Mes actual' },
  { id: 'mes_anterior', label: 'Mes anterior' },
  { id: 'ultimos_30', label: 'Últimos 30 días' },
  { id: 'ultimos_90', label: 'Últimos 3 meses' },
  { id: 'personalizado', label: 'Personalizado' },
];

const toStr = (d) => format(d, 'yyyy-MM-dd');

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d) {
  return MES_LABELS[d.getMonth()];
}

// ── Venta neta (sin impuestos) por reserva ──
// · Airbnb/Booking: la plataforma cobra y remite sus impuestos aparte; la venta
//   es la tarifa que fijamos menos promos del canal = airbnb_precio_huesped
//   (fallback: payout, monto_total).
// · Canales directos (Valentina, Tlali, cortesías…): lo cobrado INCLUYE
//   impuestos y puede traer descuentos discrecionales. Si el desglose guardado
//   cuadra con el monto, neta = cobrado − IVA − ISH; si quedó desfasado (monto
//   editado a mano), se quitan matemáticamente: cobrado / 1.21 (16% + 5% sobre neto).
// · Website: el import guarda el desglose exacto de MotoPress → cae en el caso
//   consistente.
const FACTOR_IMPUESTOS = 1.21;

function ventaNeta(r) {
  if (r.origen === 'airbnb' || r.origen === 'booking') {
    return Number(r.airbnb_precio_huesped ?? r.airbnb_payout ?? r.monto_total ?? 0);
  }
  const total = Number(r.monto_total || 0);
  if (total <= 0) return 0;
  const sub = Number(r.subtotal_neto || 0);
  const iva = Number(r.iva || 0);
  const imp = Number(r.impuesto_hospedaje || 0);
  if (sub > 0 && Math.abs(sub + iva + imp - total) <= 1) return total - iva - imp;
  return total / FACTOR_IMPUESTOS;
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
  const { data: config } = useConfig();
  const { isVentas } = useRol();
  const showFinancials = !isVentas;

  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);

  // "Hoy" en hora LOCAL (toISOString es UTC y después de las 6pm ya marcaba mañana).
  const { today, todayStr, monthStart, monthEnd, sixMonthsAgo } = useMemo(() => {
    const now = new Date();
    return {
      today: now,
      todayStr: toStr(now),
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
      monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      sixMonthsAgo: new Date(now.getFullYear(), now.getMonth() - 5, 1),
    };
  }, []);

  // ── Selector de período ──
  const [preset, setPreset] = useState('mes_actual');
  // Inputs del rango manual (inclusivos, como los piensa el usuario).
  const [custom, setCustom] = useState({ desde: toStr(monthStart), hasta: todayStr });

  // Rango efectivo: start inclusivo, end EXCLUSIVO.
  const rango = useMemo(() => {
    const hoy0 = new Date(`${todayStr}T00:00:00`);
    switch (preset) {
      case 'mes_anterior':
        return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: monthStart };
      case 'ultimos_30':
        return { start: addDays(hoy0, -29), end: addDays(hoy0, 1) };
      case 'ultimos_90':
        return { start: addDays(hoy0, -89), end: addDays(hoy0, 1) };
      case 'personalizado': {
        const desde = custom.desde ? new Date(`${custom.desde}T00:00:00`) : monthStart;
        const hastaIncl = custom.hasta ? new Date(`${custom.hasta}T00:00:00`) : hoy0;
        const end = addDays(hastaIncl, 1);
        return end > desde ? { start: desde, end } : { start: desde, end: addDays(desde, 1) };
      }
      case 'mes_actual':
      default:
        return { start: monthStart, end: monthEnd };
    }
  }, [preset, custom, today, todayStr, monthStart, monthEnd]);

  const rangoLabel = `${formatDate(toStr(rango.start))} – ${formatDate(toStr(addDays(rango.end, -1)))}`;

  // Fetch por SOLAPE (no solo por entrada): cubre el rango elegido aunque esté
  // fuera de los 6 meses de las series, e incluye estancias que empezaron antes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fetchDesde = rango.start < sixMonthsAgo ? rango.start : sixMonthsAgo;
      const fetchHasta = rango.end > monthEnd ? rango.end : monthEnd;
      const { data } = await supabase
        .from('reservas')
        .select('id, monto_total, monto_pagado, subtotal_neto, iva, impuesto_hospedaje, airbnb_precio_huesped, airbnb_payout, num_mascotas, estado, origen, chalet_id, fecha_entrada, fecha_salida')
        .gte('fecha_salida', toStr(fetchDesde))
        .lt('fecha_entrada', toStr(fetchHasta))
        .limit(2000);
      if (!cancelled) {
        setReservas(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rango, sixMonthsAgo, monthEnd]);

  const chaletCount = chalets.length || 4;
  const daysInRange = Math.round((rango.end.getTime() - rango.start.getTime()) / (1000 * 60 * 60 * 24));
  const rangeStartStr = toStr(rango.start);
  const rangeEndStr = toStr(rango.end);

  // ── Métricas del período seleccionado ──
  // Los bloqueos operativos ocupan noches (cuentan en Ocupación) pero no son
  // ventas: quedan fuera de Reservas, % Directas, Ingresos y Ventas netas.
  const metrics = useMemo(() => {
    const active = reservas.filter((r) => ESTADOS_VALIDOS.includes(r.estado));
    const ofRange = active.filter(
      (r) =>
        r.origen !== 'bloqueo' &&
        r.fecha_entrada >= rangeStartStr &&
        r.fecha_entrada < rangeEndStr,
    );
    const ingresos = ofRange.reduce((s, r) => s + Number(r.monto_total || 0), 0);
    const ventasNetas = ofRange.reduce((s, r) => s + ventaNeta(r), 0);
    const noches = active.reduce(
      (s, r) => s + nightsInRange(r.fecha_entrada, r.fecha_salida, rango.start, rango.end),
      0,
    );
    const capacidad = chaletCount * daysInRange;
    const ocupacion = capacidad > 0 ? Math.round((noches / capacidad) * 100) : 0;
    const totalCount = ofRange.length;
    const directas = ofRange.filter((r) => ORIGEN_DIRECTO.has(r.origen)).length;
    const pctDirectas = totalCount > 0 ? Math.round((directas / totalCount) * 100) : 0;
    return { ingresos, ventasNetas, ocupacion, totalCount, pctDirectas };
  }, [reservas, rango, rangeStartStr, rangeEndStr, chaletCount, daysInRange]);

  // ── Series históricas fijas (6 meses; no dependen del selector) ──
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

  // ── Distribuciones del período seleccionado ──
  const delPeriodo = useMemo(
    () =>
      reservas.filter(
        (r) =>
          ESTADOS_VALIDOS.includes(r.estado) &&
          r.origen !== 'bloqueo' &&
          r.fecha_entrada >= rangeStartStr &&
          r.fecha_entrada < rangeEndStr,
      ),
    [reservas, rangeStartStr, rangeEndStr],
  );

  const channelPie = useMemo(() => {
    let airbnb = 0, directo = 0, referido = 0;
    delPeriodo.forEach((r) => {
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
  }, [delPeriodo]);

  // Reservas pagadas del período: con monto y saldadas (excluye bloqueos $0).
  const pagadas = useMemo(
    () =>
      delPeriodo.filter(
        (r) =>
          Number(r.monto_total) > 0 &&
          Number(r.monto_pagado || 0) >= Number(r.monto_total) - 0.009,
      ),
    [delPeriodo],
  );

  const duracionData = useMemo(() => {
    const buckets = { 1: 0, 2: 0, 3: 0 };
    pagadas.forEach((r) => {
      const noches = Math.round(
        (new Date(`${r.fecha_salida}T00:00:00`) - new Date(`${r.fecha_entrada}T00:00:00`)) /
          (1000 * 60 * 60 * 24),
      );
      if (noches <= 1) buckets[1] += 1;
      else if (noches === 2) buckets[2] += 1;
      else if (noches >= 3) buckets[3] += 1;
    });
    return [
      { label: '1 noche', count: buckets[1] },
      { label: '2 noches', count: buckets[2] },
      { label: '3+ noches', count: buckets[3] },
    ];
  }, [pagadas]);

  const mascotasPie = useMemo(() => {
    let con = 0;
    let sin = 0;
    pagadas.forEach((r) => {
      if (Number(r.num_mascotas || 0) > 0) con += 1;
      else sin += 1;
    });
    const total = con + sin;
    if (total === 0) return [];
    return [
      { name: 'Con mascota', value: con, pct: Math.round((con / total) * 100), color: T.green },
      { name: 'Sin mascota', value: sin, pct: Math.round((sin / total) * 100), color: T.gold },
    ];
  }, [pagadas]);

  // ── Estado de chalets: una salida de HOY sigue ocupando hasta la hora de
  // checkout (config.checkout_hora, default 11:00) ──
  const chaletEstado = useMemo(() => {
    const checkoutHora = String(config.checkout_hora || '11:00');
    const antesDeCheckout = new Date() < new Date(`${todayStr}T${checkoutHora}:00`);
    return chalets.map((c) => {
      const enCurso = reservas.find(
        (r) =>
          r.chalet_id === c.id &&
          r.estado === 'en_curso' &&
          r.fecha_entrada <= todayStr &&
          (r.fecha_salida > todayStr || (r.fecha_salida === todayStr && antesDeCheckout)),
      );
      return {
        ...c,
        status: enCurso ? 'occupied' : 'available',
        saleHoy: !!enCurso && enCurso.fecha_salida === todayStr,
        checkoutHora,
      };
    });
  }, [chalets, reservas, todayStr, config.checkout_hora]);

  return (
    <>
      <FadeIn>
        <SectionTitle>{rangoLabel}</SectionTitle>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              style={{
                background: preset === p.id ? 'rgba(181,134,11,0.18)' : 'transparent',
                color: preset === p.id ? T.goldLight : T.muted,
                border: `1px solid ${preset === p.id ? 'rgba(181,134,11,0.5)' : T.border}`,
                borderRadius: 20,
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: preset === p.id ? 600 : 400,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </button>
          ))}
          {preset === 'personalizado' && (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                value={custom.desde}
                max={custom.hasta || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, desde: e.target.value }))}
                style={dateInputStyle}
              />
              <span style={{ color: T.muted, fontSize: 12 }}>→</span>
              <input
                type="date"
                value={custom.hasta}
                min={custom.desde || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, hasta: e.target.value }))}
                style={dateInputStyle}
              />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {showFinancials && (
            <MetricCard
              label="Ventas netas"
              value={formatMoneyRounded(metrics.ventasNetas)}
              sub="sin impuestos"
              info="Valor de venta sin impuestos de las reservas con entrada en el período (confirmadas, en curso o completadas). Directas y Tlali: lo cobrado menos IVA 16% e ISH 5% — respeta los descuentos especiales. Airbnb: la tarifa que cobró el canal, antes de su comisión (los impuestos los remite Airbnb). Excluye bloqueos y canceladas. Es el número comparable entre canales."
            />
          )}
          {showFinancials && (
            <MetricCard
              label="Ingresos"
              value={formatMoneyRounded(metrics.ingresos)}
              sub="con impuestos"
              info="Lo cobrado al huésped (monto total) de las reservas del período. En canales directos incluye impuestos; en Airbnb es el depósito esperado (payout, ya sin la comisión de Airbnb). Útil como flujo de dinero, pero no comparable entre canales — para comparar usa Ventas netas."
            />
          )}
          <MetricCard
            label="Ocupación"
            value={`${metrics.ocupacion}%`}
            sub={`${chaletCount} chalets · ${daysInRange} días`}
            info="Noches ocupadas ÷ noches disponibles (chalets × días del período). Cuenta reservas confirmadas, en curso y completadas — incluidos bloqueos operativos y estancias que solo se traslapan parcialmente con el período."
          />
          <MetricCard
            label="Reservas"
            value={String(metrics.totalCount)}
            sub="del período"
            info="Cantidad de reservas con fecha de entrada dentro del período (confirmadas, en curso o completadas). No incluye bloqueos operativos ni canceladas."
          />
          <MetricCard
            label="Directas"
            value={`${metrics.pctDirectas}%`}
            sub="del total"
            info="Porcentaje de las reservas del período —por cantidad, no por dinero— que llegaron por canales propios sin comisión de plataforma: directa, Tlali (WhatsApp), captura manual, walk-in y referidos."
          />
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
              <div style={{ fontSize: 11, color: T.muted }}>
                Capacidad: {c.capacidad}
                {c.saleHoy ? ` · Sale hoy (checkout ${c.checkoutHora})` : ''}
              </div>
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
              <SectionTitle>Canal de reserva · período</SectionTitle>
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

      <FadeIn delay={400}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
          <div>
            <SectionTitle>Duración de estancia · pagadas del período</SectionTitle>
            <Card>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={duracionData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Reservas']}
                    labelStyle={{ color: T.muted }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="count" name="Reservas" fill={T.gold} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          {mascotasPie.length > 0 && (
            <div>
              <SectionTitle>Mascotas · pagadas del período</SectionTitle>
              <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={mascotasPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                      {mascotasPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {mascotasPie.map((c) => (
                    <span key={c.name} style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                      {c.name}: {c.value} ({c.pct}%)
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

const dateInputStyle = {
  background: T.dark,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '5px 8px',
  color: T.text,
  fontSize: 12,
  outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
  colorScheme: 'dark',
};
