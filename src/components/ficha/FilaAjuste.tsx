import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radios, Spacing, Texto } from '@/constants/theme';
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
  detalle,
  onPress,
  onCambiar,
  destructiva = false,
  bloqueada = false,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  descripcion?: string;
  /** Presente ⇒ es un interruptor. Ausente ⇒ es un renglón con chevron. */
  valor?: boolean;
  /** Dato corto a la derecha, antes del chevron («12», «Activadas»). */
  detalle?: string;
  onPress?: () => void;
  onCambiar?: (v: boolean) => void;
  destructiva?: boolean;
  /** Lo que todavía no se puede usar (por ejemplo, publicar sin verificar): no responde, se ve apagado y lleva un candado en lugar del chevron. */
  bloqueada?: boolean;
}) {
  const theme = useTheme();
  const esInterruptor = valor !== undefined;
  const color = destructiva ? theme.error : theme.text;

  const contenido = (
    <>
      <View style={[estilos.chipIcono, { backgroundColor: destructiva ? 'transparent' : theme.backgroundSelected }]}>
        <Ionicons name={icono} size={20} color={destructiva ? theme.error : theme.bosque} />
      </View>
      <View style={estilos.textos}>
        <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte, { color }]}>{etiqueta}</ThemedText>
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
        <>
          {detalle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {detalle}
            </ThemedText>
          ) : null}
          {bloqueada ? (
            <Ionicons testID="fila-bloqueada" name="lock-closed-outline" size={18} color={theme.textSecondary} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          )}
        </>
      )}
    </>
  );

  if (esInterruptor) {
    return <View style={estilos.fila}>{contenido}</View>;
  }

  return (
    <Pressable
      onPress={bloqueada ? undefined : onPress}
      disabled={bloqueada}
      accessibilityState={{ disabled: bloqueada }}
      accessibilityRole="button"
      accessibilityLabel={
        (descripcion ? `${etiqueta}. ${descripcion}` : etiqueta) + (detalle ? `${descripcion ? ',' : ','} ${detalle}` : '')
      }
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada, bloqueada && estilos.apagada]}
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
  apagada: { opacity: 0.55 },
  // El icono vive en un cuadro redondeado, no suelto: es la forma de la propuesta visual del 17/10/2026.
  chipIcono: {
    width: 36,
    // toque-ok: es adorno dentro de un renglón que mide 60 pt y se toca entero; el cuadro no es el control.
    height: 36,
    borderRadius: Radios.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: Spacing.half },
  descripcion: { lineHeight: 18 },
});
