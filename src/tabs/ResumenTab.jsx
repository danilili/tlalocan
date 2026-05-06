import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/badges/StatusBadge';
import SourceBadge from '../components/badges/SourceBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';

// TODO(commit 14): reemplazar por queries reales con useChalets/useReservas.
const chalets = [
  { id: 1, name: 'De La Entrada', price: 3000, status: 'occupied', guest: 'Ana García', checkin: '7 Abr', checkout: '11 Abr', source: 'airbnb' },
  { id: 2, name: 'Del Fondo', price: 1590, status: 'cleaning', guest: null, checkin: null, checkout: null, source: null },
  { id: 3, name: 'De La Cima', price: 690, status: 'available', guest: null, checkin: null, checkout: null, source: null },
  { id: 4, name: 'De La Cañada', price: 1190, status: 'occupied', guest: 'Carlos Mendoza', checkin: '9 Abr', checkout: '12 Abr', source: 'direct' },
];

const revenueData = [
  { month: 'Nov', airbnb: 18200, directo: 4800 },
  { month: 'Dic', airbnb: 38500, directo: 12200 },
  { month: 'Ene', airbnb: 22100, directo: 8900 },
  { month: 'Feb', airbnb: 28400, directo: 15600 },
  { month: 'Mar', airbnb: 31200, directo: 19800 },
  { month: 'Abr', airbnb: 14600, directo: 11200 },
];

const occupancyData = [
  { month: 'Nov', rate: 58 },
  { month: 'Dic', rate: 92 },
  { month: 'Ene', rate: 65 },
  { month: 'Feb', rate: 78 },
  { month: 'Mar', rate: 82 },
  { month: 'Abr', rate: 50 },
];

const channelPie = [
  { name: 'Airbnb', value: 62, color: '#FF5A5F' },
  { name: 'Directo', value: 30, color: T.gold },
  { name: 'Referido', value: 8, color: T.green },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div style={{ background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
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
  return (
    <>
      <FadeIn>
        <SectionTitle>Abril 2026</SectionTitle>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricCard label="Ingresos" value="$25,800" sub="+8% vs Mar" trend="up" />
          <MetricCard label="Ocupación" value="50%" sub="2 de 4 chalets" />
          <MetricCard label="Reservas" value="7" sub="3 pendientes" />
          <MetricCard label="Directas" value="43%" sub="+12% vs Mar" trend="up" />
        </div>
      </FadeIn>

      <FadeIn delay={100}>
        <SectionTitle>Estado de chalets</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          {chalets.map(c => (
            <Card key={c.id} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10, gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{c.name}</div>
                <StatusBadge status={c.status} />
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>${c.price.toLocaleString()}/noche</div>
              {c.guest && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{c.guest}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{c.checkin} → {c.checkout}</div>
                  <div style={{ marginTop: 4 }}><SourceBadge source={c.source} /></div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <SectionTitle>Ingresos por canal (6 meses)</SectionTitle>
        <Card>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="airbnb" name="Airbnb" fill="#FF5A5F" radius={[4, 4, 0, 0]} />
              <Bar dataKey="directo" name="Directo" fill={T.gold} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF5A5F', display: 'inline-block' }} /> Airbnb
            </span>
            <span style={{ fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: T.gold, display: 'inline-block' }} /> Directo
            </span>
          </div>
        </Card>
      </FadeIn>

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
        </div>
      </FadeIn>
    </>
  );
}
