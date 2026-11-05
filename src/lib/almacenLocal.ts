import AsyncStorage from '@react-native-async-storage/async-storage';

// El almacén de «Vistos recientemente» y «Comparar»: lo que vive SOLO en el dispositivo (ni viaja al servidor ni se liga a la cuenta). Un solo lugar para las dos plataformas, con la misma interfaz SÍNCRONA que ya usaban los hooks
// (`useSyncExternalStore` pide leer al instante):
//  · En la web, `localStorage`, como siempre.
//  · En la app no hay `localStorage` y AsyncStorage es asíncrono: se lee UNA vez al arrancar (`hidratarAlmacen`) a una copia en memoria, desde donde se lee al instante, y cada cambio se escribe a AsyncStorage detrás.
//
// Hasta que la copia está hidratada, un cambio ESPERA (`cuandoListo`): escribir antes de leer lo guardado lo pisaría. Si AsyncStorage no se puede leer, se sigue con la lista vacía (es una comodidad, no un dato de la cuenta); lo que se
// guarde después sustituye a lo que hubiera, y eso es lo único que se pierde. Se escribe a AsyncStorage sin esperar respuesta: si falla, la lista vale hasta cerrar la app.

/** Lo que se hidrata: las claves de «Vistos» y «Comparar» (sus módulos exportan las mismas; una prueba lo comprueba). */
export const CLAVES_ALMACEN = ['cuervo360.vistos', 'cuervo360.comparar'] as const;

const copia = new Map<string, string>();
const pendientes: (() => void)[] = [];
const oyentes = new Set<() => void>();
let hidratado = false;
let hidratacion: Promise<void> | null = null;

/** `localStorage` si lo hay (la web, y las pruebas que lo simulan); en la app no existe y se usa la copia en memoria. */
function localStorageSeguro(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    // Modo privado o almacenamiento bloqueado: acceder ya lanza. Sin almacenamiento no se recuerda nada.
    return undefined;
  }
}
const hayLocalStorage = () => {
  try {
    return globalThis.localStorage !== undefined;
  } catch {
    return true; // la web con el acceso bloqueado: no es la app, y no hay copia en memoria que usar
  }
};

/** Lo guardado tal cual (texto) bajo `clave`; `''` si no hay nada o no hay almacenamiento. */
export function leerAlmacen(clave: string): string {
  if (hayLocalStorage()) {
    try {
      return localStorageSeguro()?.getItem(clave) ?? '';
    } catch {
      return '';
    }
  }
  return copia.get(clave) ?? '';
}

/** Guarda `valor` bajo `clave`; `null` la borra. Sin almacenamiento no pasa nada. */
export function escribirAlmacen(clave: string, valor: string | null) {
  if (hayLocalStorage()) {
    try {
      if (valor === null) localStorageSeguro()?.removeItem(clave);
      else localStorageSeguro()?.setItem(clave, valor);
    } catch {
      // Sin almacenamiento no se recuerda nada; no es un error que mostrar.
    }
    return;
  }
  if (valor === null) copia.delete(clave);
  else copia.set(clave, valor);
  (valor === null ? AsyncStorage.removeItem(clave) : AsyncStorage.setItem(clave, valor)).catch(() => {});
}

/** Lee lo guardado a la copia en memoria. En la web no hace falta y termina al instante. Pedirla otra vez no repite la lectura. */
export function hidratarAlmacen(): Promise<void> {
  if (hayLocalStorage()) return Promise.resolve();
  hidratacion ??= AsyncStorage.multiGet([...CLAVES_ALMACEN])
    .then((pares) => {
      // Lo que ya se escribió en esta sesión (no debería haberlo: se espera) manda sobre lo viejo.
      for (const [clave, valor] of pares) if (valor !== null && !copia.has(clave)) copia.set(clave, valor);
    })
    .catch(() => {})
    .then(() => {
      hidratado = true;
      pendientes.splice(0).forEach((f) => f());
      oyentes.forEach((f) => f());
    });
  return hidratacion;
}

/** Corre `f` ya si la copia está lista (siempre, en la web), o en cuanto se hidrate (y pide la lectura si nadie lo había hecho). */
export function cuandoListo(f: () => void) {
  if (hayLocalStorage() || hidratado) return f();
  pendientes.push(f);
  void hidratarAlmacen();
}

/** Para `useSyncExternalStore`: avisa cuando la copia termina de hidratarse (lo que cambie después lo avisa cada módulo). */
export function alHidratar(f: () => void): () => void {
  oyentes.add(f);
  return () => void oyentes.delete(f);
}

/** Solo para pruebas: deja la copia como recién arrancada. */
export function reiniciarAlmacenParaPruebas() {
  copia.clear();
  pendientes.length = 0;
  oyentes.clear();
  hidratado = false;
  hidratacion = null;
}
