import { FlatList } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 5): motor de sugerencias Nivel 1 (filtros ponderados).
// TODO (Semana 9): combinar con Nivel 2 (similitud de coseno, pgvector).
export default function InicioScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Sugerencias para ti</ThemedText>
      <FlatList
        data={[]}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => null}
        ListEmptyComponent={
          <ThemedText type="small" style={{ marginTop: Spacing.four }}>
            Aún no hay sugerencias — esta pantalla se conecta al motor de scoring en la Semana 5.
          </ThemedText>
        }
      />
    </ThemedView>
  );
}
