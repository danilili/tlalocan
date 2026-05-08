import { useRol } from '../hooks/useRol';

// Esconde children si el rol del usuario no esta en la lista permitida.
// La garantia real de seguridad es RLS en Supabase; esto es UX.
export default function RequireRole({ roles, children, fallback = null }) {
  const { rol, isLoading } = useRol();
  if (isLoading) return null;
  if (!rol || !roles.includes(rol)) return fallback;
  return children;
}
