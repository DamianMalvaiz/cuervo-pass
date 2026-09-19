import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Filete, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Campo de contraseña con ojo para verla.
 *
 * Por qué importa más de lo que parece: acabamos de subir el mínimo a diez
 * caracteres con mayúsculas, minúsculas y dígitos. Teclear eso a ciegas en un
 * teléfono, sin poder comprobar lo que escribiste, produce exactamente el
 * comportamiento que la regla quería evitar — la gente elige algo corto y fácil
 * de teclear, o lo pega desde otro lado. Poder verla es lo que hace que una
 * contraseña fuerte sea sostenible.
 *
 * Detalles que suelen fallar y aquí no:
 *  - El botón anuncia su ACCIÓN ("Mostrar la contraseña"), no su estado, que es
 *    lo que un lector de pantalla necesita para saber qué pasa si lo toca.
 *  - El estado no se codifica solo con el icono: `accessibilityState.selected`
 *    lo expone a la tecnología de asistencia.
 *  - El área táctil llega a 44pt aunque el icono mida 20.
 *  - `secureTextEntry` y `autoComplete` se mantienen correctos en ambos estados
 *    para que el gestor de contraseñas del teléfono siga funcionando.
 */
export const CampoContrasena = forwardRef<TextInput, TextInputProps>(function CampoContrasena(
  { style, ...props },
  ref
) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View
      style={[
        estilos.envoltura,
        { borderColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      <TextInput
        ref={ref}
        style={[estilos.entrada, { color: theme.text }, style]}
        placeholderTextColor={theme.textSecondary}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        // Sin esto Android ofrece el teclado de sugerencias sobre un campo
        // oculto, que es de donde salen la mitad de las contraseñas con el
        // primer carácter en mayúscula sin que nadie lo pidiera.
        keyboardType={visible ? 'visible-password' : 'default'}
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={estilos.boton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        accessibilityState={{ selected: visible }}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>
    </View>
  );
});

const estilos = StyleSheet.create({
  envoltura: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    minHeight: 52,
  },
  entrada: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: Tipografia.regular,
    fontSize: 16,
  },
  boton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.half,
  },
});
