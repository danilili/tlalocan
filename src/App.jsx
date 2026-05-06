import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { T } from "./lib/design-tokens";

/* ─── Hardcoded Data ─── */
const chalets = [
  { id: 1, name: "De La Entrada", price: 3000, status: "occupied", guest: "Ana García", checkin: "7 Abr", checkout: "11 Abr", source: "airbnb" },
  { id: 2, name: "Del Fondo", price: 1590, status: "cleaning", guest: null, checkin: null, checkout: null, source: null },
  { id: 3, name: "De La Cima", price: 690, status: "available", guest: null, checkin: null, checkout: null, source: null },
  { id: 4, name: "De La Cañada", price: 1190, status: "occupied", guest: "Carlos Mendoza", checkin: "9 Abr", checkout: "12 Abr", source: "direct" },
];

const revenueData = [
  { month: "Nov", airbnb: 18200, directo: 4800 },
  { month: "Dic", airbnb: 38500, directo: 12200 },
  { month: "Ene", airbnb: 22100, directo: 8900 },
  { month: "Feb", airbnb: 28400, directo: 15600 },
  { month: "Mar", airbnb: 31200, directo: 19800 },
  { month: "Abr", airbnb: 14600, directo: 11200 },
];

const occupancyData = [
  { month: "Nov", rate: 58 },
  { month: "Dic", rate: 92 },
  { month: "Ene", rate: 65 },
  { month: "Feb", rate: 78 },
  { month: "Mar", rate: 82 },
  { month: "Abr", rate: 50 },
];

const channelPie = [
  { name: "Airbnb", value: 62, color: "#FF5A5F" },
  { name: "Directo", value: 30, color: T.gold },
  { name: "Referido", value: 8, color: T.green },
];

const upcomingBookings = [
  { guest: "Laura Jiménez", chalet: "De La Cima", checkin: "12 Abr", checkout: "14 Abr", source: "direct", amount: 1380 },
  { guest: "Roberto Sánchez", chalet: "De La Entrada", checkin: "12 Abr", checkout: "15 Abr", source: "airbnb", amount: 9000 },
  { guest: "María Torres", chalet: "Del Fondo", checkin: "14 Abr", checkout: "16 Abr", source: "airbnb", amount: 3180 },
  { guest: "Diego Ramírez", chalet: "De La Cañada", checkin: "15 Abr", checkout: "17 Abr", source: "direct", amount: 2380 },
];

const staffTasks = [
  { staff: "Lupita", task: "Limpieza - Del Fondo", status: "in_progress", time: "Iniciada hace 45 min" },
  { staff: "Don Pedro", task: "Revisión gas - De La Cima", status: "pending", time: "Pendiente" },
  { staff: "Lupita", task: "Prep. llegada - De La Cima", status: "pending", time: "Para mañana 2pm" },
];

const topGuests = [
  { name: "Ana García", visits: 5, totalSpent: 24600, lastVisit: "Abr 2026" },
  { name: "Carlos Mendoza", visits: 3, totalSpent: 12800, lastVisit: "Abr 2026" },
  { name: "Patricia Vega", visits: 3, totalSpent: 11400, lastVisit: "Mar 2026" },
  { name: "Fernando López", visits: 2, totalSpent: 8200, lastVisit: "Feb 2026" },
];

/* ─── Reusable Components ─── */

function FadeIn({ children, delay = 0, style }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    occupied: { label: "Ocupado", bg: "rgba(181,134,11,0.15)", color: T.goldLight },
    available: { label: "Disponible", bg: "rgba(91,140,90,0.15)", color: T.green },
    cleaning: { label: "Limpieza", bg: "rgba(160,152,130,0.15)", color: T.muted },
  };
  const c = cfg[status];
  return <span style={{ background: c.bg, color: c.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{c.label}</span>;
}

function SourceBadge({ source }) {
  if (!source) return null;
  const a = source === "airbnb";
  return (
    <span style={{
      background: a ? "rgba(255,90,95,0.12)" : "rgba(181,134,11,0.12)",
      color: a ? "#FF5A5F" : T.goldLight,
      padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase",
    }}>
      {a ? "Airbnb" : "Directo"}
    </span>
  );
}

function TaskBadge({ status }) {
  const cfg = {
    in_progress: { label: "En curso", color: T.goldLight },
    pending: { label: "Pendiente", color: T.muted },
    completed: { label: "Listo", color: T.green },
  };
  const c = cfg[status];
  return <span style={{ color: c.color, fontSize: 11, fontWeight: 500 }}>{c.label}</span>;
}

function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card, borderRadius: 14, border: `1px solid ${T.border}`,
        padding: "20px 22px",
        transition: "border-color 0.2s, transform 0.15s",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "translateY(0)"; } }}
    >
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, trend }) {
  return (
    <Card style={{ flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: T.text, lineHeight: 1.1 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: trend === "up" ? T.green : trend === "down" ? T.red : T.muted, marginTop: 4 }}>
          {trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}{sub}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 500, color: T.muted, letterSpacing: 1.2, textTransform: "uppercase", margin: "32px 0 14px" }}>
      {children}
    </h2>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div style={{ background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <div style={{ color: T.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: ${p.value?.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

/* ─── Tab Content ─── */

function ResumenTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Abril 2026</SectionTitle>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MetricCard label="Ingresos" value="$25,800" sub="+8% vs Mar" trend="up" />
          <MetricCard label="Ocupación" value="50%" sub="2 de 4 chalets" />
          <MetricCard label="Reservas" value="7" sub="3 pendientes" />
          <MetricCard label="Directas" value="43%" sub="+12% vs Mar" trend="up" />
        </div>
      </FadeIn>

      <FadeIn delay={100}>
        <SectionTitle>Estado de chalets</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {chalets.map(c => (
            <Card key={c.id} style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10, gap: 8 }}>
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
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#FF5A5F", display: "inline-block" }} /> Airbnb
            </span>
            <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: T.gold, display: "inline-block" }} /> Directo
            </span>
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={300}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
          <div>
            <SectionTitle>Ocupación mensual</SectionTitle>
            <Card>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={occupancyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} formatter={v => [`${v}%`, "Ocupación"]} labelStyle={{ color: T.muted }} />
                  <Line type="monotone" dataKey="rate" stroke={T.gold} strokeWidth={2} dot={{ fill: T.gold, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <div>
            <SectionTitle>Canal de reserva</SectionTitle>
            <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={channelPie} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                    {channelPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                {channelPie.map(c => (
                  <span key={c.name} style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, display: "inline-block" }} />
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

function ReservasTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Próximas reservas</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcomingBookings.map((b, i) => (
            <FadeIn key={i} delay={i * 60}>
              <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{b.guest}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{b.chalet}</div>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>{b.checkin} → {b.checkout}</div>
                <SourceBadge source={b.source} />
                <div style={{ fontSize: 14, fontWeight: 600, color: T.goldLight, minWidth: 70, textAlign: "right" }}>${b.amount.toLocaleString()}</div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Calendario de abril</SectionTitle>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map(d => (
              <div key={d} style={{ fontSize: 10, color: T.muted, padding: 6, letterSpacing: 0.5 }}>{d}</div>
            ))}
            {[null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day, i) => {
              if (!day) return <div key={i} />;
              const isToday = day === 10;
              const isBooked = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].includes(day);
              return (
                <div key={i} style={{
                  padding: "8px 4px", borderRadius: 6, fontSize: 12,
                  background: isToday ? T.gold : isBooked ? "rgba(181,134,11,0.08)" : "transparent",
                  color: isToday ? T.dark : isBooked ? T.goldLight : T.muted,
                  fontWeight: isToday ? 600 : 400,
                  border: isBooked && !isToday ? "1px solid rgba(181,134,11,0.15)" : "1px solid transparent",
                  transition: "all 0.2s",
                }}>
                  {day}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.gold, display: "inline-block" }} /> Hoy
            </span>
            <span style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px solid rgba(181,134,11,0.3)", display: "inline-block" }} /> Con reserva
            </span>
          </div>
        </Card>
      </FadeIn>
    </>
  );
}

function HuespedesTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Huéspedes frecuentes</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {topGuests.map((g, i) => (
            <FadeIn key={i} delay={i * 60}>
              <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", background: "rgba(181,134,11,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 500, color: T.goldLight, flexShrink: 0,
                }}>
                  {g.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{g.visits} estancias · Última: {g.lastVisit}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.goldLight }}>${g.totalSpent.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>total gastado</div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Resumen CRM</SectionTitle>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MetricCard label="Total huéspedes" value="34" sub="este año" />
          <MetricCard label="Repetidores" value="12" sub="35% del total" trend="up" />
          <MetricCard label="Ticket promedio" value="$2,840" sub="por estancia" />
        </div>
      </FadeIn>
    </>
  );
}

function StaffTab() {
  return (
    <>
      <FadeIn>
        <SectionTitle>Tareas pendientes</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {staffTasks.map((t, i) => (
            <FadeIn key={i} delay={i * 60}>
              <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.task}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Asignado: {t.staff}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <TaskBadge status={t.status} />
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{t.time}</div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <SectionTitle>Equipo</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { name: "Lupita Hernández", role: "Limpieza", tasks: 2 },
            { name: "Don Pedro", role: "Mantenimiento", tasks: 1 },
          ].map((s, i) => (
            <Card key={i} style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "rgba(91,140,90,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.green, fontWeight: 500,
                }}>
                  {s.name.split(" ")[0][0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>
                {s.tasks} tarea{s.tasks > 1 ? "s" : ""} pendiente{s.tasks > 1 ? "s" : ""} · <span style={{ color: T.green }}>Activo</span>
              </div>
            </Card>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <SectionTitle>Gastos operativos (abril)</SectionTitle>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MetricCard label="Limpieza" value="$2,400" />
          <MetricCard label="Insumos" value="$1,850" />
          <MetricCard label="Mantenimiento" value="$600" />
          <MetricCard label="Utilidad neta" value="$20,950" sub="81% margen" trend="up" />
        </div>
      </FadeIn>
    </>
  );
}

/* ─── Main App ─── */

const tabs = ["Resumen", "Reservas", "Huéspedes", "Staff"];

export default function App() {
  const [activeTab, setActiveTab] = useState("Resumen");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginFade, setLoginFade] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoginFade(true), 100);
  }, []);

  if (!loggedIn) {
    return (
      <div style={{
        minHeight: "100vh", background: T.dark, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}>
        <div style={{
          textAlign: "center", maxWidth: 360, padding: "0 24px", width: "100%",
          opacity: loginFade ? 1 : 0, transform: loginFade ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s ease",
        }}>
          <div style={{ fontSize: 48, fontWeight: 300, color: T.gold, letterSpacing: 6, marginBottom: 4 }}>TLALOCAN</div>
          <div style={{ fontSize: 12, color: T.muted, letterSpacing: 8, textTransform: "uppercase", marginBottom: 56 }}>Chalets</div>

          <div style={{ fontSize: 11, color: T.muted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 24 }}>Panel de control</div>

          <div style={{ textAlign: "left" }}>
            <label style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Usuario</label>
            <input
              type="text"
              defaultValue="admin@tlalocan"
              style={{
                width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: "13px 16px", color: T.text, fontSize: 14, marginBottom: 18, boxSizing: "border-box",
                outline: "none", transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = T.gold}
              onBlur={e => e.target.style.borderColor = T.border}
            />
            <label style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Contraseña</label>
            <input
              type="password"
              defaultValue="password"
              style={{
                width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: "13px 16px", color: T.text, fontSize: 14, marginBottom: 32, boxSizing: "border-box",
                outline: "none", transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = T.gold}
              onBlur={e => e.target.style.borderColor = T.border}
            />
          </div>

          <button
            onClick={() => setLoggedIn(true)}
            style={{
              width: "100%", background: T.gold, color: T.dark, border: "none", borderRadius: 10, padding: "14px",
              fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "opacity 0.2s, transform 0.1s",
            }}
            onMouseEnter={e => e.target.style.opacity = "0.85"}
            onMouseLeave={e => e.target.style.opacity = "1"}
            onMouseDown={e => e.target.style.transform = "scale(0.98)"}
            onMouseUp={e => e.target.style.transform = "scale(1)"}
          >
            Entrar
          </button>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 20, fontStyle: "italic", fontFamily: "'DM Sans', sans-serif" }}>
            Demo — cualquier credencial funciona
          </div>
        </div>
      </div>
    );
  }

  const tabContent = {
    Resumen: <ResumenTab />,
    Reservas: <ReservasTab />,
    "Huéspedes": <HuespedesTab />,
    Staff: <StaffTab />,
  };

  return (
    <div style={{ minHeight: "100vh", background: T.dark }}>
      {/* Header */}
      <div style={{
        padding: "14px 24px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: T.dark, zIndex: 10,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 300, color: T.gold, letterSpacing: 3 }}>TLALOCAN</span>
          <span style={{ fontSize: 10, color: T.muted, letterSpacing: 2, textTransform: "uppercase" }}>Panel de control</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "rgba(181,134,11,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.goldLight, fontWeight: 500,
          }}>
            TC
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 24px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              background: "none", border: "none", padding: "14px 18px", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === t ? 500 : 400,
              color: activeTab === t ? T.goldLight : T.muted,
              borderBottom: activeTab === t ? `2px solid ${T.gold}` : "2px solid transparent",
              transition: "all 0.2s", whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "0 24px 48px", maxWidth: 820, margin: "0 auto" }}>
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
