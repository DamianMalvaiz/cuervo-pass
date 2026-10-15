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

/**
 * Lo mínimo que dura un aviso que ofrece una acción.
 *
 * Un aviso con botón obliga a leer, decidir y alcanzar el botón. Si desaparece
 * antes, la acción no existió: ocho segundos es lo que cuesta hacerlo sin prisa, y
 * por eso un éxito con acción dura más que uno sin ella (WCAG 2.2.1).
 */
export const DURACION_CON_ACCION_MS = 8000;

/** Un botón dentro del aviso. Al pulsarlo se ejecuta y el aviso se cierra. */
export interface AccionToast {
  etiqueta: string;
  onPress: () => void;
}

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
  duracionMs: number;
  accion?: AccionToast;
}

interface ToastState {
  actual: Toast | null;
  /** Muestra un aviso y devuelve su id. Reemplaza al que hubiera. */
  mostrar: (
    tipo: TipoToast,
    mensaje: string,
    opciones?: { duracionMs?: number; accion?: AccionToast }
  ) => number;
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
    const accion = opciones?.accion;
    // La duración propia manda; si no, la del tipo, y con acción nunca menos de lo
    // que cuesta decidir. El que ya dura más no se acorta por tener acción.
    const porDefecto = accion ? Math.max(DURACION_MS[tipo], DURACION_CON_ACCION_MS) : DURACION_MS[tipo];
    set({ actual: { id, tipo, mensaje: texto, duracionMs: opciones?.duracionMs ?? porDefecto, accion } });
    return id;
  },

  descartar: (id) => {
    const { actual } = get();
    if (!actual) return;
    if (id !== undefined && actual.id !== id) return;
    set({ actual: null });
  },
}));
