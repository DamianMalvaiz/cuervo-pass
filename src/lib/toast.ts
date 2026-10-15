// La API para mostrar avisos desde cualquier sitio, también fuera de React.
//
// Es una función y no un hook a propósito: el punto donde hace falta avisar suele
// ser un `catch`, un callback de `onError` o un servicio, no el cuerpo de un
// componente. Hace falta que `ToastHost` esté montado en el layout raíz.
//
// ── Cuándo sí y cuándo no ──────────────────────────────────────────────────
// SÍ: algo pasó y no hay otro sitio donde verlo —se guardó, falló el guardado,
// un `Alert` que solo informaba—. NO: el error de un campo (se queda junto al
// campo, y debe seguir ahí mientras se corrige), una pantalla bloqueada (lleva
// su propio estado con salida) ni una confirmación que necesita decisión.
//
// Un fallo se dice como fallo (invariante 2): `toast.error`, nunca `toast.info`
// con un texto suave que lo disfrace de otra cosa.

import { useToastStore, type AccionToast } from '@/store/useToastStore';

type Opciones = {
  duracionMs?: number;
  /** Un botón en el aviso, p. ej. «Ajustes». Al pulsarlo se ejecuta y el aviso se cierra. */
  accion?: AccionToast;
};

export const toast = {
  /** Algo quedó hecho. */
  exito: (mensaje: string, opciones?: Opciones) =>
    useToastStore.getState().mostrar('exito', mensaje, opciones),
  /** Algo falló. Dura más que los demás. */
  error: (mensaje: string, opciones?: Opciones) =>
    useToastStore.getState().mostrar('error', mensaje, opciones),
  /** Algo que saber y que no es ni lo uno ni lo otro. */
  info: (mensaje: string, opciones?: Opciones) =>
    useToastStore.getState().mostrar('info', mensaje, opciones),
  /** Quita el aviso actual, o el de ese id si sigue siendo el actual. */
  descartar: (id?: number) => useToastStore.getState().descartar(id),
};
