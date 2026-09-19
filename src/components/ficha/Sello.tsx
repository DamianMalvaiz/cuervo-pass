import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppColors, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * El sello: la única cosa con color en la hoja.
 *
 * En un documento oficial el sello es lo que lo valida, y es lo único impreso en
 * otra tinta. Aquí igual: el ámbar aparece SOLO sobre la acción que compromete
 * —pedir un contacto, guardar, crear la cuenta— y en ningún otro lugar. Un
 * segundo ámbar en la misma pantalla es un error, no una variante.
 *
 * El texto va en tinta, no en blanco: blanco sobre #E8A33D da 1.98:1 y reprueba.
 * Tinta sobre ámbar da 8.8:1.
 *
 * Pero eso vale solo para la variante RELLENA. La de contorno no tiene ámbar
 * debajo: su fondo es el de la app, y ahí la tinta daba 1.00:1 en modo oscuro —
 * el botón desaparecía por completo. Cada variante toma su color del fondo que
 * de verdad tiene detrás, no del que tiene la otra.
 */
export function Sello({
  children,
  onPress,
  icono,
  cargando = false,
  deshabilitado = false,
  variante = 'sello',
  accessibilityLabel,
}: {
  children: string;
  onPress?: () => void;
  icono?: keyof typeof Ionicons.glyphMap;
  cargando?: boolean;
  deshabilitado?: boolean;
  /** `contorno` para la acción secundaria: mismo peso, sin gastar la tinta. */
  variante?: 'sello' | 'contorno';
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const inactivo = deshabilitado || cargando;
  const esSello = variante === 'sello';
  // Relleno ámbar → tinta encima (8.8:1). Contorno → el acento del tema, que ya
  // está medido contra el fondo de cada modo (5.5:1 claro, 8.8:1 oscuro).
  const colorTexto = esSello ? AppColors.selloTexto : theme.acento;

  return (
    <Pressable
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.base,
        esSello ? estilos.relleno : [estilos.contorno, { borderColor: theme.acento }],
        inactivo && estilos.inactivo,
        // Sin sombras: Android ignora `shadowColor` y este mundo separa con
        // filete. La respuesta al toque es opacidad, que sí se ve en los dos.
        pressed && !inactivo && estilos.presionado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <View style={estilos.contenido}>
          {icono && <Ionicons name={icono} size={18} color={colorTexto} />}
          <ThemedText style={[estilos.texto, { color: colorTexto }]}>{children}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relleno: { backgroundColor: AppColors.sello },
  contorno: { backgroundColor: 'transparent', borderWidth: 2 },
  inactivo: { opacity: 0.45 },
  presionado: { opacity: 0.75 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  texto: {
    fontFamily: Tipografia.bold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
});
