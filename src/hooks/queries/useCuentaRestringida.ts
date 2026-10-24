// ¿La cuenta está restringida? (0082)
//
// Solo decide qué se OFRECE: una cuenta sin correo universitario no ve «Reportar», «Reseñar» ni «Iniciar chat», porque la base los va a rechazar. La
// que protege es la base, no esto. Por eso, si la lectura falla o todavía no llegó, devuelve `false`: no se esconde nada por un fallo de red, y si la
// cuenta de verdad estaba restringida, la base rechaza y el mensaje lo dice (`abrirChatCon`). Es el único sitio donde «no pude saberlo» se trata como
// «no», y es válido justamente porque no concede nada.

import { useQuery } from '@tanstack/react-query';

import { obtenerCuentaRestringida } from '@/services/usuarios.service';

export const claveCuentaRestringida = (usuarioId: string | undefined) => ['cuentaRestringida', usuarioId ?? ''] as const;

export function useCuentaRestringida(usuarioId: string | undefined): boolean {
  const q = useQuery({
    queryKey: claveCuentaRestringida(usuarioId),
    queryFn: () => obtenerCuentaRestringida(usuarioId as string),
    enabled: Boolean(usuarioId),
    // La fija el servidor al dar de alta y no cambia desde la app.
    staleTime: Infinity,
  });
  return q.data === true;
}
