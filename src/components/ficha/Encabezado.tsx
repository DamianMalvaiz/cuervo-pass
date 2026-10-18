import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Texto } from '@/constants/theme';

/**
 * El título de pantalla, GRANDE y en el cuerpo — no en la barra de navegación.
 *
 * Es el patrón que Airbnb usa en cada subpantalla: la flecha de volver arriba, y debajo un título a cuerpo
 * grande que puede ocupar dos renglones. Cabe un título largo sin abreviarlo con puntos suspensivos y deja la
 * barra limpia para la acción de volver.
 *
 * Hasta el 17/10/2026 cargaba además el membrete de «expediente»: una versalita encima, un renglón de folio
 * («14 REGISTROS · EMITIDO …») y una raya gruesa debajo. Probado en un iPhone real hacía que cada pantalla se
 * leyera como un formulario. Ahora es un título, una descripción opcional y la acción.
 */
export function Encabezado({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <View style={estilos.bloque}>
      <View style={estilos.filaTitulo}>
        <View style={estilos.textos}>
          <ThemedText style={estilos.titulo}>{titulo}</ThemedText>
        </View>
        {accion}
      </View>

      {descripcion ? (
        <ThemedText type="small" themeColor="textSecondary" style={estilos.descripcion}>
          {descripcion}
        </ThemedText>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: Spacing.one, paddingTop: Spacing.two },
  filaTitulo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  textos: { flex: 1, gap: Spacing.half },
  // 32px: más grande que `title` (26) porque aquí manda la pantalla entera, y dos renglones caben sin romper el
  // ritmo.
  titulo: Texto.tituloHoja,
  descripcion: { lineHeight: 20 },
});
