import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import TarifaForm from '../forms/TarifaForm';
import { useChalets } from '../hooks/useChalets';
import { formatMoney, formatDate } from '../lib/format';

// Una tarifa es "base" si prioridad 0; "temporada" si prioridad > 0.
const esTemporada = (t) => (t.prioridad ?? 0) > 0;

export default function PreciosTab() {
  const { data: chalets } = useChalets();
  const [tarifas, setTarifas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode, tarifa, presetChaletId }

  const fetchTarifas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tarifas')
      .select('*')
      .order('prioridad', { ascending: false })
      .order('vigente_desde', { ascending: false });
    setTarifas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTarifas(); }, [fetchTarifas]);

  const globalBase = tarifas.find((t) => t.chalet_id == null && !esTemporada(t)) ?? null;
  const baseDeChalet = (id) => tarifas.find((t) => t.chalet_id === id && !esTemporada(t)) ?? null;
  const temporadas = tarifas.filter(esTemporada);

  const closeModal = () => setModal(null);
  const onSaved = () => fetchTarifas();

  return (
    <>
      {/* ---- Bloque 1: Precio global ---- */}
      <FadeIn>
        <SectionTitle>Precio global</SectionTitle>
        {loading && <div style={{ color: T.muted, fontSize: 12 }}>Cargando…</div>}
        {!loading && (
          <Card style={{ padding: '16px 18px' }}>
            {globalBase ? (
              <RowTarifa
                titulo={globalBase.nombre}
                subtitulo="Aplica a los 4 chalets sin override"
                t={globalBase}
                onEdit={() => setModal({ mode: 'global', tarifa: globalBase })}
              />
            ) : (
              <EmptyRow
                texto="No hay precio global configurado."
                cta="Crear precio global"
                onClick={() => setModal({ mode: 'global', tarifa: null })}
              />
            )}
          </Card>
        )}
      </FadeIn>

      {/* ---- Bloque 2: Precios por chalet ---- */}
      <FadeIn delay={120}>
        <SectionTitle>Precios por chalet</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chalets.map((c) => {
            const base = baseDeChalet(c.id);
            return (
              <Card key={c.id} style={{ padding: '14px 18px' }}>
                {base ? (
                  <RowTarifa
                    titulo={c.nombre}
                    subtitulo="Override propio (sustituye al global)"
                    t={base}
                    onEdit={() => setModal({ mode: 'chalet', tarifa: base })}
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Usa el precio global</div>
                    </div>
                    <button style={btnSecondary}
                            onClick={() => setModal({ mode: 'chalet', tarifa: null, presetChaletId: c.id })}>
                      Crear override
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </FadeIn>

      {/* ---- Bloque 3: Temporadas ---- */}
      <FadeIn delay={240}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Temporadas</SectionTitle>
          <button style={btnPrimary} onClick={() => setModal({ mode: 'temporada', tarifa: null })}>
            + Nueva temporada
          </button>
        </div>
        {!loading && temporadas.length === 0 && (
          <Card>
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center' }}>
              Sin temporadas. El precio global / por chalet aplica todo el año.
            </div>
          </Card>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {temporadas.map((t) => {
            const chalet = chalets.find((c) => c.id === t.chalet_id);
            const scope = t.chalet_id ? (chalet?.nombre ?? 'chalet') : 'Todos (global)';
            return (
              <Card key={t.id} style={{ padding: '14px 18px', opacity: t.activa ? 1 : 0.55 }}>
                <RowTarifa
                  titulo={t.nombre}
                  subtitulo={`${scope} · ${formatDate(t.vigente_desde)} → ${formatDate(t.vigente_hasta)} · prioridad ${t.prioridad}${t.activa ? '' : ' · inactiva'}`}
                  t={t}
                  onEdit={() => setModal({ mode: 'temporada', tarifa: t })}
                />
              </Card>
            );
          })}
        </div>
      </FadeIn>

      {/* ---- Preview ---- */}
      <FadeIn delay={360}>
        <SectionTitle>Probar precio de un día</SectionTitle>
        <PreviewPrecio chalets={chalets} />
      </FadeIn>

      {modal && (
        <TarifaForm
          open
          mode={modal.mode}
          tarifa={modal.tarifa}
          presetChaletId={modal.presetChaletId}
          chalets={chalets}
          temporadas={temporadas}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function RowTarifa({ titulo, subtitulo, t, onEdit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{titulo}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{subtitulo}</div>
        <button style={{ ...btnSecondary, marginTop: 8 }} onClick={onEdit}>Editar</button>
      </div>
      <div style={{ fontSize: 11, color: T.muted, textAlign: 'right' }}>
        <PrecioLinea label="Lun–Jue" precio={t.precio_lun_jue} />
        <PrecioLinea label="Vie–Sáb" precio={t.precio_vie_sab} />
        <PrecioLinea label="Domingo" precio={t.precio_domingo} />
        <div style={{ marginTop: 4 }}>Sin impuestos · cada plataforma aplica los suyos</div>
      </div>
    </div>
  );
}

function PrecioLinea({ label, precio }) {
  return (
    <div>
      {label}: <span style={{ color: T.text }}>{formatMoney(precio)}</span>
    </div>
  );
}

function EmptyRow({ texto, cta, onClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ color: T.muted, fontSize: 13 }}>{texto}</div>
      <button style={btnPrimary} onClick={onClick}>{cta}</button>
    </div>
  );
}

function PreviewPrecio({ chalets }) {
  const [chaletId, setChaletId] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (chalets.length && !chaletId) setChaletId(chalets[0].id);
  }, [chalets, chaletId]);

  useEffect(() => {
    if (!chaletId || !fecha) return;
    let cancel = false;
    (async () => {
      setBusy(true); setErr(null);
      const [precioRes, tarifaRes] = await Promise.all([
        supabase.rpc('precio_del_dia', { p_chalet_id: chaletId, p_fecha: fecha }),
        supabase.rpc('tarifa_vigente_del_dia', { p_chalet_id: chaletId, p_fecha: fecha }),
      ]);
      if (cancel) return;
      setBusy(false);
      if (precioRes.error) { setErr(precioRes.error.message); setRes(null); return; }
      const tRow = Array.isArray(tarifaRes.data) ? tarifaRes.data[0] : tarifaRes.data;
      setRes({ precio: precioRes.data, tarifa: tRow?.nombre ?? '—' });
    })();
    return () => { cancel = true; };
  }, [chaletId, fecha]);

  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={miniLabel}>Chalet</label>
          <select style={miniInput} value={chaletId} onChange={(e) => setChaletId(e.target.value)}>
            {chalets.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div style={{ width: 160 }}>
          <label style={miniLabel}>Fecha</label>
          <input style={miniInput} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
        {busy && <div style={{ color: T.muted, fontSize: 12 }}>Calculando…</div>}
        {err && <div style={{ color: T.red, fontSize: 12 }}>{err}</div>}
        {!busy && !err && res && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 22, color: T.goldLight, fontWeight: 500 }}>
              {formatMoney(res.precio)}
              <span style={{ fontSize: 11, color: T.muted, marginLeft: 8 }}>neto / noche</span>
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              Resuelve a: <span style={{ color: T.text }}>{res.tarifa}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const miniLabel = {
  fontSize: 10, color: T.muted, letterSpacing: 0.6, textTransform: 'uppercase',
  display: 'block', marginBottom: 5, fontFamily: "'DM Sans', sans-serif",
};
const miniInput = {
  width: '100%', background: T.dark, border: `1px solid ${T.border}`, borderRadius: 8,
  padding: '8px 10px', color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'DM Sans', sans-serif",
};

const btnPrimary = {
  background: T.gold, color: T.dark, border: 'none', borderRadius: 8,
  padding: '8px 14px', fontSize: 12, fontWeight: 600, letterSpacing: 0.8,
  textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
};
const btnSecondary = {
  background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
  borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 500,
  letterSpacing: 0.6, textTransform: 'uppercase', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
