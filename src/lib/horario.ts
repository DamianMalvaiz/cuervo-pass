// Horario estructurado de los negocios · migración 0070. SIN dependencias: lo importan la app y un script de Node (scripts/horarios-sembrados.mjs), y la regla
// de «abierto ahora» vive en la base, no aquí. Este módulo solo entiende el TEXTO que ya existía, resume turnos para mostrarlos y valida antes de mandar.

export type DiaIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Un turno: día ISO (1 = lunes … 7 = domingo) y horas «HH:MM». Si `cierra` < `abre`, cruza la medianoche. */
export interface Turno {
  dia: DiaIso;
  abre: string;
  cierra: string;
}

export const MAX_TURNOS = 21;
const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Los días se escriben completos, sin abreviar: la primera palabra de un resumen va con mayúscula y las demás en minúsculas. */
const NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const NOMBRES_MINUSCULAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

/** Postgres devuelve `time` como «09:00:00»; la app trabaja con «09:00». */
export const recortarHora = (t: string): string => (/^\d{2}:\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : t);

/**
 * Lo que alguien teclea en un campo de hora → «HH:MM». Acepta «9», «09», «9:30», «930» y «0930». Si no es una hora válida
 * lo devuelve TAL CUAL (no se adivina): `validarTurnos` lo rechaza después con un mensaje claro.
 */
export function normalizarHora(texto: string): string {
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(texto.trim());
  if (!m) return texto;
  const hh = m[1].padStart(2, '0');
  const candidato = `${hh}:${m[2] ?? '00'}`;
  return HHMM.test(candidato) ? candidato : texto;
}

/** «13:05» → «1:05 pm»; «08:00» → «8 am»; «00:00» → «12 am». Lo que no es una hora se devuelve tal cual. */
export function formatearHora(hhmm: string): string {
  const m = /^([0-9]{2}):([0-9]{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  const sufijo = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === '00' ? `${h12} ${sufijo}` : `${h12}:${min} ${sufijo}`;
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const NOMBRE_A_DIA: Record<string, DiaIso> = {
  lun: 1, lunes: 1, mar: 2, martes: 2, mie: 3, miercoles: 3, jue: 4, jueves: 4, vie: 5, viernes: 5, sab: 6, sabado: 6, dom: 7, domingo: 7,
};

function a24(h: string, min: string | undefined, sufijo: string): string | null {
  const hora = Number(h);
  const minutos = min === undefined ? 0 : Number(min);
  if (!(hora >= 1 && hora <= 12) || !(minutos >= 0 && minutos <= 59)) return null;
  const h24 = (hora % 12) + (sufijo === 'pm' ? 12 : 0);
  return `${String(h24).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/** Los días de un rango, cerrando la semana en círculo: «vie a lun» = vie, sáb, dom, lun. */
function diasDeRango(desde: DiaIso, hasta: DiaIso): DiaIso[] {
  const dias: DiaIso[] = [];
  for (let d = desde; ; d = ((d % 7) + 1) as DiaIso) {
    dias.push(d);
    if (d === hasta) break;
  }
  return dias;
}

/**
 * Entiende los textos con formato regular («Lun a sáb · 8 am a 8 pm», «Todos los días · 24 horas», «Lun a vie · 10 am a 7 pm · con cita») y devuelve sus
 * turnos. Si no tiene HORAS («Lunes a Sábado»), o no se entiende, devuelve `null`: NO se inventa un horario.
 */
export function parsearHorarioTexto(texto: string | null | undefined): Turno[] | null {
  if (typeof texto !== 'string' || !texto.trim()) return null;
  const t = sinAcentos(texto);

  let dias: DiaIso[] | null = null;
  if (/todos los dias/.test(t)) dias = [1, 2, 3, 4, 5, 6, 7];
  else {
    const rango = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|lun|mar|mie|jue|vie|sab|dom)\b\s*(?:a|al|-)\s*\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|lun|mar|mie|jue|vie|sab|dom)\b/.exec(t);
    if (rango) dias = diasDeRango(NOMBRE_A_DIA[rango[1]], NOMBRE_A_DIA[rango[2]]);
    else {
      const uno = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|lun|mar|mie|jue|vie|sab|dom)\b/.exec(t);
      if (uno) dias = [NOMBRE_A_DIA[uno[1]]];
    }
  }
  if (!dias) return null;

  let abre: string | null = null;
  let cierra: string | null = null;
  if (/24\s*horas/.test(t)) {
    abre = '00:00';
    cierra = '23:59';
  } else {
    const h = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:a|al|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/.exec(t);
    if (!h) return null;
    abre = a24(h[1], h[2], h[3]);
    cierra = a24(h[4], h[5], h[6]);
  }
  if (!abre || !cierra || abre === cierra) return null;
  return dias.map((dia) => ({ dia, abre: abre as string, cierra: cierra as string }));
}

export interface GrupoDeHoras {
  dias: DiaIso[];
  horas: [string, string][];
}

/** Agrupa los días que tienen EXACTAMENTE las mismas horas, en el orden de la semana. Los turnos de un día van ordenados por apertura. */
export function agruparPorHoras(turnos: readonly Turno[]): GrupoDeHoras[] {
  const porDia = new Map<DiaIso, [string, string][]>();
  for (const t of turnos) porDia.set(t.dia, [...(porDia.get(t.dia) ?? []), [t.abre, t.cierra]]);
  for (const horas of porDia.values()) horas.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const grupos: GrupoDeHoras[] = [];
  for (const dia of ([1, 2, 3, 4, 5, 6, 7] as DiaIso[]).filter((d) => porDia.has(d))) {
    const horas = porDia.get(dia) as [string, string][];
    const clave = JSON.stringify(horas);
    const previo = grupos.find((g) => JSON.stringify(g.horas) === clave);
    if (previo) previo.dias.push(dia);
    else grupos.push({ dias: [dia], horas });
  }
  return grupos;
}

function textoDeDias(dias: DiaIso[]): string {
  if (dias.length === 7) return 'Todos los días';
  const consecutivos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  if (dias.length >= 3 && consecutivos) return `${NOMBRES[dias[0] - 1]} a ${NOMBRES_MINUSCULAS[dias[dias.length - 1] - 1]}`;
  const nombres = dias.map((d, i) => (i === 0 ? NOMBRES[d - 1] : NOMBRES_MINUSCULAS[d - 1]));
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** El texto corto que se enseña: «Lunes a sábado · 8 am a 8 pm», o varios grupos separados por «; ». Vacío si no hay turnos. */
export function resumenDeTurnos(turnos: readonly Turno[]): string {
  return agruparPorHoras(turnos)
    .map((g) => {
      const horas = g.horas.map(([a, c]) => (a === '00:00' && c === '23:59' ? '24 horas' : `${formatearHora(a)} a ${formatearHora(c)}`)).join(' y ');
      return `${textoDeDias(g.dias)} · ${horas}`;
    })
    .join('; ');
}

/** `resumenDeTurnos` que cabe en `max` caracteres (la columna `horario` admite 120): corta por grupos COMPLETOS y marca el corte con «…». */
export function resumenAcotado(turnos: readonly Turno[], max: number): string {
  const completo = resumenDeTurnos(turnos);
  if (completo.length <= max) return completo;
  const grupos = completo.split('; ');
  let r = '';
  for (const g of grupos) {
    const siguiente = r ? `${r}; ${g}` : g;
    if (siguiente.length + 1 > max) break;
    r = siguiente;
  }
  return r ? `${r}…` : '…';
}

/** El primer problema de una lista de turnos, en lenguaje de persona, o `null` si está bien. La base vuelve a validar. */
export function validarTurnos(turnos: readonly Turno[]): string | null {
  if (turnos.length > MAX_TURNOS) return `Máximo ${MAX_TURNOS} turnos`;
  for (const t of turnos) {
    if (!Number.isInteger(t.dia) || t.dia < 1 || t.dia > 7) return 'Hay un día que no existe';
    if (!HHMM.test(t.abre) || !HHMM.test(t.cierra)) return 'Revisa las horas: usa el formato 09:00';
    if (t.abre === t.cierra) return 'Abrir y cerrar a la misma hora no es un horario';
  }
  return null;
}

/**
 * El horario de un negocio es OBLIGATORIO y se llena a mano: cada uno de los siete días tiene que estar abierto (con turnos) o cerrado (marcado a propósito);
 * «sin decidir» no es un horario. Devuelve el primer problema en lenguaje de persona, o `null`. Un día con turnos cuenta como abierto aunque también esté en `cerrados`.
 */
export function validarHorarioCompleto(turnos: readonly Turno[], cerrados: readonly DiaIso[]): string | null {
  const abiertos = new Set(turnos.map((t) => t.dia));
  for (const dia of [1, 2, 3, 4, 5, 6, 7] as DiaIso[]) {
    if (!abiertos.has(dia) && !cerrados.includes(dia)) return `Te falta decidir el ${NOMBRES_MINUSCULAS[dia - 1]}.`;
  }
  if (abiertos.size === 0) return 'Tu negocio tiene que abrir al menos un día.';
  return validarTurnos(turnos);
}
