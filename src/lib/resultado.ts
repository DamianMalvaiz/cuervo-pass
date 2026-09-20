// Tres estados, no dos · END-11 · §27
//
// El defecto que esto viene a cerrar aparecía en dos sitios y era el mismo:
// colapsar «falló la lectura» y «no hay nada» en un solo `null`.
//
//   · `publicacion/[id].tsx` hacía `.catch(aviso)` y dejaba la publicación en
//     null. La pantalla entonces decía «FICHA NO DISPONIBLE — pudo desactivarse
//     u ocultarse tras varios reportes». Se cae el wifi y la app afirma que esa
//     publicación fue REPORTADA por abuso. No es un mensaje impreciso: es una
//     acusación inventada por un fallo de red.
//
//   · `usePerfilStore` hacía `set({ perfil: error ? null : data })`, y
//     `ResumenFiltros` pintaba «Sin presupuesto · Sin distancia · Sin
//     universidad». Un fallo de lectura presentado como pérdida de datos.
//
// Un booleano no puede representar tres estados. Mientras el tipo solo tenga
// dos, alguien volverá a meter el fallo en el hueco del vacío — porque encaja.
//
// La regla que gobierna esto, y que está en AGENTS.md: **prohibido que un
// `catch` produzca `vacio`.** Un catch solo puede producir `error`.

export type Resultado<T> =
  | { estado: 'ok'; datos: T }
  | { estado: 'vacio' }
  | { estado: 'error'; mensaje: string };

export const ok = <T,>(datos: T): Resultado<T> => ({ estado: 'ok', datos });
export const vacio = <T,>(): Resultado<T> => ({ estado: 'vacio' });
export const problema = <T,>(mensaje: string): Resultado<T> => ({ estado: 'error', mensaje });

/**
 * Envuelve una promesa que puede devolver `null` legítimamente.
 *
 * `null` es `vacio`. Una excepción es `error`. Nunca al revés: por eso el
 * `catch` de aquí es el único sitio del código que necesita distinguirlos, y
 * por eso conviene que exista una sola vez.
 */
export async function desde<T>(
  promesa: Promise<T | null>,
  textoDelFallo = 'No pudimos consultar. Revisa tu conexión.'
): Promise<Resultado<T>> {
  try {
    const datos = await promesa;
    return datos == null ? vacio<T>() : ok(datos);
  } catch {
    return problema<T>(textoDelFallo);
  }
}

/** `true` cuando hay datos, y estrecha el tipo. */
export function tieneDatos<T>(r: Resultado<T>): r is { estado: 'ok'; datos: T } {
  return r.estado === 'ok';
}
