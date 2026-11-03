import { ES_ID } from '@/lib/vistos';

// «Comparar» de la web: hasta tres viviendas puestas lado a lado. Los ids se guardan SOLO en el navegador (localStorage), igual que «Vistos recientemente»; se validan al leer porque lo guardado es texto de cualquiera.

export const CLAVE_COMPARAR = 'cuervo360.comparar';
export const MAX_COMPARAR = 3;

/** Quita `id` si ya estaba; si no, lo agrega al final, salvo que ya haya `MAX_COMPARAR` (entonces no cambia nada). Pura. */
export function conComparado(actuales: string[], id: string): string[] {
  if (!ES_ID.test(id)) return actuales;
  if (actuales.includes(id)) return actuales.filter((x) => x !== id);
  return actuales.length >= MAX_COMPARAR ? actuales : [...actuales, id];
}

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
/** Para `useSyncExternalStore`: avisa cuando esta pestaña cambia la lista. */
export function suscribirComparar(f: () => void) {
  oyentes.add(f);
  return () => void oyentes.delete(f);
}
/** Lo guardado tal cual (texto): una instantánea estable para comparar. `''` si no hay o no hay almacenamiento. */
export function compararCrudo(): string {
  try {
    return globalThis.localStorage?.getItem(CLAVE_COMPARAR) ?? '';
  } catch {
    return '';
  }
}

export function leerComparar(crudo: string = compararCrudo()): string[] {
  try {
    const datos: unknown = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(datos)) return [];
    return [...new Set(datos.filter((x): x is string => typeof x === 'string' && ES_ID.test(x)))].slice(0, MAX_COMPARAR);
  } catch {
    return [];
  }
}

function guardar(ids: string[]) {
  try {
    if (ids.length === 0) globalThis.localStorage?.removeItem(CLAVE_COMPARAR);
    else globalThis.localStorage?.setItem(CLAVE_COMPARAR, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento no se recuerda nada; no es un error que mostrar.
  }
  avisar();
}

export function alternarComparar(id: string) {
  guardar(conComparado(leerComparar(), id));
}

export function quitarComparar(id: string) {
  guardar(leerComparar().filter((x) => x !== id));
}

export function vaciarComparar() {
  guardar([]);
}
