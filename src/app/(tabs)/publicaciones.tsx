import { router } from 'expo-router';
import { FlatList, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 3): CRUD completo contra `publicaciones.service.ts`.
export default function PublicacionesScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Mis publicaciones</ThemedText>
      <Pressable onPress={() => router.push('/publicacion/nueva')} style={{ marginVertical: Spacing.three }}>
        <ThemedText style={{ color: '#208AEF' }}>+ Nueva publicación</ThemedText>
      </Pressable>
      <FlatList
        data={[]}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={() => null}
        ListEmptyComponent={<ThemedText type="small">Aún no tienes publicaciones — crea la primera.</ThemedText>}
      />
    </ThemedView>
  );
}
