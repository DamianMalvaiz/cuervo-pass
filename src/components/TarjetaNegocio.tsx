import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Estrellas } from '@/components/ficha/Estrellas';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { AltoFotoTarjeta, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { FotoLista } from '@/components/FotoLista';
import type { FuenteFoto } from '@/lib/miniaturas';
import { useTheme } from '@/hooks/use-theme';
import type { Negocio } from '@/types/database.types';

/** «$», «$$» o «$$$». Sin dato no se inventa uno. */
export const signosDePrecio = (rango: number | null): string | null =>
  rango != null && rango >= 1 && rango <= 3 ? '$'.repeat(rango) : null;

/**
 * Un negocio de Servicios · Cuervo 360. Dos formas: `fila` (foto cuadrada a la izquierda, para la lista) y `destacado`
 * (foto ancha arriba, para el carril). Un negocio sembrado se rotula «Negocio de ejemplo»: es inventado y no se
 * presenta como real.
 */
export function TarjetaNegocio({
  negocio,
  fotoUrl,
  fotoMini,
  forma = 'fila',
  onPress,
}: {
  negocio: Negocio;
  fotoUrl?: string | null;
  /** La miniatura (lib/miniaturas.ts); si falla, se usa `fotoUrl`. */
  fotoMini?: FuenteFoto | null;
  forma?: 'fila' | 'destacado';
  onPress: () => void;
}) {
  const theme = useTheme();
  const precio = signosDePrecio(negocio.rango_precio);
  const ejemplo = negocio.origen === 'sembrado';
  // «a 1.2 km»: lo que de verdad le sirve a quien busca; el puntaje del ranking NO se enseña.
  const distancia = negocio.distancia_km != null && Number.isFinite(negocio.distancia_km) ? `a ${negocio.distancia_km.toFixed(1)} km` : null;
  const detalle = [distancia, negocio.horario, precio].filter(Boolean).join(' · ');

  const foto = fotoUrl || fotoMini ? (
    <FotoLista miniatura={fotoMini} completa={fotoUrl} style={forma === 'fila' ? estilos.fotoFila : estilos.fotoDestacado} />
  ) : (
    <View
      style={[forma === 'fila' ? estilos.fotoFila : estilos.fotoDestacado, estilos.sinFoto, { backgroundColor: theme.backgroundSelected }]}
      accessibilityLabel="Sin fotografía"
    >
      <Ionicons name="storefront-outline" size={24} color={theme.textSecondary} />
    </View>
  );

  const textos = (
    <View style={estilos.textos}>
      <ThemedText numberOfLines={1} style={[Texto.cuerpo, Texto.pesoFuerte]}>
        {negocio.nombre}
      </ThemedText>
      {detalle ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detalle}
        </ThemedText>
      ) : null}
      <Estrellas calificacion={negocio.calificacion} numResenas={negocio.num_resenas ?? 0} compacta />
      {ejemplo ? (
        <ThemedText type="small" themeColor="textSecondary">
          Negocio de ejemplo
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${negocio.nombre}${detalle ? '. ' + detalle : ''}${ejemplo ? '. Negocio de ejemplo' : ''}`}
      style={
        forma === 'fila'
          ? [estilos.fila, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]
          : estilos.destacado
      }
    >
      {foto}
      {forma === 'destacado' && negocio.destacado ? (
        <View style={[estilos.insignia, { backgroundColor: theme.lima }]}>
          <ThemedText type="smallBold" style={{ color: theme.limaTexto }}>
            Destacado
          </ThemedText>
        </View>
      ) : null}
      {textos}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.tarjeta,
  },
  fotoFila: { width: 72, height: 72, borderRadius: Radios.control },
  destacado: { width: 220, gap: Spacing.two },
  fotoDestacado: { width: 220, height: AltoFotoTarjeta * 0.6, borderRadius: Radios.tarjeta },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: Spacing.half },
  insignia: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
});
