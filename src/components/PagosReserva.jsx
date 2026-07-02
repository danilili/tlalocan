import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import { formatMoney, formatDate } from '../lib/format';
import { useAuth } from '../hooks/useAuth';
import { useRol } from '../hooks/useRol';
import { FORMAS_PAGO } from './PagosDraftEditor';

// Ledger de pagos de una reserva existente (Editar reserva): lista los pagos
// registrados y permite abonar. El trigger de BD mantiene monto_pagado en sync.
export default function PagosReserva({ reservaId, montoTotal, montoPagadoInicial, onChanged }) {
  const { user } = useAuth();
  const { isAdmin } = useRol();
  const [pagos, setPagos] = useState([]);
  const [delta, setDelta] = useState(0); // pagos netos agregados en esta sesión
  const [forma, setForma] = useState('transferencia');
  const [monto, setMonto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!reservaId) return;
    const { data, error: qErr } = await supabase
      .from('pagos')
      .select('id, forma_pago, monto, created_at')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: true });
    if (!qErr) setPagos(data ?? []);
  }, [reservaId]);

  useEffect(() => { setDelta(0); setMonto(''); setError(null); load(); }, [load]);

  const agregar = async () => {
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError('Captura un monto mayor a 0.');
      return;
    }
    setBusy(true); setError(null);
    const { error: iErr } = await supabase.from('pagos').insert({
      reserva_id: reservaId,
      forma_pago: forma,
      monto: montoNum,
      registrado_por: user?.id ?? null,
    });
    setBusy(false);
    if (iErr) { setError(iErr.message); return; }
    setDelta((d) => d + montoNum);
    setMonto('');
    load();
    onChanged?.();
  };

  const borrar = async (p) => {
    setBusy(true); setError(null);
    const { error: dErr } = await supabase.from('pagos').delete().eq('id', p.id);
    setBusy(false);
    if (dErr) { setError(dErr.message); return; }
    setDelta((d) => d - Number(p.monto));
    load();
    onChanged?.();
  };

  const pagado = (Number(montoPagadoInicial) || 0) + delta;
  const saldo = montoTotal != null ? Number(montoTotal) - pagado : null;

  return (
    <div style={{
      background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: '12px 14px', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
        Pagos registrados
      </div>

      {pagos.length === 0 && (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
          Sin pagos en el ledger (los cobros previos a esta función solo viven en el monto pagado).
        </div>
      )}
      {pagos.map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0' }}>
          <span style={{ color: T.muted }}>{formatDate(p.created_at)}</span>
          <span style={{ textTransform: 'capitalize' }}>{p.forma_pago}</span>
          <span style={{ fontWeight: 600 }}>{formatMoney(p.monto)}</span>
          {isAdmin ? (
            <button type="button" style={btnQuitar} title="Eliminar pago (ajusta el monto pagado)"
                    disabled={busy} onClick={() => borrar(p)}>✕</button>
          ) : <span style={{ width: 30 }} />}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <select style={{ ...miniInput, flex: 1 }} value={forma} onChange={(e) => setForma(e.target.value)}>
          {FORMAS_PAGO.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input style={{ ...miniInput, width: 110 }} type="number" min={0.01} step="0.01"
               placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <button type="button" style={btnAgregar} disabled={busy} onClick={agregar}>
          {busy ? '…' : '+ Pago'}
        </button>
      </div>

      {saldo != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
          <span style={{ color: T.muted }}>Pagado: {formatMoney(pagado)}</span>
          <span style={{ color: saldo > 0.009 ? T.goldLight : T.green, fontWeight: 600 }}>
            {saldo > 0.009 ? `Saldo: ${formatMoney(saldo)}` : 'Saldado ✓'}
          </span>
        </div>
      )}
      {error && <div style={{ color: T.red, fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

const miniInput = {
  background: '#1A1814', border: `1px solid ${T.border}`, borderRadius: 8,
  padding: '8px 10px', color: T.text, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
};

const btnAgregar = {
  background: T.gold, color: T.dark, border: 'none', borderRadius: 8,
  padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif",
};

const btnQuitar = {
  background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
  borderRadius: 6, width: 30, height: 26, fontSize: 11, cursor: 'pointer',
  flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
};
