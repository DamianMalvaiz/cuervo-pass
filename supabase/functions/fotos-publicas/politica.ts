// Lógica pura de `fotos-publicas` (sin Deno, sin red, sin Supabase): la Edge Function solo la aplica.
//
// El almacenamiento es privado y `anon` no firma nada. Para quien explora SIN cuenta, esta función firma las fotos de lo que las vistas de explorar (0090) ya enseñan.
// El cuerpo solo dice QUÉ cosa (tipo e id); las rutas salen de las VISTAS, nunca del cliente ni de las tablas, y nunca se devuelven: llevan el id de la cuenta.

export const MAX_FOTOS = 20;
const MAX_RUTA = 300;
const MAX_URL = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUTA_SEGURA = /^[\w\-. ]+(\/[\w\-. ]+)*$/;

export type TipoFoto = 'publicacion' | 'negocio' | 'producto';
export type SolicitudFotos = { ok: true; tipo: TipoFoto; id: string } | { ok: false; error: string };
export type EntradaFoto = { tipo: 'ruta'; ruta: string } | { tipo: 'externa'; url: string };

const FUENTES: Record<TipoFoto, { vista: string; columna: string }> = {
  publicacion: { vista: 'publicaciones_publicas', columna: 'fotos' },
  negocio: { vista: 'negocios_publicos', columna: 'fotos' },
  producto: { vista: 'negocio_items_publicos', columna: 'fotos' },
};

export function validarSolicitudFotos(crudo: unknown): SolicitudFotos {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return { ok: false, error: 'cuerpo inválido' };
  const { tipo, id } = crudo as Record<string, unknown>;
  if (typeof tipo !== 'string' || !Object.prototype.hasOwnProperty.call(FUENTES, tipo)) return { ok: false, error: 'tipo inválido' };
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, error: 'id inválido' };
  return { ok: true, tipo: tipo as TipoFoto, id };
}

export function fuenteDe(tipo: TipoFoto): { vista: string; columna: string } {
  return FUENTES[tipo];
}

function esExterna(s: string): boolean {
  if (s.length > MAX_URL || !s.startsWith('https://')) return false;
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

function esRutaSegura(s: string): boolean {
  return s.length <= MAX_RUTA && RUTA_SEGURA.test(s) && !s.split('/').some((t) => t === '..' || t === '.');
}

export function separarFotos(fotos: unknown): EntradaFoto[] {
  if (!Array.isArray(fotos)) return [];
  const salida: EntradaFoto[] = [];
  for (const f of fotos) {
    if (typeof f !== 'string') continue;
    if (esExterna(f)) salida.push({ tipo: 'externa', url: f });
    else if (esRutaSegura(f)) salida.push({ tipo: 'ruta', ruta: f });
    if (salida.length >= MAX_FOTOS) break;
  }
  return salida;
}

export function armarRespuesta(entradas: EntradaFoto[], firmadas: Map<string, string>): string[] {
  const urls: string[] = [];
  for (const e of entradas) {
    const url = e.tipo === 'externa' ? e.url : firmadas.get(e.ruta);
    if (url) urls.push(url);
  }
  return urls;
}
