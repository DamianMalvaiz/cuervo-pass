// Comparación en tiempo constante, por la misma razón que `hmac.compare_digest` en el microservicio (AUD-12): `a !== b` corta en el primer
// byte distinto y filtra información sobre el secreto. Se comparan bytes y no cadenas para que la longitud tampoco filtre por la vía del recorrido.
//
// Vive en `_shared` para que haya UNA copia. `barrer-fotos` y `barrer-verificaciones` todavía llevan la suya (hallazgo 6 de la auditoría del
// 23/10/2026); quien las toque puede apuntarlas aquí.
export function igualEnTiempoConstante(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Longitudes distintas no pueden ser iguales, pero se recorre igual para no devolver antes.
  const n = Math.max(ba.length, bb.length);
  let dif = ba.length ^ bb.length;
  for (let i = 0; i < n; i++) dif |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return dif === 0;
}
