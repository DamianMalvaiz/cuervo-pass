import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 6): foto, biografía y datos de compatibilidad del candidato, botón de chat y reportar.
// Esta es la pantalla que le da confianza a alguien como Karla (persona del doc) que no puede
// visitar antes de mudarse.
export default function PerfilRoomieScreen() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Perfil</ThemedText>
      <ThemedText type="small">usuarioId: {usuarioId}</ThemedText>
    </ThemedView>
  );
}
