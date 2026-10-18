import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Un grupo de renglones dentro de una tarjeta · Cuervo 360.
 *
 * Título en frase normal arriba (gris, pequeño) y, debajo, una tarjeta de esquinas redondeadas con los
 * renglones separados por un filete. Es la forma de las pantallas de ajustes de la propuesta visual del
 * 17/10/2026. Los hijos nulos o falsos se ignoran: así un renglón condicional no deja un filete colgando.
 */
export function GrupoAjustes({
  titulo,
  testID,
  children,
}: {
  titulo?: string;
  testID?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const renglones = Children.toArray(children).filter(isValidElement);

  return (
    <View style={estilos.grupo} testID={testID}>
      {titulo ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={estilos.titulo}>
          {titulo}
        </ThemedText>
      ) : null}
      <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
        {renglones.map((renglon, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View testID="filete-ajuste" style={{ height: Filete.fino, backgroundColor: theme.filete }} />
            ) : null}
            {renglon}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: Spacing.two },
  titulo: { paddingLeft: Spacing.one },
  tarjeta: {
    borderWidth: Filete.fino,
    borderRadius: Radios.tarjeta,
    paddingHorizontal: Spacing.three,
    overflow: 'hidden',
  },
});
