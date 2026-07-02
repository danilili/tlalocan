import { useMemo, useState } from 'react';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isBefore,
  isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { T } from '../lib/design-tokens';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Selector de rango entrada→salida con noches ocupadas bloqueadas.
// occupied: Set<'YYYY-MM-DD'> de NOCHES ocupadas. El día de salida de una
// reserva existente sí es seleccionable como salida propia (la noche manda).
export default function RangeCalendar({ entrada, salida, onChange, occupied, disabled }) {
  const hoy = useMemo(() => parseISO(format(new Date(), 'yyyy-MM-dd')), []);
  const [mes, setMes] = useState(() => startOfMonth(entrada ? parseISO(entrada) : new Date()));
  const [aviso, setAviso] = useState(null);

  const entradaDate = entrada ? parseISO(entrada) : null;
  const salidaDate = salida ? parseISO(salida) : null;

  const rangoLibre = (desde, hasta) => {
    let d = desde;
    while (d < hasta) {
      if (occupied.has(format(d, 'yyyy-MM-dd'))) return false;
      d = addDays(d, 1);
    }
    return true;
  };

  const clickDia = (dia) => {
    if (disabled) return;
    setAviso(null);
    if (isBefore(dia, hoy)) return;
    const key = format(dia, 'yyyy-MM-dd');
    const nocheOcupada = occupied.has(key);

    const empezarEn = () => {
      if (nocheOcupada) { setAviso('Esa noche ya está ocupada.'); return; }
      onChange({ entrada: key, salida: '' });
    };

    if (!entradaDate || salidaDate || !isBefore(entradaDate, dia)) {
      empezarEn();
      return;
    }
    if (rangoLibre(entradaDate, dia)) {
      onChange({ entrada, salida: key });
    } else {
      setAviso('El rango cruza noches ocupadas; se reinició la entrada.');
      empezarEn();
    }
  };

  const semanas = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    const out = [];
    let d = inicio;
    while (d <= fin) {
      const semana = [];
      for (let i = 0; i < 7; i++) { semana.push(d); d = addDays(d, 1); }
      out.push(semana);
    }
    return out;
  }, [mes]);

  return (
    <div style={{
      background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: 12, opacity: disabled ? 0.45 : 1, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" onClick={() => setMes(addMonths(mes, -1))} style={btnMes} disabled={disabled}>‹</button>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: T.goldLight }}>
          {format(mes, 'MMMM yyyy', { locale: es })}
        </div>
        <button type="button" onClick={() => setMes(addMonths(mes, 1))} style={btnMes} disabled={disabled}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DIAS.map((d, i) => (
          <div key={i} style={{ fontSize: 9, color: T.muted, textAlign: 'center', padding: '2px 0', letterSpacing: 0.5 }}>{d}</div>
        ))}
        {semanas.flat().map((dia) => {
          const key = format(dia, 'yyyy-MM-dd');
          const otroMes = !isSameMonth(dia, mes);
          const pasado = isBefore(dia, hoy);
          const ocupada = occupied.has(key);
          const esEntrada = entradaDate && isSameDay(dia, entradaDate);
          const esSalida = salidaDate && isSameDay(dia, salidaDate);
          const enRango = entradaDate && salidaDate && dia > entradaDate && dia < salidaDate;
          const clicable = !disabled && !pasado && !otroMes;
          let bg = 'transparent';
          if (esEntrada || esSalida) bg = T.gold;
          else if (enRango) bg = 'rgba(184,134,11,0.25)';
          return (
            <button
              key={key}
              type="button"
              onClick={() => clickDia(dia)}
              disabled={!clicable}
              title={ocupada ? 'Noche ocupada' : undefined}
              style={{
                background: bg,
                color: esEntrada || esSalida ? T.dark
                  : otroMes || pasado ? 'rgba(160,152,130,0.30)'
                  : ocupada ? T.red : T.text,
                textDecoration: ocupada && !esSalida ? 'line-through' : 'none',
                border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12,
                fontWeight: esEntrada || esSalida ? 700 : 400,
                cursor: clicable ? 'pointer' : 'default',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {format(dia, 'd')}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: T.muted }}>
        <span>
          {entrada ? `Entrada: ${entrada}` : 'Elige la entrada'}
          {salida ? ` → Salida: ${salida}` : entrada ? ' → elige la salida' : ''}
        </span>
        <span style={{ color: T.red }}>{aviso ?? ''}</span>
      </div>
    </div>
  );
}

const btnMes = {
  background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
  borderRadius: 6, width: 26, height: 26, fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'DM Sans', sans-serif",
};
