import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { FileteHoja } from '@/components/ficha/CampoFicha';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  nombreUsuario: string;
  descripcionBusqueda?: string;
  /** URL ya FIRMADA: el bucket es privado (§14). */
  fotoUrl?: string | null;
  /** Similitud de coseno 0–1 que devuelve sugerencias_roomies. */
  afinidad?: number | null;
  onPress?: () => void;
}

/**
 * La afinidad de un roomie va como ETIQUETA, no como calificación.
 *
 * Es deliberado, y difiere a propósito de las publicaciones, donde sí se muestra
 * "9.4". Allá la cifra se puede defender: el desglose abre la fórmula de la
 * migración 0015 y enseña de dónde sale cada décima. Aquí `sugerencias_roomies`
 * devuelve SOLO la similitud de coseno, sin componentes, así que un número
 * invitaría a la pregunta "¿y por qué 8.1 y no 7.9?" sin nada que responder.
 *
 * Mostrar precisión que no se puede justificar es peor que no mostrarla.
 */
function etiquetaAfinidad(afinidad: number): string {
  if (afinidad >= 0.75) return 'Alta';
  if (afinidad >= 0.55) return 'Media';
  return 'Baja';
}

export function TarjetaRoomie({ nombreUsuario, descripcionBusqueda, fotoUrl, afinidad, onPress }: Props) {
  const theme = useTheme();
  const textoAfinidad = afinidad != null ? etiquetaAfinidad(afinidad) : null;
  const inicial = (nombreUsuario ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[
        nombreUsuario,
        descripcionBusqueda,
        textoAfinidad ? `afinidad ${textoAfinidad.toLowerCase()}` : 'sin afinidad calculada',
      ]
        .filter(Boolean)
        .join('. ')}
      style={({ pressed }) => [
        estilos.hoja,
        { borderColor: theme.filete, backgroundColor: theme.background },
        pressed && estilos.presionada,
      ]}
    >
      <View style={estilos.cabecera}>
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={[estilos.avatar, { borderColor: theme.filete }]} contentFit="cover" />
        ) : (
          <View
            style={[
              estilos.avatar,
              estilos.avatarVacio,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText type="smallBold" themeColor="textSecondary">
              {inicial}
            </ThemedText>
          </View>
        )}
        <View style={estilos.identidad}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {nombreUsuario}
          </ThemedText>
          {textoAfinidad ? (
            <ThemedText type="etiqueta" themeColor="textSecondary">
              AFINIDAD {textoAfinidad.toUpperCase()}
            </ThemedText>
          ) : (
            <ThemedText type="etiqueta" themeColor="textSecondary">
              SIN AFINIDAD CALCULADA
            </ThemedText>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>

      {descripcionBusqueda ? (
        <>
          <FileteHoja />
          <View style={estilos.cuerpo}>
            <ThemedText type="etiqueta" themeColor="textSecondary">
              QUÉ BUSCA
            </ThemedText>
            <ThemedText type="small" numberOfLines={3} style={estilos.descripcion}>
              {descripcionBusqueda}
            </ThemedText>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  hoja: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  presionada: { opacity: 0.7 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: Filete.fino },
  avatarVacio: { alignItems: 'center', justifyContent: 'center' },
  identidad: { flex: 1, gap: Spacing.half },
  cuerpo: { padding: Spacing.three, gap: Spacing.one },
  descripcion: { lineHeight: 20 },
});
