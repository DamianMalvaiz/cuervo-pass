import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FormularioNegocio } from '@/components/FormularioNegocio';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMiNegocio } from '@/hooks/queries/useMisNegocios';

/**
 * Editar un negocio propio. Tres estados y no dos (END-11): cargando, falló, y «no existe o no es tuyo» se pintan distinto.
 * El formulario solo se monta cuando ya están el negocio y su menú, para que arranque con los datos reales y no en blanco.
 */
export default function EditarNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { negocio, items, turnos, cargando, fallo, reintentar } = useMiNegocio(id);

  if (cargando) {
    return (
      <ThemedView style={estilos.centrado}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando…</ThemedText>
      </ThemedView>
    );
  }
  if (fallo) {
    return (
      <ThemedView style={estilos.centrado}>
        <ThemedText type="small" themeColor="textSecondary">No pudimos cargar tu negocio. Revisa tu conexión e intenta de nuevo.</ThemedText>
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">Reintentar</Sello>
      </ThemedView>
    );
  }
  if (!negocio) {
    return (
      <ThemedView style={estilos.centrado}>
        <ThemedText type="small" themeColor="textSecondary">Este negocio no existe o no es tuyo.</ThemedText>
      </ThemedView>
    );
  }
  return <FormularioNegocio inicial={{ negocio, items, turnos }} />;
}

const estilos = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
});
