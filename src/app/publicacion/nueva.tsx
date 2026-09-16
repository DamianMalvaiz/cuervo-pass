import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// TODO (Semana 3): formulario completo (dirección, precio, descripción, fotos, WhatsApp)
// + geocoding con Mapbox (Semana 4) + embedding de la descripción (Semana 9).
export default function NuevaPublicacionScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Nueva publicación</ThemedText>
      <ThemedText type="small">Formulario pendiente — Semana 3.</ThemedText>
    </ThemedView>
  );
}
