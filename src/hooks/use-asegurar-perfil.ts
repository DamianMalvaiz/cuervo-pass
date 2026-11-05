import { useEffect, useRef } from 'react';

import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Carga mi perfil si la pantalla lo necesita y todavía no está. Inicio y las pantallas de perfil ya lo cargaban; las demás (Preferencias, Sobre mí, Personalización, Configuración) daban por hecho que alguien lo había
 * cargado antes, y al recargar la web en una de ellas, o entrar por un enlace, nadie lo había hecho. Se pide UNA vez por cuenta: una fila ausente (un vacío legítimo) no debe provocar un bucle de cargas.
 */
export function useAsegurarMiPerfil() {
  const miId = useAuthStore((s) => s.session?.user.id);
  const perfil = usePerfilStore((s) => s.perfil);
  const cargando = usePerfilStore((s) => s.cargando);
  const cargarPerfil = usePerfilStore((s) => s.cargarPerfil);
  const pedidoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!miId || perfil || cargando || pedidoPara.current === miId) return;
    pedidoPara.current = miId;
    void cargarPerfil(miId);
  }, [miId, perfil, cargando, cargarPerfil]);
}
