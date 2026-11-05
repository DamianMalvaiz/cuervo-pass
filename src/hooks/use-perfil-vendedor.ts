import { router } from 'expo-router';
import { useState } from 'react';

import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { pasoDeVerificacion } from '@/lib/panelVendedor';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Los datos del perfil de un vendedor (0083), compartidos por la pantalla de la app y la de la web: dos formas de pintar lo MISMO. El paso de verificación sale de las funciones de la cuenta; si no se pudieron leer (`falloRoles`) no se afirma ninguno.
 * `aEstudiante` cambia de perfil activo: un vendedor no hizo el cuestionario de búsqueda, así que sin universidad se va primero a llenarlo.
 */
export function usePerfilVendedor() {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { perfil, error: errorPerfil, cargarPerfil } = usePerfilStore();
  const { roles, fallo: falloRoles, reintentar: reintentarRoles } = useMisRoles(miId);
  const { cambiar } = usePerfilActivo(miId);
  const [cambiando, setCambiando] = useState(false);

  const paso = pasoDeVerificacion(roles);
  const primerRol = (roles.find((r) => r.rol === 'arrendador' || r.rol === 'comerciante')?.rol ?? 'arrendador') as 'arrendador' | 'comerciante';
  const rolDeVerificacion = paso?.rol ?? primerRol;
  const { suscripcion } = useMiSuscripcion(miId, primerRol);

  const aEstudiante = async () => {
    if (cambiando) return;
    setCambiando(true);
    try {
      await cambiar('estudiante');
      router.replace(perfil?.universidad ? '/(tabs)/inicio' : '/perfil/preferencias');
    } catch {
      toast.error('No pudimos cambiar de perfil. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCambiando(false);
    }
  };

  return { miId, perfil, errorPerfil, cargarPerfil, roles, falloRoles, reintentarRoles, paso, rolDeVerificacion, suscripcion, aEstudiante, cambiando };
}
