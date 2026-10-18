// Decisiones de `barrer-verificaciones` sin efectos ni dependencias, para probarlas con jest
// (test-utils/__tests__/barrer-verificaciones-politica.test.ts). Aquí no hay `Deno`, ni red, ni Supabase.

export interface FilaVerificacion {
  usuario_id: string;
  ine_frente: string;
  ine_reverso: string;
}

/**
 * Las rutas de la INE que se pueden borrar de esta fila. Solo se admiten las que están DENTRO de la carpeta de su
 * propia cuenta (`<usuario_id>/…`): la base ya lo exige con un CHECK, y aquí se repite porque esta función borra
 * archivos con la llave de servicio y no debe confiar en que el dato nunca se corrompa. Las fotos del local o del
 * inmueble NO se tocan: no son documentos de identidad.
 */
export function rutasDeIne(fila: FilaVerificacion): string[] {
  const prefijo = `${fila.usuario_id}/`;
  return [fila.ine_frente, fila.ine_reverso].filter(
    (r): r is string => typeof r === 'string' && r.startsWith(prefijo) && !r.includes('..'),
  );
}

/** Comparación en tiempo constante (como en `barrer-fotos`): `a !== b` corta en el primer byte distinto. */
export function igualEnTiempoConstante(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const n = Math.max(ba.length, bb.length);
  let dif = ba.length ^ bb.length;
  for (let i = 0; i < n; i++) dif |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return dif === 0;
}
