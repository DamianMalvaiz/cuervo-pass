import { create } from 'zustand';

// El toast propio · paso 1 · el estado.
//
// Un solo aviso a la vez. Con una cola, tres errores seguidos se vuelven nueve
// segundos de pantalla ocupada con mensajes que ya no son lo que pasó; con
// reemplazo, siempre se ve lo más reciente.

export type TipoToast = 'exito' | 'error' | 'info';

/**
 * Cuánto dura cada tipo en pantalla.
 *
 * El error dura más a propósito: se lee más despacio y cuesta más perderse, y un
 * aviso que desaparece antes de poder leerse no avisó (WCAG 2.2.1). Todos se
 * cierran además tocándolos.
 */
export const DURACION_MS: Record<TipoToast, number> = {
  exito: 3000,
  info: 4000,
  error: 6000,
};

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
  duracionMs: number;
}

interface ToastState {
  actual: Toast | null;
  /** Muestra un aviso y devuelve su id. Reemplaza al que hubiera. */
  mostrar: (tipo: TipoToast, mensaje: string, opciones?: { duracionMs?: number }) => number;
  /**
   * Quita el aviso. Con `id`, solo si ese sigue siendo el actual: el temporizador
   * de un aviso viejo no puede llevarse al nuevo a medio leer.
   */
  descartar: (id?: number) => void;
}

// Fuera del store a propósito: es un contador del proceso, no estado que la
// interfaz observe.
let siguienteId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  actual: null,

  mostrar: (tipo, mensaje, opciones) => {
    const id = siguienteId++;
    const texto = mensaje.trim();
    // Un recuadro vacío no avisa de nada y se ve como un error de la app.
    if (!texto) return id;
    set({ actual: { id, tipo, mensaje: texto, duracionMs: opciones?.duracionMs ?? DURACION_MS[tipo] } });
    return id;
  },

  descartar: (id) => {
    const { actual } = get();
    if (!actual) return;
    if (id !== undefined && actual.id !== id) return;
    set({ actual: null });
  },
}));
