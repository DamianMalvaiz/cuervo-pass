import { useEffect, useRef } from 'react';

import { irAlLogin } from '@/lib/navegacion';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Si la sesión TERMINA sin que la persona pulse nada (token revocado, cuenta borrada desde otro dispositivo, refresco que falla), la saca de las pantallas
 * protegidas hacia el login. Solo reacciona a una sesión que EXISTÍA y dejó de existir: al arrancar sin sesión, la pantalla de entrada ya decide adónde ir.
 */
export function useVolverAlLoginSiSeCierraLaSesion() {
  const haySesion = useAuthStore((s) => Boolean(s.session));
  const habiaSesion = useRef(haySesion);

  useEffect(() => {
    if (habiaSesion.current && !haySesion) irAlLogin();
    habiaSesion.current = haySesion;
  }, [haySesion]);
}
