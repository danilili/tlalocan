import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import Modal from '../components/Modal';
import FadeIn from '../components/FadeIn';
import StatusBadge from '../components/badges/StatusBadge';
import SourceBadge from '../components/badges/SourceBadge';
import { supabase } from '../lib/supabase';
import { useChalets } from '../hooks/useChalets';
import { useReservas } from '../hooks/useReservas';
import { formatMoney, formatDateShort } from '../lib/format';

// Ventana visible del timeline (días). Se navega de semana en semana.
const DIAS = 28;
const PASO = 7;

// Estados que se pintan (cancelada y no_show no ocupan calendario).
const ESTADOS_CAL = ['cotizada', 'pendiente_pago', 'confirmada', 'en_curso', 'completada'];

// Colores por estado sobre la paleta de la app.
const ESTILO_ESTADO = {
  confirmada: { bg: 'rgba(91,140,90,0.85)', border: T.green, color: '#F5F2E8' },
  en_curso: { bg: 'rgba(212,168,75,0.9)', border: T.gold, color: T.dark },
  pendiente_pago: { bg: 'rgba(184,80,66,0.55)', border: '#B85042', color: '#F5F2E8' },
  cotizada: { bg: 'rgba(184,80,66,0.18)', border: '#B85042', color: '#D08A7E', dashed: true },
  completada: { bg: 'rgba(160,152,130,0.30)', border: T.muted, color: T.muted },
};

const ESTILO_BLOQUEO = {
  bg: 'repeating-linear-gradient(45deg, rgba(160,152,130,0.45) 0 6px, rgba(160,152,130,0.15) 6px 12px)',
  border: T.muted,
  color: T.text,
};

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
}

export default function CalendarioTab() {
  const isMobile = useIsMobile();
  const hoy = useMemo(() => startOfDay(new Date()), []);
  const [inicio, setInicio] = useState(() => addDays(startOfDay(new Date()), -3));
  const [selected, setSelected] = useState(null);
  const [liberando, setLiberando] = useState(false);

  const desde = format(inicio, 'yyyy-MM-dd');
  const hasta = format(addDays(inicio, DIAS), 'yyyy-MM-dd');

  const { data: chalets } = useChalets();
  const { data: reservas, loading, error, refetch } = useReservas({
    desde,
    hasta,
    estado: ESTADOS_CAL,
  });

  const dias = useMemo(
    () => Array.from({ length: DIAS }, (_, i) => addDays(inicio, i)),
    [inicio],
  );
  const idxHoy = differenceInCalendarDays(hoy, inicio);

  const porChalet = useMemo(() => {
    const map = new Map();
    for (const r of reservas) {
      const key = r.chalet_id ?? r.chalet?.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  }, [reservas]);

  const liberarBloqueo = async (r) => {
    const ok = window.confirm(
      `¿Liberar el bloqueo de ${r.chalet?.nombre ?? 'chalet'} (${formatDateShort(r.fecha_entrada)} → ${formatDateShort(r.fecha_salida)})?`,
    );
    if (!ok) return;
    setLiberando(true);
    const { error: updError } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', r.id)
      .eq('origen', 'bloqueo');
    setLiberando(false);
    if (updError) window.alert(`No se pudo liberar el bloqueo: ${updError.message}`);
    else {
      setSelected(null);
      refetch();
    }
  };

  return (
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
          Calendario · {formatDateShort(dias[0])} → {formatDateShort(dias[DIAS - 1])}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btnNav} onClick={() => setInicio((d) => addDays(d, -PASO))}>←</button>
          <button type="button" style={btnNav} onClick={() => setInicio(addDays(hoy, -3))}>Hoy</button>
          <button type="button" style={btnNav} onClick={() => setInicio((d) => addDays(d, PASO))}>→</button>
        </div>
      </div>

      {error && (
        <div style={{ color: T.red, fontSize: 12, padding: '8px 0' }}>Error: {error.message}</div>
      )}

      {isMobile ? (
        <Agenda reservas={reservas} loading={loading} onSelect={setSelected} />
      ) : (
        <Timeline
          chalets={chalets}
          porChalet={porChalet}
          dias={dias}
          inicio={inicio}
          idxHoy={idxHoy}
          loading={loading}
          onSelect={setSelected}
        />
      )}

      <Leyenda />

      <DetalleReserva
        reserva={selected}
        onClose={() => setSelected(null)}
        onLiberar={liberarBloqueo}
        liberando={liberando}
      />
    </FadeIn>
  );
}

// ── Timeline desktop: filas = chalets, columnas = días, barras estilo Airbnb ──
function Timeline({ chalets, porChalet, dias, inicio, idxHoy, loading, onSelect }) {
  const colPct = 100 / DIAS;
  return (
    <Card style={{ padding: 0, overflowX: 'auto' }}>
      <div style={{ minWidth: DIAS * 34 + 120 }}>
        {/* Encabezado de días */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ width: 120, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>
            {dias.map((d, i) => {
              const esHoy = i === idxHoy;
              const inicioMes = d.getDate() === 1 || i === 0;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px 0 6px',
                    borderLeft: `1px solid ${i === 0 ? 'transparent' : T.border}`,
                    background: esHoy ? 'rgba(181,134,11,0.10)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>
                    {inicioMes
                      ? format(d, 'MMM', { locale: es })
                      : format(d, 'EEEEE', { locale: es })}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: esHoy ? 700 : 400,
                      color: esHoy ? T.goldLight : T.text,
                    }}
                  >
                    {format(d, 'd')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filas por chalet */}
        {chalets.map((c) => {
          const rs = porChalet.get(c.id) ?? [];
          return (
            <div
              key={c.id}
              style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, minHeight: 48 }}
            >
              <div
                style={{
                  width: 120,
                  flexShrink: 0,
                  padding: '14px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: T.goldLight,
                  borderRight: `1px solid ${T.border}`,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={c.nombre}
              >
                {c.nombre}
              </div>
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  backgroundImage: `linear-gradient(to right, ${T.border} 1px, transparent 1px)`,
                  backgroundSize: `${colPct}% 100%`,
                }}
              >
                {idxHoy >= 0 && idxHoy < DIAS && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${idxHoy * colPct}%`,
                      width: `${colPct}%`,
                      background: 'rgba(181,134,11,0.08)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {rs.map((r) => (
                  <Barra key={r.id} reserva={r} inicio={inicio} onSelect={onSelect} />
                ))}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ color: T.muted, fontSize: 12, padding: 12 }}>Cargando…</div>
        )}
      </div>
    </Card>
  );
}

// Barra de una reserva. Check-in/check-out a media celda (estilo Airbnb);
// si la reserva cruza el borde de la ventana se dibuja recortada, sin redondeo.
function Barra({ reserva: r, inicio, onSelect }) {
  const idxEntrada = differenceInCalendarDays(parseISO(r.fecha_entrada), inicio);
  const idxSalida = differenceInCalendarDays(parseISO(r.fecha_salida), inicio);
  if (idxSalida < 0 || idxEntrada >= DIAS) return null;

  const cortadaIzq = idxEntrada < 0;
  const cortadaDer = idxSalida >= DIAS;
  const desde = cortadaIzq ? 0 : idxEntrada + 0.5;
  const hastaPos = cortadaDer ? DIAS : idxSalida + 0.5;

  const esBloqueo = r.origen === 'bloqueo';
  const estilo = esBloqueo ? ESTILO_BLOQUEO : (ESTILO_ESTADO[r.estado] ?? ESTILO_ESTADO.completada);
  const etiqueta = esBloqueo
    ? (r.notas || 'Bloqueo')
    : [r.huesped?.nombre, r.huesped?.apellidos].filter(Boolean).join(' ') || 'Reserva';
  const saldo = Number(r.monto_total ?? 0) - Number(r.monto_pagado ?? 0);
  const tooltip = esBloqueo
    ? `Bloqueo · folio ${r.folio ?? '—'}\n${r.chalet?.nombre ?? ''}\n${formatDateShort(r.fecha_entrada)} → ${formatDateShort(r.fecha_salida)}\n${r.notas ?? ''}`
    : `Folio ${r.folio ?? '—'} · ${etiqueta}\n${formatDateShort(r.fecha_entrada)} → ${formatDateShort(r.fecha_salida)} · ${r.estado}\nTotal ${formatMoney(r.monto_total)} · Saldo ${formatMoney(saldo)}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(r)}
      title={tooltip}
      style={{
        position: 'absolute',
        top: 9,
        height: 30,
        left: `${(desde / DIAS) * 100}%`,
        width: `${((hastaPos - desde) / DIAS) * 100}%`,
        background: estilo.bg,
        border: `1px ${estilo.dashed ? 'dashed' : 'solid'} ${estilo.border}`,
        borderTopLeftRadius: cortadaIzq ? 0 : 15,
        borderBottomLeftRadius: cortadaIzq ? 0 : 15,
        borderTopRightRadius: cortadaDer ? 0 : 15,
        borderBottomRightRadius: cortadaDer ? 0 : 15,
        color: estilo.color,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        padding: '0 10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: 'left',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      {etiqueta}
    </button>
  );
}

// ── Vista agenda (móvil): lista cronológica agrupada por día de llegada ──
function Agenda({ reservas, loading, onSelect }) {
  const grupos = useMemo(() => {
    const map = new Map();
    const orden = [...reservas].sort((a, b) =>
      a.fecha_entrada.localeCompare(b.fecha_entrada));
    for (const r of orden) {
      if (!map.has(r.fecha_entrada)) map.set(r.fecha_entrada, []);
      map.get(r.fecha_entrada).push(r);
    }
    return [...map.entries()];
  }, [reservas]);

  if (loading) {
    return <div style={{ color: T.muted, fontSize: 12, padding: '8px 0' }}>Cargando…</div>;
  }
  if (grupos.length === 0) {
    return (
      <Card>
        <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
          Sin reservas en esta ventana.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grupos.map(([fecha, rs]) => (
        <div key={fecha}>
          <div
            style={{
              fontSize: 11,
              color: T.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              margin: '10px 0 6px',
            }}
          >
            Llegada {format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rs.map((r) => {
              const esBloqueo = r.origen === 'bloqueo';
              return (
                <Card
                  key={r.id}
                  onClick={() => onSelect(r)}
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.goldLight,
                      background: 'rgba(181,134,11,0.12)',
                      padding: '2px 8px',
                      borderRadius: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.chalet?.nombre ?? '—'}
                  </span>
                  <span style={{ fontSize: 13, flex: 1, minWidth: 100, color: esBloqueo ? T.muted : T.text }}>
                    {esBloqueo
                      ? (r.notas || 'Bloqueo operativo')
                      : [r.huesped?.nombre, r.huesped?.apellidos].filter(Boolean).join(' ') || 'Reserva'}
                  </span>
                  <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>
                    → {formatDateShort(r.fecha_salida)}
                  </span>
                  {esBloqueo ? <SourceBadge source="bloqueo" /> : <StatusBadge status={r.estado} />}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Leyenda() {
  const items = [
    ['Confirmada', ESTILO_ESTADO.confirmada],
    ['En curso', ESTILO_ESTADO.en_curso],
    ['Pendiente / cotizada', ESTILO_ESTADO.pendiente_pago],
    ['Completada', ESTILO_ESTADO.completada],
    ['Bloqueo', ESTILO_BLOQUEO],
  ];
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '12px 2px 0' }}>
      {items.map(([label, s]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
          <span
            style={{
              width: 22,
              height: 10,
              borderRadius: 5,
              background: s.bg,
              border: `1px solid ${s.border}`,
              display: 'inline-block',
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function DetalleReserva({ reserva: r, onClose, onLiberar, liberando }) {
  if (!r) return null;
  const esBloqueo = r.origen === 'bloqueo';
  const saldo = Number(r.monto_total ?? 0) - Number(r.monto_pagado ?? 0);
  return (
    <Modal open={!!r} onClose={onClose} maxWidth={420}
           title={esBloqueo ? 'Bloqueo operativo' : `Reserva · folio ${r.folio ?? '—'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        {!esBloqueo && (
          <Fila label="Huésped"
                value={[r.huesped?.nombre, r.huesped?.apellidos].filter(Boolean).join(' ') || '—'} />
        )}
        <Fila label="Chalet" value={r.chalet?.nombre ?? '—'} />
        <Fila label="Fechas"
              value={`${formatDateShort(r.fecha_entrada)} → ${formatDateShort(r.fecha_salida)}`} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Estado
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            {esBloqueo && <SourceBadge source="bloqueo" />}
            <StatusBadge status={r.estado} />
          </span>
        </div>
        {!esBloqueo && (
          <>
            <Fila label="Total" value={formatMoney(r.monto_total)} />
            <Fila label="Saldo" value={formatMoney(saldo)} highlight={saldo > 0} />
          </>
        )}
        {r.notas && <Fila label={esBloqueo ? 'Motivo' : 'Notas'} value={r.notas} />}

        {esBloqueo && r.estado !== 'cancelada' && (
          <button
            type="button"
            onClick={() => onLiberar(r)}
            disabled={liberando}
            style={{
              marginTop: 8,
              background: 'transparent',
              color: T.red,
              border: `1px solid ${T.red}`,
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: liberando ? 'not-allowed' : 'pointer',
              opacity: liberando ? 0.5 : 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {liberando ? 'Liberando…' : '🔓 Liberar bloqueo'}
          </button>
        )}
      </div>
    </Modal>
  );
}

function Fila({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </span>
      <span style={{ color: highlight ? T.goldLight : T.text, fontWeight: highlight ? 600 : 400, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

const btnNav = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
