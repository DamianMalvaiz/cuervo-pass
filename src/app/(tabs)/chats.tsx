import { FlatList } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 6): lista de conversaciones vía Supabase Realtime.
export default function ChatsScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Chats</ThemedText>
      <FlatList
        data={[]}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => null}
        ListEmptyComponent={<ThemedText type="small">Aún no tienes conversaciones.</ThemedText>}
      />
    </ThemedView>
  );
}
