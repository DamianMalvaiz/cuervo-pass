import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useComparar } from '@/hooks/use-comparar';
import { useTheme } from '@/hooks/use-theme';

/**
 * «Comparar» en la ficha de la app: pone esta vivienda en la lista de comparar de ESTE teléfono (hasta tres; no viaja al servidor). Con la lista llena avisa en vez de callar, y con dos o más ofrece ir a verla.
 * Es el mismo comportamiento que el de la ficha de la web.
 */
export function BotonComparar({ id }: { id: string }) {
  const theme = useTheme();
  const { ids, lleno, alternar } = useComparar();
  const dentro = ids.includes(id);
  const bloqueado = lleno && !dentro;
  return (
    <View style={estilos.fila}>
      <Pulsable
        onPress={() => {
          if (!bloqueado) alternar(id);
        }}
        accessibilityRole="button"
        accessibilityLabel={dentro ? 'Quitar de la comparación' : bloqueado ? 'La comparación está llena' : 'Agregar a la comparación'}
        accessibilityState={{ disabled: bloqueado }}
        style={[estilos.accion, { borderColor: dentro ? theme.sello : theme.filete, backgroundColor: theme.backgroundElement, opacity: bloqueado ? 0.6 : 1 }]}
      >
        <Ionicons name={dentro ? 'checkmark' : 'git-compare-outline'} size={18} color={theme.text} />
        <ThemedText style={Texto.pequenoFuerte}>{dentro ? 'En la comparación' : bloqueado ? 'Comparación llena (3)' : 'Comparar'}</ThemedText>
      </Pulsable>
      {ids.length >= 2 ? (
        <Pulsable
          onPress={() => router.push('/comparar')}
          accessibilityRole="link"
          accessibilityLabel={`Ver la comparación de ${ids.length} lugares`}
          style={[estilos.accion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText style={Texto.pequenoFuerte}>{`Ver comparación (${ids.length})`}</ThemedText>
        </Pulsable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  accion: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino },
});
