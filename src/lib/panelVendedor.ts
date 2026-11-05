// El panel del vendedor (0083): qué paso de verificación se enseña y cómo se llama lo que ofrece.
//
// Solo toma decisiones; no pinta. La pantalla enseña UN paso, el que más urge: lo que la persona tiene que hacer (empezar o reenviar) va antes que
// lo que solo tiene que esperar, y esto antes que nada. «Heredada» (aprobada por la migración, sin pasar por una revisión) cuenta como aprobada
// para el panel: no se le inventa a nadie un paso que no le corresponde (aunque se SABE si es heredada: ver `heredada`).

import type { RolUsuario } from '@/types/database.types';

type Vendedor = 'arrendador' | 'comerciante';

export type PasoVerificacion =
  | { tipo: 'empezar'; rol: Vendedor }
  | { tipo: 'reenviar'; rol: Vendedor }
  | { tipo: 'esperar'; rol: Vendedor }
  /** Todo aprobado. `heredada`: TODAS las aprobadas vienen de la migración (0043), sin pasar por una revisión: no hay paso pendiente, pero tampoco se rotula como verificada. */
  | { tipo: 'listo'; rol: null; heredada: boolean };

const esVendedor = (r: RolUsuario): r is RolUsuario & { rol: Vendedor } => r.rol === 'arrendador' || r.rol === 'comerciante';

export function pasoDeVerificacion(roles: readonly RolUsuario[]): PasoVerificacion | null {
  const propios = roles.filter(esVendedor);
  if (propios.length === 0) return null;
  const sin = propios.find((r) => r.estado === 'sin_verificar');
  if (sin) return { tipo: 'empezar', rol: sin.rol };
  const rechazada = propios.find((r) => r.estado === 'rechazado');
  if (rechazada) return { tipo: 'reenviar', rol: rechazada.rol };
  const pendiente = propios.find((r) => r.estado === 'pendiente');
  if (pendiente) return { tipo: 'esperar', rol: pendiente.rol };
  return { tipo: 'listo', rol: null, heredada: propios.every((r) => r.origen === 'migracion') };
}

/** Cómo se llama el bloque de lo que la persona ofrece, según las funciones que tiene. */
export function tituloDeLoPropio(roles: readonly RolUsuario[]): string {
  const propios = roles.filter(esVendedor).map((r) => r.rol);
  const arrienda = propios.includes('arrendador');
  const vende = propios.includes('comerciante');
  if (arrienda && vende) return 'Lo que ofrezco';
  return vende ? 'Mis negocios' : 'Mis publicaciones';
}
