// Decisiones de `verificar-rostro` sin efectos ni dependencias, para probarlas con jest
// (test-utils/__tests__/verificar-rostro-politica.test.ts). Aquí no hay `Deno`, ni red, ni Supabase.

export const MAX_INTENTOS = 5;
/** Tope de la selfie en base64 (~4 MB decodificados). El servicio de IA repite el tope sobre los bytes. */
export const MAX_SELFIE_B64 = 5_600_000;

export type Rol = 'comerciante' | 'arrendador';

export type CuerpoValido =
  | { ok: true; rol: Rol; selfie: string; versionAviso: string }
  | { ok: false; codigo: 'cuerpo_invalido' | 'sin_consentimiento' | 'rol_invalido' | 'aviso_invalido' | 'selfie_invalida' };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function validarCuerpo(c: unknown): CuerpoValido {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, codigo: 'cuerpo_invalido' };
  const { rol, selfie, consentimiento, version_aviso } = c as Record<string, unknown>;

  // El consentimiento biométrico es EXPRESO y APARTE: solo `true` exacto. Un «truthy» (1, 'true') no cuenta.
  if (consentimiento !== true) return { ok: false, codigo: 'sin_consentimiento' };
  if (rol !== 'comerciante' && rol !== 'arrendador') return { ok: false, codigo: 'rol_invalido' };
  if (typeof version_aviso !== 'string' || version_aviso.trim() === '' || version_aviso.length > 20) {
    return { ok: false, codigo: 'aviso_invalido' };
  }
  if (typeof selfie !== 'string' || selfie.length === 0 || selfie.length > MAX_SELFIE_B64 || selfie.length % 4 !== 0 || !BASE64.test(selfie)) {
    return { ok: false, codigo: 'selfie_invalida' };
  }
  return { ok: true, rol, selfie, versionAviso: version_aviso.trim() };
}

/**
 * Lo ÚNICO que la persona se entera del resultado. Ni identidad, ni puntaje, ni la causa: «no es la misma persona» y «no es una
 * cara viva» se ven igual, porque distinguirlas le diría a quien intenta suplantar qué parte del ataque corregir.
 * Un estado que el servicio no declara devuelve null → la función lo trata como error, nunca como éxito.
 */
export function respuestaParaLaPersona(
  estado: unknown,
  intentosUsados: number,
): { resultado: 'recibida' | 'repetir'; intentos_restantes: number } | null {
  const restantes = Math.max(0, MAX_INTENTOS - intentosUsados);
  if (estado === 'repetir_selfie') return { resultado: 'repetir', intentos_restantes: restantes };
  if (estado === 'coincide' || estado === 'no_coincide' || estado === 'no_vivo' || estado === 'sin_rostro_ine') {
    return { resultado: 'recibida', intentos_restantes: restantes };
  }
  return null;
}

/** La INE (frente) a comparar: solo de la propia carpeta y solo si aún no se borró (30 días tras aprobar). */
export function rutaDeIneFrente(fila: { usuario_id: string; ine_frente: string; ine_borrada_en: string | null }): string | null {
  if (fila.ine_borrada_en) return null;
  const r = fila.ine_frente;
  if (typeof r !== 'string' || !r.startsWith(`${fila.usuario_id}/`) || r.includes('..')) return null;
  return r;
}
