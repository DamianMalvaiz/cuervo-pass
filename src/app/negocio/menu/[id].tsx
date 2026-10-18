import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { EditorMenu } from '@/components/EditorMenu';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMiNegocio } from '@/hooks/queries/useMisNegocios';

/**
 * El menú de un negocio propio. Tres estados y no dos (END-11): cargando, falló, y «no existe o no es tuyo». El editor solo
 * se monta cuando YA está el menú cargado, para que arranque con los productos reales y no en blanco (y no pise lo guardado).
 */
export default function MenuNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { negocio, items, cargando, fallo, reintentar } = useMiNegocio(id);

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
        <ThemedText type="small" themeColor="textSecondary">No pudimos cargar tu menú. Revisa tu conexión e intenta de nuevo.</ThemedText>
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
  return <EditorMenu negocioId={negocio.id} nombreNegocio={negocio.nombre} items={items} />;
}

const estilos = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
});
