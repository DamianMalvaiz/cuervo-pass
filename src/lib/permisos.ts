// Permisos del sistema · el aviso de «fotos denegadas» y su acción «Ajustes».

import { Linking } from 'react-native';

import { aviso } from '@/lib/registro';
import { toast } from '@/lib/toast';

export const MENSAJE_PERMISO_FOTOS = 'Necesitamos permiso para acceder a tus fotos';

/**
 * Lleva a los ajustes de la app en el sistema.
 *
 * Nunca propaga. Abrir los Ajustes no es de fiar en todos los teléfonos, y que
 * falle no puede dejar a la persona sin saber qué hacer: se le dice dónde ir a mano.
 */
export async function abrirAjustes(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (e) {
    aviso('No se pudieron abrir los ajustes', undefined, e);
    toast.info('Abre los Ajustes de tu teléfono y permite el acceso a Fotos para Cuervo Pass.');
  }
}

/**
 * Avisa que falta el permiso de fotos y devuelve el mensaje, para que el formulario
 * lo deje también en pantalla.
 *
 * «Ajustes» solo se ofrece cuando el sistema YA NO VOLVERÁ A PREGUNTAR
 * (`canAskAgain === false`): en iOS tras la primera negativa, en Android tras la
 * segunda. Mientras pueda preguntar, basta con volver a tocar y aparece el diálogo
 * del sistema; mandar a Ajustes sería un rodeo.
 *
 * Si el estado no se sabe (`undefined`) se ofrece: es mejor un botón de más que una
 * persona atrapada sin camino para darse el permiso.
 */
export function avisarPermisoDeFotosDenegado(puedePedirDeNuevo?: boolean): string {
  if (puedePedirDeNuevo === true) {
    toast.error(MENSAJE_PERMISO_FOTOS);
  } else {
    toast.error(MENSAJE_PERMISO_FOTOS, {
      accion: { etiqueta: 'Ajustes', onPress: () => void abrirAjustes() },
    });
  }
  return MENSAJE_PERMISO_FOTOS;
}
