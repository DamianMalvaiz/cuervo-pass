import { useAlternarFavorito, useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { useAlternarFavoritoNegocio, useMisNegociosFavoritosIds } from '@/hooks/queries/useFavoritosNegocios';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

function avisarFallo(e: unknown) {
  toast.error(esCodigo(e, CP.FAVORITOS_LLENOS) ? 'Llegaste al tope de 200 favoritos. Quita alguno para guardar otro.' : 'No pudimos actualizar tus favoritos. Revisa tu conexión e intenta de nuevo.');
}

/**
 * El estado de «guardado» de una vivienda o de un negocio para la cuenta con sesión, y cómo alternarlo. Sin sesión `hayCuenta` es false y no se consulta nada. Mientras no se sabe qué hay guardado
 * `cargando` es true: tocar sin saber el estado guardaría lo que ya estaba o quitaría lo que nunca estuvo. El fallo al guardar se dice con un aviso (nunca se finge que se guardó).
 * Se llaman los dos pares de hooks siempre (reglas de hooks) y el que no toca recibe `undefined` como cuenta, con lo que su consulta queda apagada.
 */
export function useGuardado(tipo: 'publicacion' | 'negocio', id: string) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const pub = useMisFavoritosIds(tipo === 'publicacion' ? miId : undefined);
  const neg = useMisNegociosFavoritosIds(tipo === 'negocio' ? miId : undefined);
  const alternarPub = useAlternarFavorito(miId);
  const alternarNeg = useAlternarFavoritoNegocio(miId);
  const estado = tipo === 'publicacion' ? pub : neg;
  const guardado = estado.ids.has(id);
  const alternar = () =>
    tipo === 'publicacion'
      ? alternarPub.mutate({ publicacionId: id, guardar: !guardado }, { onError: avisarFallo })
      : alternarNeg.mutate({ negocioId: id, guardar: !guardado }, { onError: avisarFallo });
  return { guardado, cargando: estado.cargando, alternar };
}
