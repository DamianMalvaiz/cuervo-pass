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

export interface DetalleAdmin {
  altas_por_semana: { semana: string; cuentas: number }[];
  roles_por_estado: { rol: string; estado: string; total: number }[];
  publicaciones: { total: number; activas: number };
  negocios: { total: number; activos: number };
  conversaciones: number;
  mensajes_7d: number;
}

export type Rol = 'comerciante' | 'arrendador';

export interface VerificacionPendiente {
  usuario_id: string;
  rol: Rol;
  nombre_usuario: string;
  nombre_legal: string;
  direccion: string;
  enviada_en: string;
  version_aviso: string;
  fotos_del_lugar: number;
  rostro_estado: string | null;
}

export interface DocumentoAdmin {
  etiqueta: string;
  url: string | null;
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

export interface EntradaAuditoria {
  accion: string;
  admin: string;
  objetivo_id: string | null;
  objetivo: string | null;
  detalle: string | null;
  creado_en: string;
}

export interface IngresosAdmin {
  por_semana: { semana: string; mercadopago_centavos: number; simulado_centavos: number }[];
  ingresos_30d: { mercadopago_centavos: number; simulado_centavos: number; pagos_mercadopago: number; pagos_simulados: number };
  suscripciones: { activas: number; en_prueba: number; vencidas: number; por_vencer_7d: number };
  por_plan: { plan_id: string; nombre: string; rol: string; activas: number; mercadopago_30d_centavos: number; simulado_30d_centavos: number }[];
  ordenes_30d: { creada: number; pendiente: number; pagada: number; rechazada: number };
  ultimos_pagos: { creado_en: string; origen: 'mercadopago' | 'simulado'; plan: string; monto_centavos: number; usuario: string | null }[];
}

export interface SaludAdmin {
  ia: { estado: 'sin_configurar' | 'caido' | 'cargando' | 'ok'; latencia_ms: number | null; api_llm_configurada: boolean | null; commit: string | null };
  mercadopago: { configurado: boolean };
}

export interface EventosPagoAdmin {
  total_24h: number;
  alertas_24h: number;
  eventos: { recibido_en: string; etiqueta: string; nivel: 'info' | 'alerta'; status: number; pago_id: string | null }[];
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

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** La respuesta se VALIDA antes de pintarse: una forma rota es un fallo, nunca cifras inventadas ni ceros. */
function leerDetalle(d: unknown): DetalleAdmin {
  if (!esObjeto(d)) throw new ErrorAdmin('desconocido');
  const { altas_por_semana: altas, roles_por_estado: roles, publicaciones, negocios, conversaciones, mensajes_7d: mensajes } = d;
  const buenas =
    Array.isArray(altas) && altas.every((a) => esObjeto(a) && typeof a.semana === 'string' && esNumero(a.cuentas)) &&
    Array.isArray(roles) && roles.every((r) => esObjeto(r) && typeof r.rol === 'string' && typeof r.estado === 'string' && esNumero(r.total)) &&
    esObjeto(publicaciones) && esNumero(publicaciones.total) && esNumero(publicaciones.activas) &&
    esObjeto(negocios) && esNumero(negocios.total) && esNumero(negocios.activos) &&
    esNumero(conversaciones) && esNumero(mensajes);
  if (!buenas) throw new ErrorAdmin('desconocido');
  return d as unknown as DetalleAdmin;
}

const esTexto = (v: unknown): v is string => typeof v === 'string';
const esRol = (v: unknown): v is Rol => v === 'comerciante' || v === 'arrendador';

function leerVerificaciones(lista: unknown): VerificacionPendiente[] {
  const buenas =
    Array.isArray(lista) &&
    lista.every(
      (v) =>
        esObjeto(v) && esTexto(v.usuario_id) && esRol(v.rol) && esTexto(v.nombre_usuario) && esTexto(v.nombre_legal) && esTexto(v.direccion) &&
        esTexto(v.enviada_en) && esTexto(v.version_aviso) && esNumero(v.fotos_del_lugar) && (v.rostro_estado === null || esTexto(v.rostro_estado)),
    );
  if (!buenas) throw new ErrorAdmin('desconocido');
  return lista as VerificacionPendiente[];
}

/**
 * Solo se pintan imágenes de NUESTRO Supabase (el origen exacto, con `/` detrás: `x.supabase.co.atacante.com` no pasa). Lo demás se descarta como «no
 * disponible». Sin origen configurado no se acepta ninguna: falla cerrado.
 */
function leerDocumentos(lista: unknown, origenArchivos: string | undefined): DocumentoAdmin[] {
  if (!Array.isArray(lista) || !lista.every((d) => esObjeto(d) && esTexto(d.etiqueta))) throw new ErrorAdmin('desconocido');
  const prefijo = origenArchivos ? `${origenArchivos}/` : null;
  return (lista as { etiqueta: string; url?: unknown }[]).map((d) => ({
    etiqueta: d.etiqueta,
    url: prefijo && esTexto(d.url) && d.url.startsWith(prefijo) ? d.url : null,
  }));
}

const textoONulo = (v: unknown): v is string | null => v === null || esTexto(v);

function leerModeracion(lista: unknown): ItemModeracion[] {
  const buenas =
    Array.isArray(lista) &&
    lista.every(
      (i) =>
        esObjeto(i) && (i.tipo === 'resena' || i.tipo === 'negocio') && esTexto(i.id) && esTexto(i.titulo) && textoONulo(i.texto) && esTexto(i.autor) &&
        esNumero(i.reportes) && typeof i.oculto === 'boolean' && esTexto(i.creado_en),
    );
  if (!buenas) throw new ErrorAdmin('desconocido');
  return lista as ItemModeracion[];
}

function leerAuditoria(lista: unknown): EntradaAuditoria[] {
  const buenas =
    Array.isArray(lista) &&
    lista.every((e) => esObjeto(e) && esTexto(e.accion) && esTexto(e.admin) && textoONulo(e.objetivo_id) && textoONulo(e.objetivo) && textoONulo(e.detalle) && esTexto(e.creado_en));
  if (!buenas) throw new ErrorAdmin('desconocido');
  return lista as EntradaAuditoria[];
}

const todosNumerosEn = (o: Record<string, unknown>, claves: string[]) => claves.every((k) => esNumero(o[k]));
const todosNumeros = (o: unknown, claves: string[]) => esObjeto(o) && todosNumerosEn(o, claves);

/** Dinero y cifras: una forma rota es un fallo, nunca ceros ni montos inventados. */
function leerIngresos(d: unknown): IngresosAdmin {
  if (!esObjeto(d)) throw new ErrorAdmin('desconocido');
  const buenos =
    Array.isArray(d.por_semana) && d.por_semana.every((w) => esObjeto(w) && esTexto(w.semana) && todosNumerosEn(w, ['mercadopago_centavos', 'simulado_centavos'])) &&
    todosNumeros(d.ingresos_30d, ['mercadopago_centavos', 'simulado_centavos', 'pagos_mercadopago', 'pagos_simulados']) &&
    todosNumeros(d.suscripciones, ['activas', 'en_prueba', 'vencidas', 'por_vencer_7d']) &&
    Array.isArray(d.por_plan) &&
    d.por_plan.every((p) => esObjeto(p) && esTexto(p.plan_id) && esTexto(p.nombre) && esTexto(p.rol) && todosNumerosEn(p, ['activas', 'mercadopago_30d_centavos', 'simulado_30d_centavos'])) &&
    todosNumeros(d.ordenes_30d, ['creada', 'pendiente', 'pagada', 'rechazada']) &&
    Array.isArray(d.ultimos_pagos) &&
    d.ultimos_pagos.every(
      (u) => esObjeto(u) && esTexto(u.creado_en) && (u.origen === 'mercadopago' || u.origen === 'simulado') && esTexto(u.plan) && esNumero(u.monto_centavos) && textoONulo(u.usuario),
    );
  if (!buenos) throw new ErrorAdmin('desconocido');
  return d as unknown as IngresosAdmin;
}

const numeroONulo = (v: unknown): v is number | null => v === null || esNumero(v);
const booleanoONulo = (v: unknown): v is boolean | null => v === null || typeof v === 'boolean';

/** Salud: una forma rota es un fallo. Nunca se pinta «todo bien» por no poder leer la respuesta. */
function leerSalud(d: unknown): SaludAdmin {
  const ia = esObjeto(d) ? d.ia : undefined;
  const mp = esObjeto(d) ? d.mercadopago : undefined;
  const buena =
    esObjeto(ia) && ['sin_configurar', 'caido', 'cargando', 'ok'].includes(ia.estado as string) && numeroONulo(ia.latencia_ms) && booleanoONulo(ia.api_llm_configurada) &&
    textoONulo(ia.commit) && esObjeto(mp) && typeof mp.configurado === 'boolean';
  if (!buena) throw new ErrorAdmin('desconocido');
  return d as unknown as SaludAdmin;
}

function leerEventosPago(d: unknown): EventosPagoAdmin {
  const buena =
    esObjeto(d) && esNumero(d.total_24h) && esNumero(d.alertas_24h) && Array.isArray(d.eventos) &&
    d.eventos.every((e) => esObjeto(e) && esTexto(e.recibido_en) && esTexto(e.etiqueta) && (e.nivel === 'info' || e.nivel === 'alerta') && esNumero(e.status) && textoONulo(e.pago_id));
  if (!buena) throw new ErrorAdmin('desconocido');
  return d as unknown as EventosPagoAdmin;
}

function leerErrores(lista: unknown): ErrorRegistrado[] {
  const buenas =
    Array.isArray(lista) &&
    lista.every(
      (e) =>
        esObjeto(e) && esTexto(e.id) && (e.nivel === 'aviso' || e.nivel === 'error') && esTexto(e.mensaje) && textoONulo(e.detalle) && esTexto(e.version_app) &&
        esTexto(e.plataforma) && esNumero(e.conteo) && esTexto(e.primera_vez) && esTexto(e.ultima_vez),
    );
  if (!buenas) throw new ErrorAdmin('desconocido');
  return lista as ErrorRegistrado[];
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

export function crearApi(cliente: ClienteAdmin, opciones: { origenArchivos?: string } = {}) {
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
    async resumenDetalle(): Promise<DetalleAdmin> {
      const d = await llamar({ accion: 'resumen_detalle' });
      return leerDetalle(d.detalle);
    },
    async verificaciones(): Promise<VerificacionPendiente[]> {
      return leerVerificaciones((await llamar({ accion: 'verificaciones' })).verificaciones);
    },
    /** Pide los enlaces (10 min) a la evidencia. El servidor deja registrado que se miraron. */
    async documentos(usuarioId: string, rol: Rol): Promise<DocumentoAdmin[]> {
      return leerDocumentos((await llamar({ accion: 'documentos', usuario_id: usuarioId, rol })).documentos, opciones.origenArchivos);
    },
    async resolver(usuarioId: string, rol: Rol, aprobar: boolean, motivo: string | null): Promise<void> {
      await llamar({ accion: 'resolver', usuario_id: usuarioId, rol, aprobar, motivo });
    },
    async moderacion(): Promise<ItemModeracion[]> {
      return leerModeracion((await llamar({ accion: 'moderacion' })).moderacion);
    },
    async moderar(tipo: 'resena' | 'negocio', id: string, ocultar: boolean, motivo: string | null): Promise<void> {
      await llamar({ accion: 'moderar', tipo, id, ocultar, motivo });
    },
    async ingresos(): Promise<IngresosAdmin> {
      return leerIngresos((await llamar({ accion: 'ingresos' })).ingresos);
    },
    async salud(): Promise<SaludAdmin> {
      return leerSalud((await llamar({ accion: 'salud' })).salud);
    },
    async eventosPago(): Promise<EventosPagoAdmin> {
      return leerEventosPago((await llamar({ accion: 'eventos_pago' })).eventos_pago);
    },
    async errores(): Promise<ErrorRegistrado[]> {
      return leerErrores((await llamar({ accion: 'errores' })).errores);
    },
    async borrarError(id: string): Promise<void> {
      await llamar({ accion: 'borrar_error', id });
    },
    /** Enciende o apaga los pagos simulados de TODAS las cuentas. Devuelve el estado que dejó el servidor, no el pedido. */
    async modoDemo(activo: boolean): Promise<boolean> {
      const d = await llamar({ accion: 'modo_demo', activo });
      if (typeof d.modo_demo !== 'boolean') throw new ErrorAdmin('desconocido');
      return d.modo_demo;
    },
    async auditoria(): Promise<EntradaAuditoria[]> {
      return leerAuditoria((await llamar({ accion: 'auditoria' })).auditoria);
    },
  };
}

export type ApiAdmin = ReturnType<typeof crearApi>;
