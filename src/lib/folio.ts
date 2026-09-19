/**
 * Folio y fecha de emisión: la identidad de un documento.
 *
 * `folioDe` estaba duplicado —una copia en la lista y otra en línea dentro de la
 * ficha de detalle— así que si una cambiaba, el folio de la lista dejaba de
 * coincidir con el de la ficha que abría. Un folio que no casa con su expediente
 * no es un folio, es ruido con forma de folio.
 */

/** Cuatro caracteres del id. Bastan para leerse como número de expediente sin
 *  volverse ruido, y son estables porque el id lo es. */
export function folioDe(id: string | null | undefined): string {
  if (!id) return '----';
  return id.replace(/-/g, '').slice(0, 4).toUpperCase();
}

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** "19 SEP 2026". Formato de sello, no de prosa. */
export function fechaDeSello(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "19 SEP 2026 · 14:32" — para la emisión de un expediente, donde la hora dice
 *  qué tan fresca es la consulta. */
export function fechaHoraDeSello(valor: Date): string {
  const hora = String(valor.getHours()).padStart(2, '0');
  const minuto = String(valor.getMinutes()).padStart(2, '0');
  return `${fechaDeSello(valor)} · ${hora}:${minuto}`;
}
