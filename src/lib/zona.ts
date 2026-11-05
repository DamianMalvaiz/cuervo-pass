/** La zona de una tarjeta o ficha pública: colonia y municipio (los dos primeros tramos), sin el estado ni el código postal. `null` si no hay nada que decir. */
export function zonaCorta(zona: string | null | undefined): string | null {
  const partes = (zona ?? '').split(',').map((p) => p.trim()).filter((p) => p && !/^CP\s*\d+$/i.test(p));
  return partes.length > 0 ? partes.slice(0, 2).join(', ') : null;
}

/**
 * La segunda línea de una tarjeta de vivienda. El título público ya trae la colonia («Cuarto en Santa María»), así que repetirla ahí era ruido: se dice el municipio y, a su lado, lo que el título no dice
 * (recámaras y si está amueblado). Si el título NO nombra la colonia, se dice la zona completa. `null` si no hay nada que decir.
 */
export function subtituloTarjeta(p: { titulo_publico: string; zona: string | null; recamaras: number | null; amueblado: boolean | null }): string | null {
  const zona = zonaCorta(p.zona);
  const [colonia, municipio] = zona ? zona.split(', ') : [];
  const lugar = !zona ? null : municipio && p.titulo_publico.toLowerCase().includes(colonia.toLowerCase()) ? municipio : zona;
  const detalles = [p.recamaras ? `${p.recamaras} ${p.recamaras === 1 ? 'recámara' : 'recámaras'}` : null, p.amueblado ? 'Amueblado' : null];
  const partes = [lugar, ...detalles].filter((x): x is string => Boolean(x));
  return partes.length > 0 ? partes.join(' · ') : null;
}

/**
 * Espejo en JS de `zona_aproximada()` de la base (0090): lo que queda de una dirección sin su primer tramo (calle y número). Una dirección sin comas no tiene zona que decir: no se enseña la calle.
 * Sirve para la vista previa de lo que verá quien explora sin cuenta; la verdad es la de la base.
 */
export function zonaAproximadaDe(direccion: string | null | undefined): string | null {
  const d = direccion ?? '';
  if (!d.includes(',')) return null;
  const resto = d.replace(/^[^,]*,/, '').trim();
  return resto === '' || resto === ',' ? null : resto;
}
