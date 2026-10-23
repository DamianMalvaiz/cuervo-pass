// Decisiones de `admin` sin efectos ni dependencias, para probarlas con jest (test-utils/__tests__/admin-politica.test.ts).
// Aquí no hay `Deno`, ni red, ni Supabase.

export type Rol = 'comerciante' | 'arrendador';

export type Solicitud =
  | { accion: 'resumen' }
  | { accion: 'resumen_detalle' }
  | { accion: 'verificaciones' }
  | { accion: 'moderacion' }
  | { accion: 'errores' }
  | { accion: 'auditoria' }
  | { accion: 'ingresos' }
  | { accion: 'salud' }
  | { accion: 'eventos_pago' }
  | { accion: 'borrar_error'; id: string }
  | { accion: 'documentos'; usuarioId: string; rol: Rol }
  | { accion: 'resolver'; usuarioId: string; rol: Rol; aprobar: boolean; motivo: string | null }
  | { accion: 'moderar'; tipo: 'resena' | 'negocio'; id: string; ocultar: boolean; motivo: string | null }
  | { accion: 'modo_demo'; activo: boolean };

export type Validacion =
  | { ok: true; solicitud: Solicitud }
  | { ok: false; codigo: 'cuerpo_invalido' | 'accion_invalida' | 'datos_invalidos' | 'motivo_requerido' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MOTIVO = 400;

const esRol = (r: unknown): r is Rol => r === 'comerciante' || r === 'arrendador';
const esUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** `null` = sin motivo; `undefined` = el motivo tiene forma inválida (no es texto o es demasiado largo). */
function motivoDe(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.length > MAX_MOTIVO) return undefined;
  return t === '' ? null : t;
}

/**
 * Valida el cuerpo ANTES de tocar nada. Acciones cerradas, ids con forma de uuid y textos acotados: el servicio ejecuta con la llave de
 * servicio, así que lo que no se reconoce exactamente no se ejecuta. El id de quien actúa NUNCA viene del cuerpo (sale de la sesión).
 */
export function validarSolicitud(c: unknown): Validacion {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, codigo: 'cuerpo_invalido' };
  const d = c as Record<string, unknown>;

  switch (d.accion) {
    case 'resumen':
    case 'resumen_detalle':
    case 'verificaciones':
    case 'moderacion':
    case 'errores':
    case 'auditoria':
    case 'ingresos':
    case 'salud':
    case 'eventos_pago':
      return { ok: true, solicitud: { accion: d.accion } };

    case 'borrar_error':
      if (!esUuid(d.id)) return { ok: false, codigo: 'datos_invalidos' };
      return { ok: true, solicitud: { accion: 'borrar_error', id: d.id } };

    case 'documentos':
      if (!esUuid(d.usuario_id) || !esRol(d.rol)) return { ok: false, codigo: 'datos_invalidos' };
      return { ok: true, solicitud: { accion: 'documentos', usuarioId: d.usuario_id, rol: d.rol } };

    case 'resolver': {
      if (!esUuid(d.usuario_id) || !esRol(d.rol) || typeof d.aprobar !== 'boolean') return { ok: false, codigo: 'datos_invalidos' };
      const motivo = motivoDe(d.motivo);
      if (motivo === undefined) return { ok: false, codigo: 'datos_invalidos' };
      if (!d.aprobar && (motivo === null || motivo.length < 3)) return { ok: false, codigo: 'motivo_requerido' };
      return { ok: true, solicitud: { accion: 'resolver', usuarioId: d.usuario_id, rol: d.rol, aprobar: d.aprobar, motivo } };
    }

    case 'moderar': {
      if ((d.tipo !== 'resena' && d.tipo !== 'negocio') || !esUuid(d.id) || typeof d.ocultar !== 'boolean') {
        return { ok: false, codigo: 'datos_invalidos' };
      }
      const motivo = motivoDe(d.motivo);
      if (motivo === undefined) return { ok: false, codigo: 'datos_invalidos' };
      if (d.ocultar && (motivo === null || motivo.length < 3)) return { ok: false, codigo: 'motivo_requerido' };
      return { ok: true, solicitud: { accion: 'moderar', tipo: d.tipo, id: d.id, ocultar: d.ocultar, motivo } };
    }

    case 'modo_demo':
      if (typeof d.activo !== 'boolean') return { ok: false, codigo: 'datos_invalidos' };
      return { ok: true, solicitud: { accion: 'modo_demo', activo: d.activo } };

    default:
      return { ok: false, codigo: 'accion_invalida' };
  }
}

export interface FilaDocumentos {
  usuario_id: string;
  ine_frente: string;
  ine_reverso: string;
  fotos: string[];
  ine_borrada_en: string | null;
}

/**
 * Las rutas que se pueden firmar para mirar, solo de la carpeta de la propia persona (`<usuario_id>/…`, sin «..»). Con la INE ya
 * borrada (30 o 7 días) no se ofrece la INE: el archivo ya no existe y ofrecerla sería firmar un enlace roto.
 */
export function rutasDeDocumentos(fila: FilaDocumentos): { etiqueta: string; ruta: string }[] {
  const prefijo = `${fila.usuario_id}/`;
  const segura = (r: unknown): r is string => typeof r === 'string' && r.startsWith(prefijo) && !r.includes('..');
  const salida: { etiqueta: string; ruta: string }[] = [];
  if (!fila.ine_borrada_en) {
    if (segura(fila.ine_frente)) salida.push({ etiqueta: 'INE (frente)', ruta: fila.ine_frente });
    if (segura(fila.ine_reverso)) salida.push({ etiqueta: 'INE (reverso)', ruta: fila.ine_reverso });
  }
  (fila.fotos ?? []).forEach((f, i) => {
    if (segura(f)) salida.push({ etiqueta: `Foto ${i + 1}`, ruta: f });
  });
  return salida;
}

// ── Salud del servicio de IA ────────────────────────────────────────────────

export type MedidaSaludIa =
  | { configurado: false }
  | { configurado: true; fallo: 'red' | 'timeout' }
  | { configurado: true; status: number; cuerpo: unknown; latenciaMs: number };

export interface SaludIa {
  estado: 'sin_configurar' | 'caido' | 'cargando' | 'ok';
  latencia_ms: number | null;
  api_llm_configurada: boolean | null;
  /** Los 7 primeros caracteres del commit con el que arrancó el servicio, o `null` si no tiene forma de commit. */
  commit: string | null;
}

const COMMIT = /^[0-9a-f]{7,40}$/i;

/**
 * Interpreta lo que midió `admin` contra `GET /salud` del servicio de IA. «No respondió» y «cargando» no se confunden con «ok», un 200 con el modelo sin cargar no cuenta como sano,
 * y el commit solo sale si tiene forma de commit (no se pinta texto ajeno).
 */
export function interpretarSaludIa(m: MedidaSaludIa): SaludIa {
  const caido: SaludIa = { estado: 'caido', latencia_ms: null, api_llm_configurada: null, commit: null };
  if (!m.configurado) return { estado: 'sin_configurar', latencia_ms: null, api_llm_configurada: null, commit: null };
  if ('fallo' in m) return caido;

  const cuerpo = m.cuerpo && typeof m.cuerpo === 'object' && !Array.isArray(m.cuerpo) ? (m.cuerpo as Record<string, unknown>) : null;
  if (m.status === 200 && cuerpo?.status === 'ok' && cuerpo.modelo_cargado === true) {
    return {
      estado: 'ok',
      latencia_ms: m.latenciaMs,
      api_llm_configurada: cuerpo.api_llm_configurada === true,
      commit: typeof cuerpo.commit === 'string' && COMMIT.test(cuerpo.commit) ? cuerpo.commit.slice(0, 7) : null,
    };
  }
  if (m.status === 503 && cuerpo?.status === 'cargando') return { estado: 'cargando', latencia_ms: m.latenciaMs, api_llm_configurada: null, commit: null };
  return caido;
}
