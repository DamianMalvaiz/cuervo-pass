import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { BotonFavoritoNegocio } from '@/components/BotonFavoritoNegocio';
import { Estrellas } from '@/components/ficha/Estrellas';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { AltoFotoTarjeta, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { FotoLista } from '@/components/FotoLista';
import type { FuenteFoto } from '@/lib/miniaturas';
import { useTheme } from '@/hooks/use-theme';
import type { Negocio } from '@/types/database.types';

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
  const ejemplo = negocio.origen === 'sembrado';
  // Cerrado ahora (se SABE que lo está; sin horario conocido no se apaga): se ve en gris y no se toca. «Cerrado» ya va en el texto de la tarjeta.
  const cerrado = negocio.abierto_ahora === false;
  // «a 1.2 km»: lo que de verdad le sirve a quien busca; el puntaje del ranking NO se enseña.
  const distancia = negocio.distancia_km != null && Number.isFinite(negocio.distancia_km) ? `a ${negocio.distancia_km.toFixed(1)} km` : null;
  // Con horario estructurado (0070) el estado manda y el texto largo se queda para la ficha; sin él, se enseña el texto como antes.
  const estado = negocio.abierto_ahora === true ? 'Abierto ahora' : negocio.abierto_ahora === false ? 'Cerrado' : null;
  const detalle = [estado, distancia, estado ? null : negocio.horario].filter(Boolean).join(' · ');

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
    <View style={[estilos.textos, forma === 'destacado' && estilos.textosDestacado]}>
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
      onPress={cerrado ? undefined : onPress}
      disabled={cerrado}
      accessibilityState={{ disabled: cerrado }}
      accessibilityRole="button"
      accessibilityLabel={`${negocio.nombre}${detalle ? '. ' + detalle : ''}${ejemplo ? '. Negocio de ejemplo' : ''}`}
      style={[
        forma === 'fila'
          ? [estilos.fila, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]
          : [estilos.destacado, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }],
        cerrado && estilos.cerrado,
      ]}
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
      {forma === 'fila' ? (
        <View pointerEvents={cerrado ? 'none' : 'auto'}>
          <BotonFavoritoNegocio negocioId={negocio.id} />
        </View>
      ) : null}
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
  // Gris: la misma tarjeta, apagada. El texto dice «Cerrado», así que el color no es lo único que lo avisa.
  cerrado: { opacity: 0.45 },
  fotoFila: { width: 72, height: 72, borderRadius: Radios.control },
  // La tarjeta del carril: con borde, la foto arriba hasta el borde y el texto con su margen (como la de Departamentos destacados).
  destacado: { width: 220, borderWidth: Filete.fino, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  fotoDestacado: { width: 220 - 2 * Filete.fino, height: AltoFotoTarjeta * 0.6 },
  textosDestacado: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
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
