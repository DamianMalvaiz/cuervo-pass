import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * El renglón de ajustes: icono, etiqueta, y o un chevron o un interruptor.
 *
 * Es el patrón más reconocible de cualquier app de ajustes, y el que la pantalla
 * de perfil de este proyecto no tenía: todo iba en un scroll de botones del
 * mismo peso, sin agrupar y sin jerarquía. Un renglón con chevron dice "esto
 * lleva a otro lado" sin que nadie lo explique.
 *
 * El interruptor va en TINTA, no en ámbar: mover un ajuste no compromete nada
 * —se guarda con el botón de la pantalla— y una lista de seis interruptores
 * encendidos serían seis sellos donde no se puede actuar.
 */
export function FilaAjuste({
  icono,
  etiqueta,
  descripcion,
  valor,
  onPress,
  onCambiar,
  destructiva = false,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  descripcion?: string;
  /** Presente ⇒ es un interruptor. Ausente ⇒ es un renglón con chevron. */
  valor?: boolean;
  onPress?: () => void;
  onCambiar?: (v: boolean) => void;
  destructiva?: boolean;
}) {
  const theme = useTheme();
  const esInterruptor = valor !== undefined;
  const color = destructiva ? theme.error : theme.text;

  const contenido = (
    <>
      <Ionicons name={icono} size={22} color={destructiva ? theme.error : theme.textSecondary} />
      <View style={estilos.textos}>
        <ThemedText style={{ color }}>{etiqueta}</ThemedText>
        {descripcion ? (
          <ThemedText type="small" themeColor="textSecondary" style={estilos.descripcion}>
            {descripcion}
          </ThemedText>
        ) : null}
      </View>
      {esInterruptor ? (
        <Switch
          value={valor}
          onValueChange={onCambiar}
          accessibilityLabel={etiqueta}
          trackColor={{ true: theme.text, false: theme.border }}
          thumbColor={theme.background}
          ios_backgroundColor={theme.border}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      )}
    </>
  );

  if (esInterruptor) {
    return <View style={estilos.fila}>{contenido}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={descripcion ? `${etiqueta}. ${descripcion}` : etiqueta}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
    >
      {contenido}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // 60px: el alto de renglón de una lista de ajustes. Por debajo de 56 el dedo
  // falla y por encima de 64 la lista se siente vacía.
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 60,
    paddingVertical: Spacing.two,
  },
  presionada: { opacity: 0.6 },
  textos: { flex: 1, gap: Spacing.half },
  descripcion: { lineHeight: 18 },
});
