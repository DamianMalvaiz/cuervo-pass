// Panel de administración · lo que no depende de la red ni de la pantalla.
//
// El panel solo se muestra a cuentas con el rol `admin` APROBADO, pero eso es comodidad: quien de verdad decide es la Edge Function
// `admin`, que lo comprueba en la base antes de ejecutar nada. Ocultar el botón no es seguridad; el 403 del servidor sí.

import type { RolUsuario } from '@/types/database.types';

export const esAdmin = (roles: readonly RolUsuario[]): boolean => roles.some((r) => r.rol === 'admin' && r.estado === 'aprobado');

export type TipoErrorAdmin = 'prohibido' | 'no_pendiente' | 'motivo_requerido' | 'no_existe' | 'no_disponible' | 'red' | 'desconocido';

export class ErrorAdmin extends Error {
  constructor(readonly tipo: TipoErrorAdmin) {
    super(tipo);
    this.name = 'ErrorAdmin';
  }
}

export const MENSAJE_ERROR_ADMIN: Record<TipoErrorAdmin, string> = {
  prohibido: 'Tu cuenta no tiene permiso para esto.',
  no_pendiente: 'Esa verificación ya no está pendiente. Actualiza la lista.',
  motivo_requerido: 'Escribe un motivo (al menos 3 letras).',
  no_existe: 'Eso ya no existe. Actualiza la lista.',
  no_disponible: 'El panel no está disponible ahora. Intenta más tarde.',
  red: 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.',
  desconocido: 'Algo salió mal. Intenta de nuevo.',
};

/** Lee la respuesta de la función por su código HTTP y el `error` de su cuerpo. Sin código HTTP no llegó respuesta: es la red. */
export function tipoDeErrorAdmin(status: number | undefined, codigo: string | undefined): TipoErrorAdmin {
  if (status === undefined) return 'red';
  if (status === 401 || status === 403) return 'prohibido';
  if (status === 409 && codigo === 'no_pendiente') return 'no_pendiente';
  if (status === 400 && codigo === 'motivo_requerido') return 'motivo_requerido';
  if (status === 404) return 'no_existe';
  if (status === 503) return 'no_disponible';
  return 'desconocido';
}
