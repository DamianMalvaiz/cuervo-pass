import { FlatList } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 6): lista de roomings + matching por afinidad (Semana 10 con embeddings).
export default function RoomingsScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Roomings</ThemedText>
      <FlatList
        data={[]}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => null}
        ListEmptyComponent={<ThemedText type="small">Aún no hay roomies buscando — esta sección se activa en la Semana 6.</ThemedText>}
      />
    </ThemedView>
  );
}
