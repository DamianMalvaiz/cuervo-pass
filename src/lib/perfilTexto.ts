// Arma una descripción en texto plano del perfil, para generar su embedding
// (sección 15) — combina los datos estructurados (siempre disponibles) con el
// texto libre (opcional) si la persona lo escribió, así todos los usuarios
// tienen un perfil_vector útil, no solo quienes llenaron el campo libre.
export function construirTextoPerfil(datos: {
  universidad?: string | null;
  presupuestoMin?: number | null;
  presupuestoMax?: number | null;
  mascotas: boolean;
  fuma: boolean;
  textoLibre?: string;
}): string {
  const partes: string[] = [];
  if (datos.universidad) partes.push(`Estudia en ${datos.universidad}.`);
  if (datos.presupuestoMin != null && datos.presupuestoMax != null) {
    partes.push(`Presupuesto de $${datos.presupuestoMin} a $${datos.presupuestoMax} pesos al mes.`);
  }
  partes.push(datos.mascotas ? 'Tiene mascota.' : 'No tiene mascota.');
  partes.push(datos.fuma ? 'Fuma.' : 'No fuma.');
  if (datos.textoLibre) partes.push(datos.textoLibre);
  return partes.join(' ');
}
