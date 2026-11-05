import { alHidratar, cuandoListo, escribirAlmacen, leerAlmacen } from '@/lib/almacenLocal';
import { alCambiarEnOtraPestana } from '@/lib/otraPestana';
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
/** Para `useSyncExternalStore`: avisa cuando esta pestaña (o, por `storage`, otra) cambia la lista. */
export function suscribirComparar(f: () => void) {
  oyentes.add(f);
  // Lo que cambie OTRA pestaña también llega (el evento `storage` no se dispara en la que escribe).
  const bajaOtra = alCambiarEnOtraPestana(CLAVE_COMPARAR, f);
  // En la app, además, cuando termina de leerse lo guardado.
  const bajaHidratar = alHidratar(f);
  return () => {
    oyentes.delete(f);
    bajaOtra();
    bajaHidratar();
  };
}
/** Lo guardado tal cual (texto): una instantánea estable para comparar. `''` si no hay o no hay almacenamiento. */
export function compararCrudo(): string {
  return leerAlmacen(CLAVE_COMPARAR);
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
  escribirAlmacen(CLAVE_COMPARAR, ids.length === 0 ? null : JSON.stringify(ids));
  avisar();
}

// En la app cada cambio espera a que se lea lo guardado (ver `almacenLocal`): sobre una lista aún vacía, agregar y escribir pisaría lo que había.
export function alternarComparar(id: string) {
  cuandoListo(() => guardar(conComparado(leerComparar(), id)));
}

export function quitarComparar(id: string) {
  cuandoListo(() => guardar(leerComparar().filter((x) => x !== id)));
}

export function vaciarComparar() {
  guardar([]);
}
