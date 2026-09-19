import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppColors, Radios, Spacing, Tipografia } from '@/constants/theme';

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
  const inactivo = deshabilitado || cargando;
  const esSello = variante === 'sello';

  return (
    <Pressable
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.base,
        esSello ? estilos.relleno : estilos.contorno,
        inactivo && estilos.inactivo,
        // Sin sombras: Android ignora `shadowColor` y este mundo separa con
        // filete. La respuesta al toque es opacidad, que sí se ve en los dos.
        pressed && !inactivo && estilos.presionado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={AppColors.selloTexto} />
      ) : (
        <View style={estilos.contenido}>
          {icono && <Ionicons name={icono} size={18} color={AppColors.selloTexto} />}
          <ThemedText style={estilos.texto}>{children}</ThemedText>
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
  contorno: { backgroundColor: 'transparent', borderWidth: 2, borderColor: AppColors.sello },
  inactivo: { opacity: 0.45 },
  presionado: { opacity: 0.75 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  texto: {
    color: AppColors.selloTexto,
    fontFamily: Tipografia.bold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
});
