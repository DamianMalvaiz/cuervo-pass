import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 6): burbujas de mensaje (BurbujaMensaje), suscripción a Supabase Realtime,
// orden siempre por creado_en (ver useChatStore.agregarMensaje).
export default function ConversacionScreen() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Conversación</ThemedText>
      <ThemedText type="small">con usuarioId: {usuarioId}</ThemedText>
    </ThemedView>
  );
}
