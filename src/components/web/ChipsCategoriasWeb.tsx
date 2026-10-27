import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoriaExplorar } from '@/services/explorar.service';

/** Las categorías de negocios como chips: «Todos» y una por categoría; la elegida queda marcada y se anuncia como seleccionada. `activa` es el id de la categoría, o `undefined` para «Todos». */
export function ChipsCategoriasWeb({ categorias, activa, onElegir }: { categorias: CategoriaExplorar[]; activa: string | undefined; onElegir: (id: string | undefined) => void }) {
  const theme = useTheme();
  const opciones: { id: string | undefined; nombre: string }[] = [{ id: undefined, nombre: 'Todos' }, ...categorias.map((c) => ({ id: c.id, nombre: c.nombre }))];
  return (
    <View style={estilos.fila} accessibilityRole="radiogroup" accessibilityLabel="Categorías">
      {opciones.map((o) => {
        const seleccionada = activa === o.id;
        return (
          <Pulsable
            key={o.id ?? 'todos'}
            onPress={() => onElegir(o.id)}
            // Una sola categoría a la vez: opciones de un grupo (en la web `selected` no se escribe para botones).
            accessibilityRole="radio"
            accessibilityLabel={o.nombre}
            accessibilityState={{ checked: seleccionada }}
            aria-checked={seleccionada}
            style={[estilos.chip, { borderColor: seleccionada ? theme.sello : theme.filete, backgroundColor: seleccionada ? theme.sello : theme.backgroundElement }]}
          >
            <ThemedText style={[Texto.pequenoFuerte, { color: seleccionada ? theme.selloTexto : theme.text }]}>{o.nombre}</ThemedText>
          </Pulsable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino },
});
