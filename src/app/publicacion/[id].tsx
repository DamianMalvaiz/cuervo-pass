import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 3): carrusel de fotos, mapa, botón de WhatsApp (BotonWhatsApp), botón de reportar.
export default function DetallePublicacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Publicación</ThemedText>
      <ThemedText type="small">id: {id}</ThemedText>
    </ThemedView>
  );
}
