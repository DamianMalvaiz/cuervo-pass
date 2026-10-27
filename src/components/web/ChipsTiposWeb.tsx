import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FiltrosWeb } from '@/lib/filtrosWeb';
import type { TipoVivienda } from '@/services/explorar.service';

type Chip =
  | { clave: string; nombre: string; icono: keyof typeof Ionicons.glyphMap; tipo: TipoVivienda }
  | { clave: string; nombre: string; icono: keyof typeof Ionicons.glyphMap; campo: 'amueblado' | 'mascotas' | 'serviciosIncluidos' };

const CHIPS: Chip[] = [
  { clave: 'cuarto', nombre: 'Cuartos', icono: 'bed-outline', tipo: 'cuarto' },
  { clave: 'depa', nombre: 'Departamentos', icono: 'business-outline', tipo: 'depa' },
  { clave: 'casa', nombre: 'Casas compartidas', icono: 'people-outline', tipo: 'casa_compartida' },
  { clave: 'amueblado', nombre: 'Amueblado', icono: 'cube-outline', campo: 'amueblado' },
  { clave: 'mascotas', nombre: 'Acepta mascotas', icono: 'paw-outline', campo: 'mascotas' },
  { clave: 'servicios', nombre: 'Servicios incluidos', icono: 'flash-outline', campo: 'serviciosIncluidos' },
];

/**
 * La fila de filtros rápidos bajo el buscador. Los tres TIPOS son excluyentes entre sí (tocar uno lo prende, tocarlo otra vez lo apaga) y los otros tres son interruptores de sí/no.
 * Comparten el estado del buscador: el chip de tipo y el campo «Tipo» del buscador dicen siempre lo mismo.
 */
export function ChipsTiposWeb({ filtros, onCambiar, alinear = 'centro' }: { filtros: FiltrosWeb; onCambiar: (f: FiltrosWeb) => void; alinear?: 'centro' | 'inicio' | 'deslizar' }) {
  const theme = useTheme();
  const chips = (
    <>
      {CHIPS.map((c) => {
        const activo = 'tipo' in c ? filtros.tipo === c.tipo : filtros[c.campo];
        const alTocar = () => {
          if ('tipo' in c) onCambiar({ ...filtros, tipo: activo ? null : c.tipo });
          else onCambiar({ ...filtros, [c.campo]: !filtros[c.campo] });
        };
        return (
          <Pulsable
            key={c.clave}
            onPress={alTocar}
            // Un filtro puesto es una casilla marcada: en la web `selected` no se escribe para botones y el lector de pantalla no sabría cuáles están puestos.
            accessibilityRole="checkbox"
            accessibilityLabel={`Filtrar por ${c.nombre.toLowerCase()}`}
            accessibilityState={{ checked: activo }}
            aria-checked={activo}
            style={[estilos.chip, { borderColor: activo ? theme.sello : theme.filete, backgroundColor: activo ? theme.sello : theme.backgroundElement }]}
          >
            <Ionicons name={c.icono} size={18} color={activo ? theme.selloTexto : theme.bosque} />
            <ThemedText style={[Texto.pequenoFuerte, { color: activo ? theme.selloTexto : theme.text }]}>{c.nombre}</ThemedText>
          </Pulsable>
        );
      })}
    </>
  );
  // `deslizar` (teléfono): una sola fila que se desliza de lado, en vez de tres renglones de chips.
  if (alinear === 'deslizar') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.deslizable}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={[estilos.fila, alinear === 'inicio' && estilos.alInicio]}>{chips}</View>;
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two },
  alInicio: { justifyContent: 'flex-start' },
  deslizable: { flexDirection: 'row', gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino },
});
