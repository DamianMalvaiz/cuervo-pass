import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toque } from '@/lib/tacto';

export type Modulo = 'depas' | 'roomies' | 'servicios';

const OPCIONES: { valor: Modulo; etiqueta: string }[] = [
  { valor: 'depas', etiqueta: 'Depas' },
  { valor: 'roomies', etiqueta: 'Roomies' },
  { valor: 'servicios', etiqueta: 'Servicios' },
];

/**
 * Selector de módulo de Inicio · Cuervo 360.
 *
 * Sustituye a las pestañas de Roomies y Chats que salen del menú de cinco accesos. Lo que
 * sigue siendo cierto de las pestañas: dice en cuál estás sin depender del color (cambian el
 * relleno, el borde y el peso) y cada opción se toca con el pulgar (44 pt). Servicios se sumó el
 * 17/10/2026.
 */
export function SelectorModulo({ valor, onCambiar }: { valor: Modulo; onCambiar: (v: Modulo) => void }) {
  const theme = useTheme();

  return (
    <View accessibilityRole="tablist" style={estilos.fila}>
      {OPCIONES.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="tab"
            accessibilityLabel={o.etiqueta}
            accessibilityState={{ selected: activo }}
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
            {/* Una sola línea que se encoge antes de partirse: en un teléfono real «Roomies» salía como «Roomi / es». */}
            <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[estilos.texto, activo && Texto.pesoFuerte]}>
              {o.etiqueta}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: Spacing.two },
  opcion: {
    flex: 1,
    minHeight: 44,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  texto: { textAlign: 'center' },
});
