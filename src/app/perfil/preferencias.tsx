import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioCuestionario, type RespuestasCuestionario } from '@/components/FormularioCuestionario';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { generarEmbedding, parsearPerfil } from '@/lib/aiService';
import { geocodificarDireccion } from '@/lib/geocoding';
import { construirTextoPerfil } from '@/lib/perfilTexto';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Documento maestro v5 · §25 — el cuestionario es editable, no una pregunta de
// una sola vez. Cambiar de presupuesto, de universidad o de consentimiento para
// la IA no debería exigir crear otra cuenta.
//
// Reutiliza el MISMO formulario del alta: si la validación y los campos vivieran
// en dos lugares, tarde o temprano divergen y solo uno de los dos coincide con
// los CHECK de la tabla.
export default function PreferenciasScreen() {
  const session = useAuthStore((s) => s.session);
  const { perfil, actualizarPerfil } = usePerfilStore();

  const onCompletar = async (respuestas: RespuestasCuestionario) => {
    if (!session?.user.id) return;

    const coords = respuestas.universidadCoords ?? (await geocodificarDireccion(respuestas.universidad));
    const usaIa = respuestas.consienteIa;

    let horario: 'diurno' | 'nocturno' | 'mixto' | null = null;
    if (usaIa && respuestas.textoLibre) {
      try {
        const parseo = await parsearPerfil(respuestas.textoLibre);
        if (!parseo.degradado) horario = parseo.horario_predominante;
      } catch (e) {
        console.warn('parsearPerfil falló, se sigue sin horario inferido:', e);
      }
    }

    let perfilVector: number[] | null = null;
    if (usaIa) {
      try {
        perfilVector = await generarEmbedding(
          construirTextoPerfil({
            universidad: respuestas.universidad,
            presupuestoMin: respuestas.presupuestoMin,
            presupuestoMax: respuestas.presupuestoMax,
            mascotas: respuestas.mascotas,
            fuma: respuestas.fuma,
            nivelRuido: respuestas.nivelRuido,
            textoLibre: respuestas.textoLibre,
          })
        );
      } catch (e) {
        console.warn('generarEmbedding (perfil) falló, se sigue sin él:', e);
      }
    }

    await actualizarPerfil(session.user.id, {
      universidad: respuestas.universidad,
      presupuesto_min: respuestas.presupuestoMin,
      presupuesto_max: respuestas.presupuestoMax,
      distancia_max_km: respuestas.distanciaMaxKm,
      mascotas: respuestas.mascotas,
      fuma: respuestas.fuma,
      nivel_ruido: respuestas.nivelRuido,
      busca_roomie: respuestas.buscaRoomie,
      perfil_texto: respuestas.textoLibre ?? null,
      consiente_analisis_ia: usaIa,
      ...(horario ? { horario_predominante: horario } : {}),
      // Retirar el consentimiento borra el vector: si no, el embedding anterior
      // seguiría ordenando las sugerencias con un texto que la persona ya dijo
      // que no quiere que analicemos.
      perfil_vector: perfilVector,
      latitud_universidad: coords?.lat ?? null,
      longitud_universidad: coords?.lng ?? null,
    });
    router.back();
  };

  if (!perfil) {
    return (
      <ThemedView style={styles.centrado}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" style={styles.subtitulo}>
            Esto define qué publicaciones ves y en qué orden.
          </ThemedText>
          <FormularioCuestionario
            textoBoton="Guardar preferencias"
            valoresIniciales={{
              universidad: perfil.universidad ?? undefined,
              presupuestoMin: perfil.presupuesto_min ?? undefined,
              presupuestoMax: perfil.presupuesto_max ?? undefined,
              distanciaMaxKm: perfil.distancia_max_km ?? undefined,
              mascotas: perfil.mascotas,
              fuma: perfil.fuma,
              nivelRuido: perfil.nivel_ruido ?? 'medio',
              buscaRoomie: perfil.busca_roomie,
              textoLibre: perfil.perfil_texto ?? undefined,
              consienteIa: perfil.consiente_analisis_ia,
            }}
            onCompletar={onCompletar}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
  subtitulo: { marginBottom: Spacing.three },
});
