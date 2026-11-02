// «Vistos recientemente» de la web: los ids de las fichas que esta persona abrió, guardados SOLO en su navegador (localStorage). No viajan al servidor ni se ligan a una cuenta.
// Lo guardado es texto de cualquiera (otra pestaña, otra versión, a mano): se valida al leer y lo que no sea un id se descarta. Sin almacenamiento disponible (modo privado, bloqueado) no pasa nada: no hay vistos.

export const CLAVE_VISTOS = 'cuervo360.vistos';
export const MAX_VISTOS = 12;
const ES_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Agrega `id` al frente (sin repetirlo) y recorta a `MAX_VISTOS`. Pura. */
export function conVisto(actuales: string[], id: string): string[] {
  if (!ES_ID.test(id)) return actuales;
  return [id, ...actuales.filter((x) => x !== id)].slice(0, MAX_VISTOS);
}

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
/** Para `useSyncExternalStore`: avisa cuando esta pestaña registra o borra. */
export function suscribirVistos(f: () => void) {
  oyentes.add(f);
  return () => void oyentes.delete(f);
}
/** Lo guardado tal cual (texto): una instantánea estable para comparar. `''` si no hay o no hay almacenamiento. */
export function vistosCrudos(): string {
  try {
    return globalThis.localStorage?.getItem(CLAVE_VISTOS) ?? '';
  } catch {
    return '';
  }
}

/** Lee la lista guardada: solo ids válidos, sin repetidos. Cualquier cosa rara es «no hay vistos». */
export function leerVistos(crudo: string = vistosCrudos()): string[] {
  try {
    const datos: unknown = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(datos)) return [];
    return [...new Set(datos.filter((x): x is string => typeof x === 'string' && ES_ID.test(x)))].slice(0, MAX_VISTOS);
  } catch {
    return [];
  }
}

function guardar(ids: string[]) {
  try {
    globalThis.localStorage?.setItem(CLAVE_VISTOS, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento no se recuerda nada; no es un error que mostrar.
  }
  avisar();
}

export function registrarVisto(id: string) {
  guardar(conVisto(leerVistos(), id));
}

export function borrarVistos() {
  try {
    globalThis.localStorage?.removeItem(CLAVE_VISTOS);
  } catch {
    // Igual que arriba.
  }
  avisar();
}
