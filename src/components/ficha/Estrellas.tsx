import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { estrellasDe, etiquetaCalificacion, textoCalificacion, textoNumResenas } from '@/lib/resenas';

/**
 * Las estrellas de una calificación · Cuervo 360. SOLO muestra: la calificación la calcula la base y nunca se asigna. Sin reseñas no
 * pinta estrellas ni una cifra: dice «Sin reseñas todavía». La etiqueta accesible lleva el valor y cuántas reseñas son (las
 * estrellas sueltas no dicen nada a un lector de pantalla), y el icono es redundante con el texto.
 */
export function Estrellas({
  calificacion,
  numResenas,
  compacta = false,
}: {
  calificacion: number | null | undefined;
  numResenas: number;
  compacta?: boolean;
}) {
  const theme = useTheme();
  const hay = calificacion != null && numResenas > 0;

  if (!hay) {
    return compacta ? null : (
      <ThemedText type="small" themeColor="textSecondary">Sin reseñas todavía</ThemedText>
    );
  }

  const { llenas, media, vacias } = estrellasDe(calificacion);
  const color = theme.text;

  return (
    <View style={estilos.fila} accessible accessibilityLabel={etiquetaCalificacion(calificacion, numResenas)}>
      {compacta ? (
        <Ionicons name="star" size={14} color={color} />
      ) : (
        <>
          {Array.from({ length: llenas }, (_, i) => <Ionicons key={`l${i}`} name="star" size={16} color={color} />)}
          {media ? <Ionicons name="star-half" size={16} color={color} /> : null}
          {Array.from({ length: vacias }, (_, i) => <Ionicons key={`v${i}`} name="star-outline" size={16} color={color} />)}
        </>
      )}
      <ThemedText type="small" style={Texto.pesoFuerte}>{textoCalificacion(calificacion)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{compacta ? `(${numResenas})` : textoNumResenas(numResenas)}</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
