import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * El par etiqueta/valor: la unidad de composición de toda la app.
 *
 * Un documento oficial no tiene texto suelto. Tiene campos, y cada campo dice
 * qué es antes de decir cuánto vale. Eso resuelve de paso un problema real de
 * este producto: "1.2 km" no significa nada sin "DISTANCIA" encima, y la versión
 * anterior de la app escribía "1.2 km de la universidad" como prosa dentro de
 * una tarjeta, donde no se podía escanear ni alinear.
 */
export function CampoFicha({
  etiqueta,
  valor,
  icono,
  ancho,
  tono = 'normal',
}: {
  etiqueta: string;
  valor: string;
  icono?: keyof typeof Ionicons.glyphMap;
  /** Para repartir campos en una fila sin que uno empuje a los demás. */
  ancho?: number;
  /** `atenuado` para un valor ausente: el campo existe, el dato no. */
  tono?: 'normal' | 'atenuado';
}) {
  const theme = useTheme();
  return (
    <View style={[estilos.campo, ancho != null && { flex: ancho }]}>
      <ThemedText type="etiqueta" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <View style={estilos.linea}>
        {icono && (
          <Ionicons
            name={icono}
            size={13}
            color={tono === 'atenuado' ? theme.textSecondary : theme.text}
          />
        )}
        <ThemedText type="cifra" themeColor={tono === 'atenuado' ? 'textSecondary' : 'text'}>
          {valor}
        </ThemedText>
      </View>
    </View>
  );
}

/** Filete de separación. Decorativo: separa renglones, no delimita un control. */
export function FileteHoja({ vertical = false }: { vertical?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={
        vertical
          ? { width: Filete.fino, alignSelf: 'stretch', backgroundColor: theme.filete }
          : { height: Filete.fino, backgroundColor: theme.filete }
      }
    />
  );
}

const estilos = StyleSheet.create({
  campo: { gap: Spacing.half },
  linea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
