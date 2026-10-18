import { CorazonFavorito } from '@/components/CorazonFavorito';
import { useAlternarFavorito, useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

/** El corazón de Favoritos de una PUBLICACIÓN · Cuervo 360. Sin sesión no pinta nada; si el servidor falla, la actualización optimista vuelve. */
export function BotonFavorito({ publicacionId }: { publicacionId: string }) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { ids, cargando } = useMisFavoritosIds(miId);
  const alternar = useAlternarFavorito(miId);

  if (!miId) return null;
  const guardado = ids.has(publicacionId);

  return (
    <CorazonFavorito
      guardado={guardado}
      cargando={cargando}
      onAlternar={() =>
        alternar.mutate(
          { publicacionId, guardar: !guardado },
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
