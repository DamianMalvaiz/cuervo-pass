import { aviso } from '@/lib/registro';
import { supabase } from '@/lib/supabase';

export interface DatosCP {
  estado: string;
  municipio: string;
  localidad: string | null;
  colonias: string[];
}

/** La búsqueda falló (red, servidor). NO significa que el código no exista: eso es `null`. */
export class ErrorBusquedaCP extends Error {
  constructor() {
    super('No se pudo buscar el código postal');
    this.name = 'ErrorBusquedaCP';
  }
}

// El catálogo de SEPOMEX/INEGI vive en la base (migración 0069) y se consulta por una RPC. Antes era el paquete `@webrek/mx-cp` DENTRO de la app: 9.6 MB, el 72 %
// del JavaScript, para una sola función. Lo que cambia al sacarlo: ahora la red puede fallar, y eso hay que decirlo distinto de «ese código no existe»
// (invariante 2). Nunca bloquea el formulario: la persona puede seguir llenando todo a mano.
//
//   · devuelve `null`  → el código no existe (o no tiene forma de código postal; en ese caso ni se pega a la red);
//   · LANZA `ErrorBusquedaCP` → no se pudo consultar.
export async function buscarPorCodigoPostal(cp: string): Promise<DatosCP | null> {
  const limpio = (cp ?? '').trim();
  if (!/^[0-9]{5}$/.test(limpio)) return null;

  let respuesta;
  try {
    respuesta = await supabase.rpc('buscar_codigo_postal', { p_cp: limpio });
  } catch (e) {
    aviso('Búsqueda de código postal no respondió', undefined, e);
    throw new ErrorBusquedaCP();
  }
  if (respuesta.error) {
    aviso('Búsqueda de código postal falló', { detalle: respuesta.error.message });
    throw new ErrorBusquedaCP();
  }

  const fila = (respuesta.data as { estado: string; municipio: string; ciudad: string | null; colonias: string[] | null }[] | null)?.[0];
  if (!fila) return null;
  return {
    estado: fila.estado,
    municipio: fila.municipio,
    localidad: fila.ciudad && fila.ciudad !== 'NULL' ? fila.ciudad : null,
    colonias: fila.colonias ?? [],
  };
}
