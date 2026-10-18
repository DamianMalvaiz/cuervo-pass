import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Una fila de cifras con su etiqueta debajo · Cuervo 360. Va en la tarjeta de identidad de Perfil.
 * `valor: null` es «todavía no sé» (cargando o falló) y se pinta como guion: un cero inventado diría «no tienes
 * ninguno» cuando solo no se ha podido mirar (END-11).
 */
export function Estadisticas({ datos }: { datos: { etiqueta: string; valor: number | null }[] }) {
  const theme = useTheme();
  return (
    <View style={[estilos.fila, { borderTopColor: theme.filete }]}>
      {datos.map((d) => {
        const cifra = d.valor == null ? '—' : String(d.valor);
        return (
          <View
            key={d.etiqueta}
            style={estilos.columna}
            accessible
            accessibilityLabel={`${cifra} ${d.etiqueta}`}
          >
            <ThemedText style={[Texto.subtitulo, Texto.pesoFuerte]}>{cifra}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {d.etiqueta}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', borderTopWidth: Filete.fino, paddingTop: Spacing.three },
  columna: { flex: 1, alignItems: 'center', gap: Spacing.half },
});
