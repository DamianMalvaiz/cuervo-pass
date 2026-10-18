import type { RolUsuario } from '@/types/database.types';

const DE_VENDEDOR: readonly RolUsuario['rol'][] = ['arrendador', 'comerciante'];

/**
 * ¿Puede esta cuenta publicar? Solo con una función de vendedor APROBADA.
 *
 * Es una regla de INTERFAZ: decide qué pestañas y botones se muestran. La que de verdad lo
 * impide tiene que vivir en la base (invariante 6), y llega con la verificación de vendedor;
 * hasta entonces, quien llame a la API directamente no la encuentra. `admin` no cuenta: revisa,
 * no vende.
 */
export function puedePublicar(roles: readonly RolUsuario[]): boolean {
  return roles.some((r) => DE_VENDEDOR.includes(r.rol) && r.estado === 'aprobado');
}

/** ¿Tiene esta cuenta ESA función de vendedor aprobada? (`puedePublicar` solo dice si tiene alguna.) */
export function tieneFuncionAprobada(roles: readonly RolUsuario[], rol: 'comerciante' | 'arrendador'): boolean {
  return roles.some((r) => r.rol === rol && r.estado === 'aprobado');
}
