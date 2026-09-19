// Registro de la aplicación · END-12 · §27, §29
//
// Había 23 `console.warn`/`console.error` repartidos por `src/`. En un build de
// release **no los ve nadie**: el puente de consola no existe fuera del
// desarrollo. O sea que todo lo que la app sabía de sus propios fallos se
// perdía justo en el entorno donde importa.
//
// Esto es una fachada, no un servicio. Su trabajo es que los 23 sitios llamen a
// UN lugar, para que enchufar un recolector de errores más tarde sea diez
// líneas aquí y cero en el resto del código. Hoy el destino es la consola; el
// día que se instale Sentry, se registra su sumidero con `registrarSumidero` y
// nada más cambia.
//
// Lo que NO hace, a propósito: no traga el error. Registrar y seguir es
// decisión de quien llama, y el defecto que END-11 describe —un `catch` que
// convierte un fallo de red en «no hay datos»— no se arregla con un logger.

export type Nivel = 'aviso' | 'error';

export interface Evento {
  nivel: Nivel;
  mensaje: string;
  /** Contexto adicional. Se limpia antes de salir del dispositivo. */
  datos?: Record<string, unknown>;
  error?: unknown;
}

type Sumidero = (evento: Evento) => void;

const sumideros: Sumidero[] = [];

/** Enchufa un destino adicional (Sentry, un archivo, una prueba). */
export function registrarSumidero(s: Sumidero): () => void {
  sumideros.push(s);
  return () => {
    const i = sumideros.indexOf(s);
    if (i >= 0) sumideros.splice(i, 1);
  };
}

// §29 exige minimización, y un reporte de error es donde más se filtra: viaja
// entero, a un tercero, sin que nadie lo lea antes. Estas claves salen del
// cuestionario y de los anuncios, y ninguna hace falta para diagnosticar.
const CLAVES_SENSIBLES = [
  'perfil_texto',
  'perfilTexto',
  'whatsapp',
  'descripcion_busqueda',
  'descripcionBusqueda',
  'biografia',
  'password',
  'contrasena',
  'access_token',
  'refresh_token',
];

const CORREO = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Quita de un contexto lo que no debe salir del teléfono.
 *
 * Se recorre en profundidad porque un objeto de Supabase anida el cuerpo de la
 * petición dos o tres niveles: limpiar solo el primero deja pasar justo lo que
 * se quería quitar.
 */
export function limpiar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 6) return '[profundo]';
  if (typeof valor === 'string') return valor.replace(CORREO, '[correo]');
  if (Array.isArray(valor)) return valor.map((v) => limpiar(v, profundidad + 1));
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = CLAVES_SENSIBLES.includes(clave) ? '[omitido]' : limpiar(v, profundidad + 1);
    }
    return salida;
  }
  return valor;
}

function emitir(evento: Evento) {
  const limpio: Evento = {
    ...evento,
    mensaje: String(limpiar(evento.mensaje)),
    datos: evento.datos ? (limpiar(evento.datos) as Record<string, unknown>) : undefined,
  };

  // La consola sigue existiendo en desarrollo: quitarla haría más difícil
  // trabajar a cambio de nada.
  if (__DEV__) {
    const salida = limpio.nivel === 'error' ? console.error : console.warn;
    salida(limpio.mensaje, limpio.datos ?? '', evento.error ?? '');
  }

  for (const s of sumideros) {
    // Un sumidero roto no puede tumbar la app. Un logger que revienta es peor
    // que no tener logger.
    try {
      s(limpio);
    } catch {
      /* sin efecto */
    }
  }
}

export function aviso(mensaje: string, datos?: Record<string, unknown>, error?: unknown) {
  emitir({ nivel: 'aviso', mensaje, datos, error });
}

export function fallo(mensaje: string, datos?: Record<string, unknown>, error?: unknown) {
  emitir({ nivel: 'error', mensaje, datos, error });
}

/** Texto de un error desconocido, sin `[object Object]`. */
export function textoDeError(error: unknown): string {
  if (error instanceof Error) return error.message || 'sin detalle';
  if (typeof error === 'string') return error || 'sin detalle';
  try {
    return JSON.stringify(error) ?? 'sin detalle';
  } catch {
    return 'sin detalle';
  }
}
