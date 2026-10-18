import { CorazonFavorito } from '@/components/CorazonFavorito';
import { useAlternarFavoritoNegocio, useMisNegociosFavoritosIds } from '@/hooks/queries/useFavoritosNegocios';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

/** El corazón de Favoritos de un NEGOCIO · 0073. Misma conducta que `BotonFavorito`. */
export function BotonFavoritoNegocio({ negocioId }: { negocioId: string }) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { ids, cargando } = useMisNegociosFavoritosIds(miId);
  const alternar = useAlternarFavoritoNegocio(miId);

  if (!miId) return null;
  const guardado = ids.has(negocioId);

  return (
    <CorazonFavorito
      guardado={guardado}
      cargando={cargando}
      onAlternar={() =>
        alternar.mutate(
          { negocioId, guardar: !guardado },
          {
            onError: (e) =>
              toast.error(
                esCodigo(e, CP.FAVORITOS_LLENOS)
                  ? 'Llegaste al tope de 200 favoritos. Quita alguno para guardar otro.'
                  : 'No pudimos actualizar tus favoritos. Revisa tu conexión e intenta de nuevo.'
              ),
          }
        )
      }
    />
  );
}
