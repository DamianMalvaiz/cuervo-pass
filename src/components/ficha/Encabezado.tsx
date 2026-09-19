import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * El título de pantalla, GRANDE y en el cuerpo — no en la barra de navegación.
 *
 * Es el patrón que Airbnb usa en cada subpantalla: la flecha de volver arriba, y
 * debajo un título a cuerpo grande que puede ocupar dos renglones. Funciona
 * mejor que el título centrado de la barra por dos razones concretas: cabe un
 * título largo sin abreviarlo con puntos suspensivos, y deja la barra limpia
 * para la acción de volver.
 *
 * Aquí además carga el membrete del documento: la versalita encima y el filete
 * grueso debajo, que es lo que hace que se lea como un expediente y no como una
 * pantalla de ajustes cualquiera.
 */
export function Encabezado({
  kicker,
  titulo,
  descripcion,
  meta,
  accion,
}: {
  /** Versalita encima. Es dato, no adorno: dice QUÉ documento es. */
  kicker?: string;
  titulo: string;
  descripcion?: string;
  /** Renglón de folio/fecha/conteo, debajo de la descripción. */
  meta?: string;
  accion?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={estilos.bloque}>
      <View style={estilos.filaTitulo}>
        <View style={estilos.textos}>
          {kicker ? (
            <ThemedText type="etiqueta" themeColor="textSecondary">
              {kicker}
            </ThemedText>
          ) : null}
          <ThemedText style={estilos.titulo}>{titulo}</ThemedText>
        </View>
        {accion}
      </View>

      {descripcion ? (
        <ThemedText type="small" themeColor="textSecondary" style={estilos.descripcion}>
          {descripcion}
        </ThemedText>
      ) : null}

      {meta ? (
        <ThemedText type="folio" themeColor="textSecondary">
          {meta}
        </ThemedText>
      ) : null}

      <View style={[estilos.filete, { backgroundColor: theme.text }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: Spacing.one, paddingTop: Spacing.two },
  filaTitulo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  textos: { flex: 1, gap: Spacing.half },
  // 32px: más grande que `title` (26) porque aquí manda la pantalla entera, y
  // dos renglones caben sin romper el ritmo.
  titulo: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6, fontFamily: 'Archivo_700Bold' },
  descripcion: { lineHeight: 20 },
  filete: { height: Filete.grueso, marginTop: Spacing.two },
});
