import { T } from '../lib/design-tokens';
import { formatMoney } from '../lib/format';

export const FORMAS_PAGO = [
  { value: 'mercadopago', label: 'MercadoPago' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

// Editor de pagos ANTES de que exista la reserva (borrador en memoria).
// pagos: [{ forma, monto }]; se insertan en la tabla pagos al guardar la reserva.
export default function PagosDraftEditor({ pagos, onChange, total }) {
  const suma = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const restante = total != null ? total - suma : null;

  const setRow = (i, patch) =>
    onChange(pagos.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <div style={{
      background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: '12px 14px', fontFamily: "'DM Sans', sans-serif",
    }}>
      {pagos.length === 0 && (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
          Sin pagos registrados (puedes crearla sin anticipo).
        </div>
      )}
      {pagos.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <select
            style={{ ...miniInput, flex: 1 }}
            value={p.forma}
            onChange={(e) => setRow(i, { forma: e.target.value })}
          >
            {FORMAS_PAGO.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <input
            style={{ ...miniInput, width: 120 }}
            type="number" min={0.01} step="0.01" placeholder="Monto"
            value={p.monto}
            onChange={(e) => setRow(i, { monto: e.target.value })}
          />
          <button type="button" style={btnQuitar} title="Quitar pago"
                  onClick={() => onChange(pagos.filter((_, idx) => idx !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" style={btnAgregar}
              onClick={() => onChange([...pagos, { forma: 'transferencia', monto: '' }])}>
        + Agregar pago
      </button>
      {pagos.length > 0 && total != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
          <span style={{ color: T.muted }}>Pagado: {formatMoney(suma)}</span>
          <span style={{ color: restante > 0.009 ? T.goldLight : T.green, fontWeight: 600 }}>
            {restante > 0.009 ? `Restante: ${formatMoney(restante)}` : 'Cubierto ✓'}
          </span>
        </div>
      )}
      {total != null && suma > total + 0.009 && (
        <div style={{ color: T.red, fontSize: 12, marginTop: 6 }}>
          Los pagos exceden el total de la reserva.
        </div>
      )}
    </div>
  );
}

const miniInput = {
  background: '#1A1814', border: `1px solid ${T.border}`, borderRadius: 8,
  padding: '8px 10px', color: T.text, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
};

const btnAgregar = {
  background: 'transparent', color: T.goldLight, border: `1px dashed ${T.border}`,
  borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', width: '100%', fontFamily: "'DM Sans', sans-serif",
};

const btnQuitar = {
  background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
  borderRadius: 6, width: 30, height: 30, fontSize: 12, cursor: 'pointer',
  flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
};
