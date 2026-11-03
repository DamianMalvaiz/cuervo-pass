import type Ionicons from '@expo/vector-icons/Ionicons';

import type { AvisoDelCentro } from '@/services/notificaciones.service';

// Lo que comparten las dos pantallas de avisos (la de la app y la de la web): el icono de cada clase y cómo se dice cuándo fue.

export const ICONOS_AVISO: Record<AvisoDelCentro['tipo'], keyof typeof Ionicons.glyphMap> = {
  nuevo_mensaje: 'chatbubble-outline',
  nuevo_contacto: 'person-add-outline',
  publicacion_oculta: 'eye-off-outline',
  cuenta_suspendida: 'alert-circle-outline',
  verificacion_resuelta: 'shield-checkmark-outline',
  resena_nueva: 'star-outline',
  resena_respondida: 'chatbox-ellipses-outline',
};

const MINUTO = 60_000;
/** «hace 5 min», «hace 3 h», «hace 2 d» y, pasada una semana, la fecha. Sin dependencias: es una línea de apoyo, no el dato. */
export function cuandoFue(iso: string, ahora = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const dif = Math.max(0, ahora - t);
  if (dif < MINUTO) return 'ahora';
  if (dif < 60 * MINUTO) return `hace ${Math.floor(dif / MINUTO)} min`;
  if (dif < 24 * 60 * MINUTO) return `hace ${Math.floor(dif / (60 * MINUTO))} h`;
  if (dif < 7 * 24 * 60 * MINUTO) return `hace ${Math.floor(dif / (24 * 60 * MINUTO))} d`;
  return new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
