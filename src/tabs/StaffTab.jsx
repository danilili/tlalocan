import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { T } from '../lib/design-tokens';
import Card from '../components/Card';
import TaskBadge from '../components/badges/TaskBadge';
import FadeIn from '../components/FadeIn';
import SectionTitle from '../components/SectionTitle';
import { useTareas } from '../hooks/useTareas';

const PUESTO_LABEL = {
  encargada_limpieza: 'Limpieza',
  encargado_mantenimiento: 'Mantenimiento',
  otro: 'Otro',
};

const TIPO_LABEL = {
  limpieza_salida: 'Limpieza de salida',
  prep_llegada: 'Prep. de llegada',
  mantenimiento: 'Mantenimiento',
  revision: 'Revisión',
  otro: 'Otro',
};

function formatProgramada(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function StaffTab() {
  const { data: tareas, loading: tareasLoading, error: tareasError } = useTareas({ dias: 7 });
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('activo', true)
        .order('puesto');
      if (!cancelled) {
        setStaff(data ?? []);
        setStaffLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tareasPorStaff = staff.map((s) => ({
    ...s,
    pendientes: tareas.filter((t) => t.staff_id === s.id && t.estado === 'pendiente').length,
  }));

  return (
    <>
      <FadeIn>
        <SectionTitle>Tareas próximas (7 días)</SectionTitle>
        {tareasLoading && (
          <div style={{ color: T.muted, fontSize: 12 }}>Cargando tareas…</div>
        )}
        {tareasError && (
          <div style={{ color: T.red, fontSize: 12 }}>Error: {tareasError.message}</div>
        )}
        {!tareasLoading && tareas.length === 0 && (
          <Card>
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              No hay tareas programadas en los próximos 7 días.
            </div>
          </Card>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tareas.map((t, i) => (
            <FadeIn key={t.id} delay={Math.min(i, 6) * 40}>
              <Card
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 200, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {TIPO_LABEL[t.tipo] ?? t.tipo} · {t.chalet?.nombre ?? 'Sin chalet'}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    Asignado: {t.staff?.nombre_visible || (t.staff?.puesto ? PUESTO_LABEL[t.staff.puesto] : 'Sin asignar')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <TaskBadge status={t.estado} />
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {formatProgramada(t.programada_para)}
                  </div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={200}>
        <SectionTitle>Equipo</SectionTitle>
        {staffLoading && (
          <div style={{ color: T.muted, fontSize: 12 }}>Cargando equipo…</div>
        )}
        {!staffLoading && staff.length === 0 && (
          <Card>
            <div style={{ color: T.muted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              Aún no se ha registrado personal activo.
            </div>
          </Card>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {tareasPorStaff.map((s) => {
            const display = s.nombre_visible || PUESTO_LABEL[s.puesto];
            const initial = (s.nombre_visible?.[0] || PUESTO_LABEL[s.puesto]?.[0] || '?').toUpperCase();
            return (
              <Card key={s.id} style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(91,140,90,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: T.green,
                      fontWeight: 500,
                    }}
                  >
                    {initial}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{display}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {PUESTO_LABEL[s.puesto] ?? s.puesto}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  {s.pendientes} tarea{s.pendientes === 1 ? '' : 's'} pendiente
                  {s.pendientes === 1 ? '' : 's'} ·{' '}
                  <span style={{ color: T.green }}>Activo</span>
                </div>
              </Card>
            );
          })}
        </div>
      </FadeIn>
    </>
  );
}
