import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Un apartado de la pantalla: título en frase normal y contenido.
 *
 * Hasta el 17/10/2026 llevaba el título en versalitas y una raya debajo (estilo expediente). Ahora el título va
 * en frase normal y sin raya; el aire entre bloques hace de separación.
 *
 * Es la unidad que hace legible un formulario largo. Seis campos seguidos no se
 * leen; tres bloques de dos sí. Lo hace cualquier formulario oficial y también
 * Airbnb con sus formularios largos, por la misma razón.
 *
 * `accion` va en la misma línea del título porque ahí es donde se busca: quien
 * lee el encabezado de un bloque es quien quiere hacer algo con ese bloque.
 */
export function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={estilos.seccion}>
      <View style={estilos.cabecera}>
        <ThemedText type="subtitle" style={estilos.titulo}>
          {titulo}
        </ThemedText>
        {accion}
      </View>
      <View style={estilos.contenido}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Spacing.two },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flexShrink: 1 },
  contenido: { gap: Spacing.three, paddingTop: Spacing.one },
});
