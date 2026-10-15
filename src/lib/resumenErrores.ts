// Toast resumen de la validación · paso 2.
//
// Con un pie fijo y un formulario de dieciséis campos, tocar «Publicar» con un
// campo inválido no mostraba NADA a la vista: el error sale en rojo bajo su
// campo, y el campo mal puede estar fuera de pantalla. Esto arma la frase que se
// le dice a quien tocó el botón: cuántos campos y cuáles.
//
// NO sustituye al error junto al campo: ése se queda, y debe seguir ahí mientras
// se corrige. El aviso dice DÓNDE mirar; el campo dice QUÉ está mal.

const MAXIMO_NOMBRADOS = 3;

/** «A», «A y B», «A, B y C». */
function unirConY(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * La frase del aviso, o `null` si no hay errores.
 *
 * `etiquetas` va en el orden de la PANTALLA, y de ahí sale el orden de la frase:
 * el orden del objeto de errores es el de validación, que no es el que se ve.
 *
 * Un campo con error y SIN etiqueta se cuenta aunque no se pueda nombrar. Dejarlo
 * fuera diría «revisa 1 campo» habiendo dos, que es esconder un fallo. Cada
 * formulario exige sus etiquetas completas con `satisfies Record<keyof Form,
 * string>`, así que esto es la red debajo de esa comprobación, no la primera.
 */
export function resumenDeErrores(
  errores: Record<string, unknown>,
  etiquetas: Record<string, string>
): string | null {
  const conError = (campo: string) => errores[campo] != null;

  const nombrados = Object.keys(etiquetas)
    .filter(conError)
    .map((campo) => etiquetas[campo]);
  const sinEtiqueta = Object.keys(errores).filter((c) => conError(c) && !(c in etiquetas)).length;

  const total = nombrados.length + sinEtiqueta;
  if (total === 0) return null;
  if (nombrados.length === 0) return `Revisa ${total} ${total === 1 ? 'campo' : 'campos'}`;

  const visibles = nombrados.slice(0, MAXIMO_NOMBRADOS);
  const restantes = total - visibles.length;
  const lista = restantes > 0 ? `${visibles.join(', ')} y ${restantes} más` : unirConY(visibles);

  return total === 1 ? `Revisa el campo: ${lista}` : `Revisa ${total} campos: ${lista}`;
}
