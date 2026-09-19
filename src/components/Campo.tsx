import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { CampoContrasena } from '@/components/CampoContrasena';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Un campo del documento: etiqueta arriba, valor abajo, error debajo.
 *
 * Antes cada pantalla repetía su propio `TextInput` con `placeholder` haciendo
 * de etiqueta. Eso tiene un problema conocido y feo: en cuanto escribes, el
 * placeholder desaparece y ya no hay forma de saber qué pedía ese campo —
 * especialmente al revisar un formulario largo antes de enviarlo. La etiqueta
 * persistente lo resuelve, y de paso es la misma unidad etiqueta/valor con la
 * que se lee toda la app.
 *
 * El error NO recolorea el borde del campo: aparece como renglón abajo. Así el
 * mensaje se puede leer y anunciar, en vez de depender de un color que mucha
 * gente no distingue.
 */
export const Campo = forwardRef<
  TextInput,
  TextInputProps & { etiqueta: string; error?: string; contrasena?: boolean }
>(function Campo({ etiqueta, error, contrasena, style, ...props }, ref) {
  const theme = useTheme();

  return (
    <View style={estilos.bloque}>
      <ThemedText type="etiqueta" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>

      {contrasena ? (
        <CampoContrasena ref={ref} accessibilityLabel={etiqueta} {...props} />
      ) : (
        <TextInput
          ref={ref}
          style={[
            estilos.entrada,
            { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={etiqueta}
          {...props}
        />
      )}

      {error ? (
        <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
});

const estilos = StyleSheet.create({
  bloque: { gap: Spacing.one },
  entrada: {
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 52,
    fontFamily: Tipografia.regular,
    fontSize: 16,
  },
});
