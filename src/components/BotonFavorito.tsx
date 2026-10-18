import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAlternarFavorito, useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toque } from '@/lib/tacto';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * El corazón de Favoritos · Cuervo 360.
 *
 * Responde al instante (actualización optimista) y, si el servidor falla, vuelve. No alterna A
 * CIEGAS: mientras no sabe qué hay guardado está desactivado, porque tocar sin saber el estado
 * guardaría lo que ya estaba o quitaría lo que nunca estuvo. Sin sesión no pinta nada.
 *
 * El estado no depende solo del color: cambia el glifo (lleno o contorno), la etiqueta que lee el
 * lector de pantalla y el estado `selected`. El brinco al guardar respeta «reducir movimiento».
 */
export function BotonFavorito({ publicacionId }: { publicacionId: string }) {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { ids, cargando } = useMisFavoritosIds(miId);
  const alternar = useAlternarFavorito(miId);
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));

  if (!miId) return null;

  const guardado = ids.has(publicacionId);

  const onPress = () => {
    if (cargando) return;
    toque();
    if (!guardado && !reducido) {
      // Salta al tamaño grande y vuelve con un resorte: un brinco corto, sin secuencias.
      escala.set(1.3);
      escala.set(withSpring(1));
    }
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
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      accessibilityState={{ selected: guardado, disabled: cargando }}
      style={estilos.boton}
    >
      <Animated.View style={animado}>
        <Ionicons
          name={guardado ? 'heart' : 'heart-outline'}
          size={24}
          color={guardado ? theme.bosque : theme.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
