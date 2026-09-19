/**
 * La dirección viaja como UNA cadena y se edita en OCHO campos.
 *
 * La base guarda `publicaciones.direccion` como texto —así lo espera el
 * geocodificador y así lo muestran las fichas— pero el formulario la pide por
 * partes, porque "escribe tu dirección" en un solo campo produce texto que
 * Nominatim no sabe interpretar.
 *
 * Esa asimetría tenía un agujero: al EDITAR una publicación existente solo se
 * pasaba la cadena completa, y los ocho campos del formulario nacían vacíos.
 * Como siete de ellos son obligatorios, la validación fallaba y no se podía
 * guardar ningún cambio sin volver a teclear la dirección entera. Cambiar una
 * foto, corregir el precio o ajustar el título eran imposibles.
 *
 * `partirDireccion` invierte `armarDireccion`. No es un analizador de
 * direcciones en general —eso no se puede hacer bien— sino el inverso exacto
 * del formato que esta app produce. Si el texto no encaja, devuelve null y el
 * llamador decide: aquí se prefieren campos vacíos y un aviso visible antes que
 * partes adivinadas mal.
 */

export interface PartesDireccion {
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  colonia: string;
  localidad: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
}

/** `Calle Zapata 224 Int. 3, Guadalupe, San Mateo Atenco, Lerma, México, CP 52044` */
export function armarDireccion(p: {
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  colonia: string;
  localidad: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
}): string {
  const numero = p.numeroInterior ? `${p.numeroExterior} Int. ${p.numeroInterior}` : p.numeroExterior;
  return `${p.calle} ${numero}, ${p.colonia}, ${p.localidad}, ${p.municipio}, ${p.estado}, CP ${p.codigoPostal}`;
}

export function partirDireccion(direccion: string | null | undefined): PartesDireccion | null {
  if (!direccion) return null;

  const trozos = direccion.split(',').map((t) => t.trim());

  // Seis trozos es el formato que produce `armarDireccion`. Cinco es el de las
  // publicaciones anteriores y las sembradas, que no llevaban localidad: ahí se
  // usa el municipio como localidad, que es lo que de hecho ocurre en la mayoría
  // de los municipios del Estado de México y lo que el propio formulario acaba
  // guardando cuando el usuario repite el nombre. Sin este caso, editar seguiría
  // roto para las ciento seis publicaciones que ya existen.
  let calleYNumero: string, colonia: string, localidad: string, municipio: string, estado: string, cpCrudo: string;
  if (trozos.length === 6) {
    [calleYNumero, colonia, localidad, municipio, estado, cpCrudo] = trozos;
  } else if (trozos.length === 5) {
    [calleYNumero, colonia, municipio, estado, cpCrudo] = trozos;
    localidad = municipio;
  } else {
    return null;
  }

  const cp = /^CP\s*(\d{5})$/i.exec(cpCrudo);
  if (!cp) return null;

  // El número interior, si lo hay, va marcado: "224 Int. 3".
  let resto = calleYNumero;
  let numeroInterior: string | undefined;
  const interior = /\s+Int\.\s*(\S+)$/i.exec(resto);
  if (interior) {
    numeroInterior = interior[1];
    resto = resto.slice(0, interior.index).trim();
  }

  // El número exterior es el ÚLTIMO token. Se parte por el último espacio y no
  // por el primero porque las calles llevan espacios ("Av. Solidaridad 210") y
  // los números casi nunca.
  const corte = resto.lastIndexOf(' ');
  if (corte <= 0) return null;

  const calle = resto.slice(0, corte).trim();
  const numeroExterior = resto.slice(corte + 1).trim();
  if (!calle || !numeroExterior) return null;

  if (!colonia || !localidad || !municipio || !estado) return null;

  return { calle, numeroExterior, numeroInterior, colonia, localidad, municipio, estado, codigoPostal: cp[1] };
}
