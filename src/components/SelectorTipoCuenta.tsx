import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toque } from '@/lib/tacto';
import { OPCIONES_TIPO_CUENTA, type TipoCuenta } from '@/lib/tipoCuenta';

/**
 * «¿Cómo vas a usar Cuervo 360?» — la primera pregunta del registro.
 *
 * Mismo idioma visual que `SelectorModulo`: dice cuál está elegida sin depender del color (relleno, borde y peso) y cada opción mide 44 pt.
 * Es un grupo de radios, no pestañas: elegir uno cambia qué pide el formulario, no a dónde estás.
 */
export function SelectorTipoCuenta({ valor, onCambiar }: { valor: TipoCuenta; onCambiar: (v: TipoCuenta) => void }) {
  const theme = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Cómo vas a usar Cuervo 360" style={estilos.fila}>
      {OPCIONES_TIPO_CUENTA.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="radio"
            accessibilityLabel={o.etiqueta}
            accessibilityState={{ checked: activo }}
            onPress={() => {
              if (activo) return;
              toque();
              onCambiar(o.valor);
            }}
            style={[
              estilos.opcion,
              {
                borderColor: activo ? theme.text : theme.border,
                backgroundColor: activo ? theme.backgroundSelected : 'transparent',
              },
            ]}
          >
            <ThemedText style={[estilos.texto, activo && Texto.pesoFuerte]}>{o.etiqueta}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  opcion: {
    flexGrow: 1,
    minHeight: 44,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  texto: { textAlign: 'center' },
});
