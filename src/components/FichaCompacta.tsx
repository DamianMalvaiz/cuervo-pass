import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Calificacion } from '@/components/ficha/Calificacion';

/**
 * La ficha en formato carrusel.
 *
 * Es la hermana chica de `FichaPublicacion`: misma información, mismo orden de
 * lectura —calificación primero, luego renta—, pero apaisada para que quepan
 * tres en una pantalla y se recorran de lado.
 *
 * Lo que NO trae, a propósito: el corazón de favoritos que Airbnb pone en cada
 * tarjeta. Cuervo Pass no tiene favoritos, y un corazón que no guarda nada es un
 * botón que miente. Cuando exista la función, este es su lugar.
 */
export function FichaCompacta({
  titulo,
  precio,
  fotoUrl,
  distanciaKm,
  score,
  onPress,
}: {
  titulo: string;
  precio: number;
  fotoUrl?: string | null;
  distanciaKm?: number | null;
  score?: number | null;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const precioTexto = `$${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(precio)}`;
  const hay = typeof score === 'number' && Number.isFinite(score);
  const calificacion = hay ? Math.min(10, Math.max(0, score! * 10)).toFixed(1) : null;
  const hayDistancia = distanciaKm != null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[
        titulo,
        calificacion ? `afinidad ${calificacion} de 10` : 'sin calificación',
        `${precioTexto} al mes`,
        hayDistancia ? `a ${distanciaKm!.toFixed(1)} kilómetros` : 'sin distancia',
      ].join('. ')}
      style={({ pressed }) => [estilos.tarjeta, pressed && estilos.presionada]}
    >
      {fotoUrl ? (
        <Image
          source={{ uri: fotoUrl }}
          style={[estilos.foto, { borderColor: theme.filete }]}
          contentFit="cover"
          transition={160}
        />
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="image-outline" size={18} color={theme.textSecondary} />
        </View>
      )}

      <View style={estilos.datos}>
        {/* La calificación primero, igual que en la ficha grande: es la tesis. */}
        <View style={estilos.filaCifras}>
          <Calificacion score={score} tamano="compacta" />
          <ThemedText type="cifra" numberOfLines={1} style={estilos.precio}>
            {precioTexto}
          </ThemedText>
        </View>

        <ThemedText type="small" numberOfLines={2} style={estilos.titulo}>
          {titulo}
        </ThemedText>
        <ThemedText type="folio" themeColor="textSecondary">
          {hayDistancia ? `A ${distanciaKm!.toFixed(1)} KM` : 'SIN DISTANCIA'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export const ANCHO_FICHA_COMPACTA = 176;

const estilos = StyleSheet.create({
  tarjeta: { width: ANCHO_FICHA_COMPACTA, gap: Spacing.two },
  presionada: { opacity: 0.7 },
  // 1:1 como Airbnb en sus carruseles: en horizontal, el cuadrado deja ver más
  // fotografías por pantalla que el 3:2 de la ficha grande.
  foto: { width: '100%', aspectRatio: 1, borderRadius: Radios.control, borderWidth: Filete.fino },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  datos: { gap: Spacing.half },
  filaCifras: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  precio: { flexShrink: 1 },
  titulo: { lineHeight: 18 },
});
