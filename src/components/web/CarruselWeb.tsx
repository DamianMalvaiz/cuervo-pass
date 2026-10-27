import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HUECO_CARRUSEL } from '@/lib/medidasWeb';

/**
 * Una sección del teléfono en forma de carrusel: el título con una flecha circular que lleva a la página completa y, debajo, las tarjetas en una fila que se desliza de lado (se ve un pedazo de la siguiente,
 * y así se nota que hay más). `relleno` es lo que deja la página a los lados: la fila empieza alineada con el título y se desliza hasta el borde de la pantalla.
 */
export function CarruselWeb({ titulo, etiquetaVerTodo, onVerTodo, relleno = Spacing.three, children }: { titulo: string; etiquetaVerTodo: string; onVerTodo: () => void; relleno?: number; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={estilos.seccion}>
      <View style={[estilos.cabecera, { paddingHorizontal: relleno }]}>
        <ThemedText accessibilityRole="header" style={[Texto.subtitulo, estilos.titulo]}>{titulo}</ThemedText>
        <Pulsable onPress={onVerTodo} accessibilityRole="button" accessibilityLabel={etiquetaVerTodo} style={[estilos.flecha, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="arrow-forward" size={20} color={theme.text} />
        </Pulsable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={[estilos.fila, { paddingHorizontal: relleno }]}>
        {children}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Spacing.three },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  titulo: { flex: 1 },
  flecha: { width: 44, height: 44, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  fila: { gap: HUECO_CARRUSEL },
});
