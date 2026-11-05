const PANTALLAS_DE_ACCESO = ['login', 'registro', 'recuperar-contrasena'];
const ANCHO_MINIMO_PANEL = 1000;

/** Si las pantallas de acceso llevan el panel de marca a la izquierda: solo en la web ancha y solo en las tres que usa quien aún no entra. */
export function conPanelDeAcceso({ plataforma, ancho, segmentos }: { plataforma: string; ancho: number; segmentos: string[] }): boolean {
  return plataforma === 'web' && ancho >= ANCHO_MINIMO_PANEL && PANTALLAS_DE_ACCESO.includes(segmentos[segmentos.length - 1] ?? '');
}
