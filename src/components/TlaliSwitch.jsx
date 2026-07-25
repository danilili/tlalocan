import { T } from '../lib/design-tokens';
import { useTlaliAtencion } from '../hooks/useTlaliAtencion';

// Interruptor prominente del bot Tlali (tablero principal).
// Apaga/enciende la atención a huéspedes por WhatsApp (líneas ventas y estancia).
// La línea interna de staff y la ingesta de comprobantes no se apagan.
export default function TlaliSwitch() {
  const { activa, saving, error, toggle } = useTlaliAtencion();

  const cargando = activa === null;
  const encendida = activa === true;

  const onClick = () => {
    if (cargando || saving) return;
    if (encendida) {
      const ok = window.confirm(
        '¿Apagar a Tlali?\n\nLos huéspedes que escriban por WhatsApp NO recibirán respuesta automática: el equipo deberá contestar manualmente hasta volver a encenderla.'
      );
      if (!ok) return;
    }
    toggle();
  };

  const color = cargando ? T.muted : encendida ? T.green : T.red;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        background: T.card,
        border: `1px solid ${cargando ? T.border : encendida ? 'rgba(91,140,90,0.55)' : 'rgba(199,80,80,0.6)'}`,
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 18,
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: color,
          boxShadow: cargando ? 'none' : `0 0 10px ${color}`,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ color: T.text, fontWeight: 600, fontSize: 14.5 }}>
          {cargando
            ? 'Tlali — consultando estado…'
            : encendida
              ? 'Tlali está atendiendo WhatsApp'
              : 'Tlali está APAGADA'}
        </div>
        <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
          {cargando
            ? ''
            : encendida
              ? 'Responde automáticamente a huéspedes (ventas y estancia).'
              : 'Los mensajes de huéspedes NO se responden: atención manual del equipo.'}
          {error ? ' · Error al guardar, intenta de nuevo.' : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={cargando || saving}
        aria-label={encendida ? 'Apagar a Tlali' : 'Encender a Tlali'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'transparent',
          border: 'none',
          cursor: cargando || saving ? 'wait' : 'pointer',
          padding: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span style={{ color: encendida ? T.green : T.muted, fontSize: 12, fontWeight: 600 }}>
          {saving ? 'Guardando…' : encendida ? 'ENCENDIDA' : 'APAGADA'}
        </span>
        {/* Pista del switch */}
        <span
          style={{
            width: 52,
            height: 28,
            borderRadius: 999,
            background: encendida ? 'rgba(91,140,90,0.45)' : 'rgba(199,80,80,0.30)',
            border: `1px solid ${encendida ? T.green : T.red}`,
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          {/* Perilla */}
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: encendida ? 26 : 2,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: encendida ? T.green : T.red,
              transition: 'left 0.2s',
            }}
          />
        </span>
      </button>
    </div>
  );
}
