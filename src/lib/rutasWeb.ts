// Las direcciones de la web pública y cómo viaja una búsqueda por la URL. Cada sección es su propia página (`/departamentos`, `/roomies`, `/servicios`), sus fichas cuelgan de ella y un
// enlace como `/departamentos?tipo=cuarto&zona=Lerma` abre la búsqueda ya filtrada. Lo que llega por la URL es texto de cualquiera: se valida antes de volverse filtro.

import { FILTROS_VACIOS, aFiltroPublicaciones, type FiltrosWeb } from '@/lib/filtrosWeb';
import type { TipoVivienda } from '@/services/explorar.service';

export const RutasWeb = {
  inicio: '/',
  departamentos: '/departamentos',
  roomies: '/roomies',
  servicios: '/servicios',
  ficha: (id: string) => `/departamentos/${id}` as const,
  negocio: (id: string) => `/servicios/${id}` as const,
} as const;

const TIPOS: TipoVivienda[] = ['cuarto', 'depa', 'casa_compartida'];
const MAX_ZONA = 80;

/** Los filtros como parámetros de URL: solo lo que de verdad filtra, y los sí/no como «1». */
export function aParametros(f: FiltrosWeb): Record<string, string> {
  const filtro = aFiltroPublicaciones(f, 1);
  const p: Record<string, string> = {};
  if (filtro.zona) p.zona = filtro.zona;
  if (filtro.precioMax !== undefined) p.presupuesto = String(filtro.precioMax);
  if (filtro.tipo) p.tipo = filtro.tipo;
  if (filtro.amueblado) p.amueblado = '1';
  if (filtro.mascotas) p.mascotas = '1';
  if (filtro.serviciosIncluidos) p.servicios = '1';
  return p;
}

const primero = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Los parámetros de URL como filtros. Un tipo desconocido se ignora, el presupuesto conserva solo cifras, la zona se recorta y los sí/no solo valen con «1». */
export function deParametros(p: Record<string, string | string[] | undefined>): FiltrosWeb {
  const tipo = primero(p.tipo);
  return {
    ...FILTROS_VACIOS,
    zona: (primero(p.zona) ?? '').trim().slice(0, MAX_ZONA),
    presupuesto: (primero(p.presupuesto) ?? '').replace(/\D/g, ''),
    tipo: TIPOS.includes(tipo as TipoVivienda) ? (tipo as TipoVivienda) : null,
    amueblado: primero(p.amueblado) === '1',
    mascotas: primero(p.mascotas) === '1',
    serviciosIncluidos: primero(p.servicios) === '1',
  };
}
