// Panel de administración · una sola llamada, a la Edge Function `admin`. Ninguna escritura va directo a las tablas desde el cliente.
//
// El id de quien actúa NO viaja: la función lo toma de la sesión.

import { ErrorAdmin, tipoDeErrorAdmin } from '@/lib/admin';
import { supabase } from '@/lib/supabase';

export interface ResumenAdmin {
  verificaciones_pendientes: number;
  resenas_reportadas: number;
  resenas_ocultas: number;
  negocios_ocultos: number;
  cuentas: number;
  negocios_activos: number;
  modo_demo: boolean;
}

export interface VerificacionPendiente {
  usuario_id: string;
  rol: 'comerciante' | 'arrendador';
  nombre_usuario: string;
  nombre_legal: string;
  direccion: string;
  enviada_en: string;
  version_aviso: string;
  fotos_del_lugar: number;
  rostro_estado: string | null;
}

export interface ItemModeracion {
  tipo: 'resena' | 'negocio';
  id: string;
  titulo: string;
  texto: string | null;
  autor: string;
  reportes: number;
  oculto: boolean;
  creado_en: string;
}

export interface ErrorRegistrado {
  id: string;
  nivel: 'aviso' | 'error';
  mensaje: string;
  detalle: string | null;
  version_app: string;
  plataforma: string;
  conteo: number;
  primera_vez: string;
  ultima_vez: string;
}

export interface DocumentoAdmin {
  etiqueta: string;
  url: string | null;
}

type Rol = 'comerciante' | 'arrendador';

/** Todo desenlace que no sea un 2xx con la forma esperada LANZA un `ErrorAdmin` (nunca se confunde un fallo con «no hay nada»). */
async function llamar(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let respuesta;
  try {
    respuesta = await supabase.functions.invoke('admin', { body });
  } catch {
    throw new ErrorAdmin('red');
  }
  const { data, error } = respuesta;
  if (error) {
    const contexto = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    let codigo: string | undefined;
    try {
      const cuerpo = (await contexto?.json?.()) as { error?: string } | undefined;
      codigo = cuerpo?.error;
    } catch {
      codigo = undefined;
    }
    throw new ErrorAdmin(tipoDeErrorAdmin(contexto?.status, codigo));
  }
  if (!data || typeof data !== 'object') throw new ErrorAdmin('desconocido');
  return data as Record<string, unknown>;
}

function lista<T>(d: Record<string, unknown>, clave: string): T[] {
  const v = d[clave];
  if (!Array.isArray(v)) throw new ErrorAdmin('desconocido');
  return v as T[];
}

export async function obtenerResumen(): Promise<ResumenAdmin> {
  const d = await llamar({ accion: 'resumen' });
  if (!d.resumen || typeof d.resumen !== 'object') throw new ErrorAdmin('desconocido');
  return d.resumen as ResumenAdmin;
}

export async function listarVerificaciones(): Promise<VerificacionPendiente[]> {
  return lista<VerificacionPendiente>(await llamar({ accion: 'verificaciones' }), 'verificaciones');
}

export async function listarModeracion(): Promise<ItemModeracion[]> {
  return lista<ItemModeracion>(await llamar({ accion: 'moderacion' }), 'moderacion');
}

/** Pide los enlaces (10 min) a la evidencia. El servidor deja registrado que se miraron. */
export async function documentosDe(usuarioId: string, rol: Rol): Promise<DocumentoAdmin[]> {
  return lista<DocumentoAdmin>(await llamar({ accion: 'documentos', usuario_id: usuarioId, rol }), 'documentos');
}

export async function resolverVerificacion(usuarioId: string, rol: Rol, aprobar: boolean, motivo: string | null): Promise<void> {
  await llamar({ accion: 'resolver', usuario_id: usuarioId, rol, aprobar, motivo });
}

export async function moderar(tipo: 'resena' | 'negocio', id: string, ocultar: boolean, motivo: string | null): Promise<void> {
  await llamar({ accion: 'moderar', tipo, id, ocultar, motivo });
}

/** Los problemas que ha registrado la app en la última semana, agrupados (migración 0068). */
export async function listarErrores(): Promise<ErrorRegistrado[]> {
  return lista<ErrorRegistrado>(await llamar({ accion: 'errores' }), 'errores');
}

export async function borrarError(id: string): Promise<void> {
  await llamar({ accion: 'borrar_error', id });
}

export async function fijarModoDemo(activo: boolean): Promise<boolean> {
  const d = await llamar({ accion: 'modo_demo', activo });
  return d.modo_demo === true;
}
