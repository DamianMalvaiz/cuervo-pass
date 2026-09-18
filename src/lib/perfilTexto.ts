// Arma una descripción en texto plano del perfil, para generar su embedding
// (§18) — combina los datos estructurados (siempre disponibles) con el texto
// libre (opcional) si la persona lo escribió, así todos los usuarios que
// consintieron el análisis tienen un perfil_vector útil, no solo quienes
// llenaron el campo libre.

const DESCRIPCION_RUIDO: Record<'bajo' | 'medio' | 'alto', string> = {
  bajo: 'Prefiere el silencio y la tranquilidad en casa.',
  medio: 'Tolera el ruido normal de convivencia.',
  alto: 'Le gusta un ambiente animado, con visitas seguido.',
};

export function construirTextoPerfil(datos: {
  universidad?: string | null;
  presupuestoMin?: number | null;
  presupuestoMax?: number | null;
  mascotas: boolean;
  fuma: boolean;
  nivelRuido?: 'bajo' | 'medio' | 'alto' | null;
  textoLibre?: string;
}): string {
  const partes: string[] = [];
  if (datos.universidad) partes.push(`Estudia en ${datos.universidad}.`);
  if (datos.presupuestoMin != null && datos.presupuestoMax != null) {
    partes.push(`Presupuesto de $${datos.presupuestoMin} a $${datos.presupuestoMax} pesos al mes.`);
  }
  partes.push(datos.mascotas ? 'Tiene mascota.' : 'No tiene mascota.');
  partes.push(datos.fuma ? 'Fuma.' : 'No fuma.');
  // El nivel de ruido en prosa, no como etiqueta suelta: el modelo multilingüe
  // compara significado, y "bajo" a secas no significa nada fuera de contexto.
  if (datos.nivelRuido) partes.push(DESCRIPCION_RUIDO[datos.nivelRuido]);
  if (datos.textoLibre) partes.push(datos.textoLibre);
  return partes.join(' ');
}
