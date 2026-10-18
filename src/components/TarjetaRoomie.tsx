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
  /** Similitud de coseno 0–1 (la de antes de la 0066). Solo se usa si el servidor aún no manda la compatibilidad. */
  afinidad?: number | null;
  /** Compatibilidad por REGLAS, 0–1 (0066): ruido, tabaco, horario, mascotas y aportación. Nula = no hay dato que comparar. */
  compatibilidad?: number | null;
  /** Frases de lo que coincide y de lo que no, tal como las devuelve el servidor. */
  coincidencias?: string[];
  diferencias?: string[];
  onPress?: () => void;
}

const MAX_RAZONES = 3;

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

/**
 * La etiqueta sale de la compatibilidad POR REGLAS, que es la que se puede explicar con las frases de abajo; el coseno solo ordena la lista.
 * Cortes iniciales (0.75 / 0.5), sin calibrar con convivencia real. Sin dato: `null`, y la tarjeta dice «sin datos», NO «baja»: no tener con
 * qué comparar no es ser incompatible.
 */
export function etiquetaCompatibilidad(c: number | null | undefined): 'Alta' | 'Media' | 'Baja' | null {
  if (c == null) return null;
  if (c >= 0.75) return 'Alta';
  if (c >= 0.5) return 'Media';
  return 'Baja';
}

export function TarjetaRoomie({
  nombreUsuario, descripcionBusqueda, fotoUrl, afinidad, compatibilidad, coincidencias = [], diferencias = [], onPress,
}: Props) {
  const theme = useTheme();
  const etiquetaNueva = etiquetaCompatibilidad(compatibilidad);
  // Si el servidor aún no manda la compatibilidad (migración 0066 sin aplicar) se conserva la etiqueta de afinidad de antes.
  const etiquetaAnterior = compatibilidad === undefined && afinidad != null ? etiquetaAfinidad(afinidad) : null;
  const textoEtiqueta = etiquetaNueva ? `COMPATIBILIDAD ${etiquetaNueva.toUpperCase()}` : etiquetaAnterior ? `AFINIDAD ${etiquetaAnterior.toUpperCase()}` : 'SIN DATOS PARA COMPARAR';
  const aFavor = coincidencias.slice(0, MAX_RAZONES);
  const enContra = diferencias.slice(0, MAX_RAZONES - Math.min(aFavor.length, MAX_RAZONES - 1));
  const textoAfinidad = etiquetaNueva ?? etiquetaAnterior;
  const inicial = (nombreUsuario ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[
        nombreUsuario,
        descripcionBusqueda,
        textoAfinidad ? `${etiquetaNueva ? 'compatibilidad' : 'afinidad'} ${textoAfinidad.toLowerCase()}` : 'sin datos para comparar',
        aFavor.length ? `A favor: ${aFavor.join(', ')}` : null,
        enContra.length ? `Ojo: ${enContra.join(', ')}` : null,
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
          <ThemedText type="etiqueta" themeColor="textSecondary">
            {textoEtiqueta}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>

      {aFavor.length + enContra.length > 0 ? (
        <>
          <FileteHoja />
          <View style={estilos.razones}>
            {aFavor.map((r) => (
              <View key={`a-${r}`} style={estilos.razon}>
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.bosque} />
                <ThemedText type="small">{r}</ThemedText>
              </View>
            ))}
            {enContra.map((r) => (
              <View key={`d-${r}`} style={estilos.razon}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">{r}</ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}

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
  razones: { padding: Spacing.three, gap: Spacing.one },
  razon: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  descripcion: { lineHeight: 20 },
});
