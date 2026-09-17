import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioCuestionario, type RespuestasCuestionario } from '@/components/FormularioCuestionario';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { geocodificarDireccion } from '@/lib/mapbox';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Entre registro y (tabs) — sección 10 del doc maestro (flujo de navegación).
export default function CuestionarioInicialScreen() {
  const session = useAuthStore((s) => s.session);
  const actualizarPerfil = usePerfilStore((s) => s.actualizarPerfil);

  const onCompletar = async (respuestas: RespuestasCuestionario) => {
    if (!session?.user.id) return;
    // Universidad conocida (lista curada) trae coordenadas ya verificadas — solo
    // se geocodifica texto libre para "Otra", con las limitaciones que eso implica
    // (nombres/abreviaturas ambiguos pueden no ubicarse bien; ver lib/universidades.ts).
    // Nunca bloquea el flujo si Mapbox falla (sección 17).
    const coords = respuestas.universidadCoords ?? (await geocodificarDireccion(respuestas.universidad));
    await actualizarPerfil(session.user.id, {
      universidad: respuestas.universidad,
      presupuesto_min: respuestas.presupuestoMin,
      presupuesto_max: respuestas.presupuestoMax,
      mascotas: respuestas.mascotas,
      fuma: respuestas.fuma,
      busca_roomie: respuestas.buscaRoomie,
      latitud_universidad: coords?.lat ?? null,
      longitud_universidad: coords?.lng ?? null,
    });
    router.replace('/(tabs)/inicio');
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.titulo}>
            Cuéntanos de ti
          </ThemedText>
          <ThemedText type="small" style={styles.subtitulo}>
            Esto alimenta tus sugerencias de departamento y roomie
          </ThemedText>
          <FormularioCuestionario onCompletar={onCompletar} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
  titulo: { fontSize: 28, lineHeight: 34 },
  subtitulo: { marginBottom: Spacing.three },
});
