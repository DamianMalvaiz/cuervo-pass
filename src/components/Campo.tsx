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
  TextInputProps & {
    etiqueta: string;
    error?: string;
    contrasena?: boolean;
    /**
     * Marca el campo como "casilla sin llenar" mientras esté vacío: fondo
     * tintado, filete discontinuo y el texto de ayuda a la vista. Para los
     * campos opcionales y largos —biografía, texto libre— donde un recuadro
     * idéntico a los demás no distingue "no quise" de "se me olvidó".
     */
    punteado?: boolean;
  }
>(function Campo({ etiqueta, error, contrasena, punteado, style, value, ...props }, ref) {
  const theme = useTheme();
  const vacio = punteado === true && !String(value ?? '').trim();

  return (
    <View style={estilos.bloque}>
      <ThemedText type="etiqueta" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>

      {contrasena ? (
        <CampoContrasena ref={ref} accessibilityLabel={etiqueta} value={value} {...props} />
      ) : (
        <TextInput
          ref={ref}
          style={[
            estilos.entrada,
            {
              borderColor: vacio ? theme.filete : theme.border,
              color: theme.text,
              backgroundColor: vacio ? theme.backgroundElement : theme.background,
            },
            // El discontinuo es un EXTRA, no el portador del significado:
            // Android ignora `borderStyle: 'dashed'` cuando hay `borderRadius` y
            // lo pinta sólido. Lo que distingue el estado vacío en los dos
            // sistemas es el fondo tintado y el filete más claro; en iOS, además,
            // se ve la discontinua.
            vacio && estilos.punteado,
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={etiqueta}
          value={value}
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
  punteado: { borderStyle: 'dashed', borderWidth: Filete.grueso },
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
