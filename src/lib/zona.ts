/** La zona de una tarjeta o ficha pública: colonia y municipio (los dos primeros tramos), sin el estado ni el código postal. `null` si no hay nada que decir. */
export function zonaCorta(zona: string | null | undefined): string | null {
  const partes = (zona ?? '').split(',').map((p) => p.trim()).filter((p) => p && !/^CP\s*\d+$/i.test(p));
  return partes.length > 0 ? partes.slice(0, 2).join(', ') : null;
}
