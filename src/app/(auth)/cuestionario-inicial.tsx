import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioCuestionario, type RespuestasCuestionario } from '@/components/FormularioCuestionario';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { generarEmbedding, parsearPerfil } from '@/lib/aiService';
import { geocodificarDireccion } from '@/lib/mapbox';
import { construirTextoPerfil } from '@/lib/perfilTexto';
import { supabase } from '@/lib/supabase';
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

    // Semana 8: el texto libre solo aporta nivel_ruido (no se pregunta directo
    // porque no quedaba claro para qué servía) — fuma/mascotas ya vienen de los
    // switches explícitos y esos ganan siempre, nunca se pisan con la inferencia
    // de la IA. Si el microservicio falla o no hay texto, sigue el flujo igual
    // (sección 17: nunca bloquear el registro por esto).
    let nivelRuido: 'bajo' | 'medio' | 'alto' | null = null;
    if (respuestas.textoLibre) {
      try {
        const parseo = await parsearPerfil(respuestas.textoLibre);
        nivelRuido = parseo.nivel_ruido;
      } catch (e) {
        console.warn('parsearPerfil falló, se sigue sin nivel_ruido inferido:', e);
      }
      // Guardar el texto cifrado es independiente del parseo — si esto falla
      // (ej. no se configuró app.perfil_encryption_key todavía) tampoco bloquea.
      // supabase.rpc() regresa {error} en vez de aventar excepción, así que se
      // revisa explícito en vez de un try/catch que no atraparía nada.
      const { error: errorGuardarTexto } = await supabase.rpc('guardar_perfil_texto', {
        texto: respuestas.textoLibre,
      });
      if (errorGuardarTexto) console.warn('guardar_perfil_texto falló:', errorGuardarTexto);
    }

    // Semana 9: embedding del perfil para el Nivel 2 (similitud de coseno,
    // sección 15) — se genera de texto estructurado + libre, gratis y local
    // (no necesita ANTHROPIC_API_KEY). Si el microservicio no responde, el
    // perfil_vector queda null y las sugerencias simplemente usan solo Nivel 1
    // para esta persona (nunca bloquea el registro, sección 17).
    const textoPerfil = construirTextoPerfil({
      universidad: respuestas.universidad,
      presupuestoMin: respuestas.presupuestoMin,
      presupuestoMax: respuestas.presupuestoMax,
      mascotas: respuestas.mascotas,
      fuma: respuestas.fuma,
      textoLibre: respuestas.textoLibre,
    });
    let perfilVector: number[] | null = null;
    try {
      perfilVector = await generarEmbedding(textoPerfil);
    } catch (e) {
      console.warn('generarEmbedding (perfil) falló, se sigue sin él:', e);
    }

    await actualizarPerfil(session.user.id, {
      universidad: respuestas.universidad,
      presupuesto_min: respuestas.presupuestoMin,
      presupuesto_max: respuestas.presupuestoMax,
      mascotas: respuestas.mascotas,
      fuma: respuestas.fuma,
      busca_roomie: respuestas.buscaRoomie,
      ...(nivelRuido ? { nivel_ruido: nivelRuido } : {}),
      ...(perfilVector ? { perfil_vector: perfilVector } : {}),
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
