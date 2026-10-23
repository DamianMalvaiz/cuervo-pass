// Una sola puerta al servidor: la Edge Function `admin`. Ninguna lectura ni escritura va directo a las tablas desde el navegador, y el id de quien actúa
// NO viaja: la función lo toma de la sesión. Todo desenlace que no sea un 2xx con la forma esperada LANZA un `ErrorAdmin`: un fallo nunca se confunde con «no hay nada».
import { ErrorAdmin, tipoDeErrorAdmin } from './errores';

export interface ResumenAdmin {
  verificaciones_pendientes: number;
  resenas_reportadas: number;
  resenas_ocultas: number;
  negocios_ocultos: number;
  cuentas: number;
  negocios_activos: number;
  modo_demo: boolean;
}

/** Lo mínimo del cliente de Supabase que necesita la API: así se prueba sin red. */
export interface ClienteAdmin {
  functions: {
    invoke: (nombre: string, opciones: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>;
  };
}

interface ErrorDeFuncion {
  context?: { status?: number; json?: () => Promise<unknown> };
}

export function crearApi(cliente: ClienteAdmin) {
  async function llamar(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    let respuesta;
    try {
      respuesta = await cliente.functions.invoke('admin', { body });
    } catch {
      throw new ErrorAdmin('red');
    }
    const { data, error } = respuesta;
    if (error) {
      const contexto = (error as ErrorDeFuncion).context;
      let codigo: string | undefined;
      try {
        codigo = ((await contexto?.json?.()) as { error?: string } | undefined)?.error;
      } catch {
        codigo = undefined;
      }
      throw new ErrorAdmin(tipoDeErrorAdmin(contexto?.status, codigo));
    }
    if (!data || typeof data !== 'object') throw new ErrorAdmin('desconocido');
    return data as Record<string, unknown>;
  }

  return {
    async resumen(): Promise<ResumenAdmin> {
      const d = await llamar({ accion: 'resumen' });
      if (!d.resumen || typeof d.resumen !== 'object') throw new ErrorAdmin('desconocido');
      return d.resumen as ResumenAdmin;
    },
  };
}

export type ApiAdmin = ReturnType<typeof crearApi>;
