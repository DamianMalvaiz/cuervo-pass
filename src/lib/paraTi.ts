// La portada de quien ya entró («Para ti»): el saludo y el nombre.

/** El saludo por la hora (0–23). La madrugada es de noche: a las 2 no se dice «buenos días». */
export function saludoDe(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** La primera palabra del nombre completo, o `null` si no hay: sin nombre no se inventa uno. */
export function primerNombre(nombreCompleto: string | null | undefined): string | null {
  const primero = nombreCompleto?.trim().split(/\s+/)[0];
  return primero ? primero : null;
}
