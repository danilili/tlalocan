import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import { formatMoney, formatDate } from '../lib/format';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';

const COMPROBANTES_BUCKET = 'comprobantes-pago';

export default function ValidarPagoForm({ open, reserva, onClose, onUpdated }) {
  const { user } = useAuth();
  const [signedUrl, setSignedUrl] = useState(null);
  const [urlError, setUrlError] = useState(null);
  const [mode, setMode] = useState('view'); // 'view' | 'reject'
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Reset al abrir.
  useEffect(() => {
    if (!open) return;
    setMode('view');
    setMotivo('');
    setSubmitError(null);
    setSignedUrl(null);
    setUrlError(null);
  }, [open, reserva?.id]);

  // Generar signed URL del comprobante (bucket privado).
  useEffect(() => {
    if (!open || !reserva?.comprobante_url) return;
    let cancelled = false;
    (async () => {
      const path = stripBucketPrefix(reserva.comprobante_url, COMPROBANTES_BUCKET);
      const { data, error } = await supabase.storage
        .from(COMPROBANTES_BUCKET)
        .createSignedUrl(path, 300);
      if (cancelled) return;
      if (error) setUrlError(error.message);
      else setSignedUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reserva?.comprobante_url]);

  if (!reserva) return null;

  const fullName =
    [reserva.huesped?.nombre, reserva.huesped?.apellidos].filter(Boolean).join(' ').trim() ||
    'Sin nombre';

  const onValidar = async () => {
    setSubmitting(true);
    setSubmitError(null);
    // Idempotente: solo actúa si sigue en pendiente_pago. Si WhatsApp (u otro
    // admin) ya la validó/canceló, el filtro no matchea y "primero gana".
    const { data, error } = await supabase
      .from('reservas')
      .update({
        estado: 'confirmada',
        validado_por: user?.id ?? null,
        validado_en: new Date().toISOString(),
        motivo_rechazo: null,
      })
      .eq('id', reserva.id)
      .eq('estado', 'pendiente_pago')
      .select();
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setSubmitError('Esta reserva ya fue validada o cancelada por otro canal.');
      onUpdated?.();
      return;
    }
    // Avisar al huésped por WhatsApp (best-effort, no bloquea).
    notificarHuesped({ reserva_id: reserva.id, validada: true });
    onUpdated?.();
    onClose?.();
  };

  const onRechazar = async () => {
    if (!motivo.trim()) {
      setSubmitError('Indica un motivo de rechazo.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const motivoTexto = motivo.trim();
    const { data, error } = await supabase
      .from('reservas')
      .update({
        estado: 'cancelada',
        motivo_rechazo: motivoTexto,
        validado_por: user?.id ?? null,
        validado_en: new Date().toISOString(),
      })
      .eq('id', reserva.id)
      .eq('estado', 'pendiente_pago')
      .select();
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setSubmitError('Esta reserva ya fue validada o cancelada por otro canal.');
      onUpdated?.();
      return;
    }
    notificarHuesped({ reserva_id: reserva.id, validada: false, motivo: motivoTexto });
    onUpdated?.();
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="Validar pago" maxWidth={520}>
      <div style={summaryStyle}>
        <Row label="Huésped" value={fullName} />
        <Row label="Chalet" value={reserva.chalet?.nombre ?? '—'} />
        <Row
          label="Fechas"
          value={`${formatDate(reserva.fecha_entrada)} → ${formatDate(reserva.fecha_salida)}`}
        />
        <Row label="Total" value={formatMoney(reserva.monto_total)} highlight />
      </div>

      <div style={{ margin: '14px 0' }}>
        {urlError && (
          <div style={{ color: T.red, fontSize: 12 }}>
            No se pudo cargar el comprobante: {urlError}
          </div>
        )}
        {!signedUrl && !urlError && (
          <div style={{ color: T.muted, fontSize: 12 }}>Cargando comprobante…</div>
        )}
        {signedUrl && (
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={signedUrl}
              alt="Comprobante de pago"
              style={{
                width: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                background: T.dark,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
              }}
            />
          </a>
        )}
      </div>

      {mode === 'reject' && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 11,
              color: T.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Motivo del rechazo
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. el comprobante no muestra el nombre del titular, el monto no coincide…"
            style={{
              width: '100%',
              background: T.dark,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: T.text,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: "'DM Sans', sans-serif",
              resize: 'vertical',
            }}
          />
        </div>
      )}

      {submitError && (
        <div style={{ color: T.red, fontSize: 12, marginBottom: 8 }}>{submitError}</div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          marginTop: 10,
          flexWrap: 'wrap',
        }}
      >
        {mode === 'view' && (
          <>
            <button
              type="button"
              onClick={() => setMode('reject')}
              disabled={submitting}
              style={btnDanger}
            >
              ✗ Rechazar
            </button>
            <button
              type="button"
              onClick={onValidar}
              disabled={submitting}
              style={{
                ...btnPrimary,
                opacity: submitting ? 0.5 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Validando…' : '✓ Validar pago'}
            </button>
          </>
        )}
        {mode === 'reject' && (
          <>
            <button type="button" onClick={() => setMode('view')} style={btnSecondary}>
              Cancelar rechazo
            </button>
            <button
              type="button"
              onClick={onRechazar}
              disabled={submitting || !motivo.trim()}
              style={{
                ...btnDanger,
                opacity: submitting || !motivo.trim() ? 0.5 : 1,
                cursor: submitting || !motivo.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ color: T.muted, fontSize: 12 }}>{label}</span>
      <span
        style={{
          color: highlight ? T.goldLight : T.text,
          fontSize: 13,
          fontWeight: highlight ? 600 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Dispara el callback de validación a n8n para que avise al huésped por
// WhatsApp. Best-effort: si la URL no está configurada o el fetch falla, no
// debe romper la validación (la reserva ya quedó actualizada en Supabase).
function notificarHuesped(payload) {
  const url = import.meta.env.VITE_N8N_WEBHOOK_VALIDACION_PAGO;
  if (!url) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* best-effort: el huésped puede no recibir el aviso, pero la validación sí cuenta */
  });
}

function stripBucketPrefix(value, bucket) {
  // Soporta tanto path puro ('reserva-id/file.jpg') como path con bucket
  // ('comprobantes-pago/reserva-id/file.jpg') o URL completa.
  if (!value) return '';
  try {
    const u = new URL(value);
    const idx = u.pathname.indexOf(`/${bucket}/`);
    if (idx >= 0) return u.pathname.slice(idx + bucket.length + 2);
  } catch {
    // no es URL, tratar como path.
  }
  if (value.startsWith(`${bucket}/`)) return value.slice(bucket.length + 1);
  return value;
}

const summaryStyle = {
  background: T.dark,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '6px 14px',
  fontFamily: "'DM Sans', sans-serif",
};

const btnPrimary = {
  background: T.gold,
  color: T.dark,
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontFamily: "'DM Sans', sans-serif",
};

const btnSecondary = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};

const btnDanger = {
  background: 'rgba(199,80,80,0.12)',
  color: T.red,
  border: `1px solid rgba(199,80,80,0.3)`,
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
