// El buscador de la portada pública · lo que la persona escribe, vuelto filtro del servidor (`explorar.service`). Lógica pura, sin React.

import type { FiltroPublicaciones, TipoVivienda } from '@/services/explorar.service';

export interface FiltrosWeb {
  zona: string;
  /** Texto tal cual lo teclea la persona: «4000», «$4,000». Se interpreta al buscar. */
  presupuesto: string;
  tipo: TipoVivienda | null;
  amueblado: boolean;
  mascotas: boolean;
  serviciosIncluidos: boolean;
}

export const FILTROS_VACIOS: FiltrosWeb = { zona: '', presupuesto: '', tipo: null, amueblado: false, mascotas: false, serviciosIncluidos: false };

/** Más de nueve cifras no es una renta: no se manda al servidor. */
const MAX_CIFRAS = 9;

/** Pesos enteros de un texto («$4,000» → 4000). Sin cifras, en cero o absurdo: sin tope (`undefined`). Los decimales se descartan sin redondear: un tope no se infla. */
export function parsearPresupuesto(texto: string): number | undefined {
  const entero = texto.trim().split('.')[0];
  const cifras = entero.replace(/\D/g, '');
  if (cifras === '' || cifras.length > MAX_CIFRAS || texto.trim().startsWith('-')) return undefined;
  const n = Number(cifras);
  return n > 0 ? n : undefined;
}

const ORDEN_TIPOS: (TipoVivienda | null)[] = [null, 'cuarto', 'depa', 'casa_compartida'];

export function siguienteTipo(tipo: TipoVivienda | null): TipoVivienda | null {
  return ORDEN_TIPOS[(ORDEN_TIPOS.indexOf(tipo) + 1) % ORDEN_TIPOS.length];
}

const NOMBRES: Record<TipoVivienda, string> = { cuarto: 'Cuarto', depa: 'Departamento', casa_compartida: 'Casa compartida' };

export const etiquetaDeTipo = (tipo: TipoVivienda | null): string => (tipo ? NOMBRES[tipo] : 'Todos');

export function aFiltroPublicaciones(f: FiltrosWeb, limite: number): FiltroPublicaciones {
  const filtro: FiltroPublicaciones = { limite };
  const zona = f.zona.trim();
  const tope = parsearPresupuesto(f.presupuesto);
  if (zona) filtro.zona = zona;
  if (tope !== undefined) filtro.precioMax = tope;
  if (f.tipo) filtro.tipo = f.tipo;
  if (f.amueblado) filtro.amueblado = true;
  if (f.mascotas) filtro.mascotas = true;
  if (f.serviciosIncluidos) filtro.serviciosIncluidos = true;
  return filtro;
}

/** ¿Hay algo que realmente filtre? Un texto de presupuesto sin cifras no cuenta. */
export const hayFiltros = (f: FiltrosWeb): boolean => Object.keys(aFiltroPublicaciones(f, 1)).length > 1;
