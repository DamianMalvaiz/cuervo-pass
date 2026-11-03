import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { MarcoSesionWeb } from '@/components/web/MarcoSesionWeb';

/**
 * Pone una pantalla de la app DENTRO del marco de la web (el encabezado de la web arriba y, en teléfono, la barra inferior) cuando corre en el navegador; en la app no hace nada. Es para las pantallas de formulario o de lectura
 * que se hicieron para el teléfono y funcionan igual en la web, pero salían con la cabecera de la app (su título y la flecha atrás) en vez de la navegación del sitio. Cada ruta que lo usa apaga su cabecera de app en el layout.
 */
export function EnMarcoWeb({ children }: { children: ReactNode }) {
  return Platform.OS === 'web' ? <MarcoSesionWeb>{children}</MarcoSesionWeb> : <>{children}</>;
}
