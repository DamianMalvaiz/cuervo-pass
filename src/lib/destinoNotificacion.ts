// A dónde lleva tocar un aviso (0072). El `destino` lo escribe la base como «clase:id». La app NO sigue lo que no conoce: una clase
// desconocida, un id con caracteres raros o un rol inválido dan `null` (el aviso solo se marca como leído) y nunca una ruta inventada.

export type RutaDeAviso =
  | { pathname: '/negocio/[id]'; params: { id: string } }
  | { pathname: '/publicacion/[id]'; params: { id: string } }
  | { pathname: '/verificacion/[rol]'; params: { rol: 'comerciante' | 'arrendador' } };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function rutaDeDestino(destino: string | null | undefined): RutaDeAviso | null {
  if (!destino) return null;
  const corte = destino.indexOf(':');
  if (corte < 1) return null;
  const clase = destino.slice(0, corte);
  const valor = destino.slice(corte + 1);
  if (!ID.test(valor)) return null;
  if (clase === 'negocio') return { pathname: '/negocio/[id]', params: { id: valor } };
  if (clase === 'publicacion') return { pathname: '/publicacion/[id]', params: { id: valor } };
  if (clase === 'verificacion' && (valor === 'comerciante' || valor === 'arrendador')) {
    return { pathname: '/verificacion/[rol]', params: { rol: valor } };
  }
  return null;
}
