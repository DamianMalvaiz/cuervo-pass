/**
 * Por qué una publicación es buena para ti, en palabras · Cuervo 360.
 *
 * Hasta el 17/10/2026 la ficha enseñaba «9.4» con su fórmula desplegable (60 % filtros + 40 % afinidad). Probado
 * en un iPhone real, un número y una fórmula son lenguaje de ingeniero: no le dicen a nadie por qué mirar un depa.
 * Ahora se dicen las razones, y solo las que SE CUMPLEN con los datos de la persona y de la publicación: una razón
 * inventada es peor que ninguna. El orden de la lista sigue saliendo del motor; esto solo lo explica.
 */

export interface DatosAjuste {
  precio: number;
  presupuestoMax?: number | null;
  distanciaKm?: number | null;
  distanciaMaxKm?: number | null;
  permiteMascotas: boolean;
  tengoMascotas: boolean;
}

export function razonesDeAjuste(d: DatosAjuste): string[] {
  const razones: string[] = [];
  if (d.presupuestoMax != null && d.precio <= d.presupuestoMax) razones.push('Está dentro de tu presupuesto');
  if (d.distanciaKm != null && d.distanciaMaxKm != null && d.distanciaKm <= d.distanciaMaxKm) {
    razones.push('Queda dentro de tu distancia máxima');
  }
  if (d.tengoMascotas && d.permiteMascotas) razones.push('Acepta mascotas, como pediste');
  return razones;
}

/** El umbral es una decisión de producto y no una medida: el score es una mezcla ponderada de heurísticas, así
 *  que solo se premia lo alto y por debajo de 0.5 se calla en vez de decir «poco compatible». */
export function etiquetaDeAjuste(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 0.75) return 'Muy compatible contigo';
  if (score >= 0.5) return 'Compatible contigo';
  return null;
}
