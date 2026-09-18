import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioCuestionario, type RespuestasCuestionario } from '@/components/FormularioCuestionario';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { generarEmbedding, parsearPerfil } from '@/lib/aiService';
import { geocodificarDireccion } from '@/lib/geocoding';
import { construirTextoPerfil } from '@/lib/perfilTexto';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Documento maestro v5 · §26 (el tercer estado de navegación) y §29.
export default function CuestionarioInicialScreen() {
  const session = useAuthStore((s) => s.session);
  const actualizarPerfil = usePerfilStore((s) => s.actualizarPerfil);

  const onCompletar = async (respuestas: RespuestasCuestionario) => {
    if (!session?.user.id) return;

    // Universidad conocida (lista curada) trae coordenadas ya verificadas — solo
    // se geocodifica texto libre para "Otra". Nunca bloquea el flujo si falla (§27).
    const coords = respuestas.universidadCoords ?? (await geocodificarDireccion(respuestas.universidad));

    // ═══ §29 · AUD-23 — el camino SIN IA ═══
    // Sin consentimiento explícito: no se llama al modelo, no se genera vector,
    // y esta persona recibe sugerencias de Nivel 1. No es una cortesía: es la
    // diferencia entre un consentimiento real y una casilla decorativa.
    //
    // Y tiene un beneficio práctico inesperado: obliga a que el camino sin IA
    // funcione perfectamente, que es exactamente el camino al que degrada el
    // sistema cuando el microservicio se cae.
    const usaIa = respuestas.consienteIa;

    // El nivel de ruido ahora se pregunta directo; el parseo del texto libre
    // solo aporta el horario predominante, que sí es incómodo de preguntar. Los
    // switches explícitos (fuma, mascotas) ganan SIEMPRE sobre la inferencia.
    let horario: 'diurno' | 'nocturno' | 'mixto' | null = null;
    if (usaIa && respuestas.textoLibre) {
      try {
        const parseo = await parsearPerfil(respuestas.textoLibre);
        if (!parseo.degradado) horario = parseo.horario_predominante;
      } catch (e) {
        console.warn('parsearPerfil falló, se sigue sin horario inferido:', e);
      }
    }

    // §30: el texto libre se guarda en claro. El cifrado de v3 no protegía nada
    // —la clave viajaba en la consulta, el vector derivado quedaba legible y el
    // resto de los datos sensibles nunca estuvo cifrado—. Lo que protege este
    // campo es el control de acceso: la vista `perfiles_publicos` no lo expone.
    const textoPerfil = construirTextoPerfil({
      universidad: respuestas.universidad,
      presupuestoMin: respuestas.presupuestoMin,
      presupuestoMax: respuestas.presupuestoMax,
      mascotas: respuestas.mascotas,
      fuma: respuestas.fuma,
      nivelRuido: respuestas.nivelRuido,
      textoLibre: respuestas.textoLibre,
    });

    let perfilVector: number[] | null = null;
    if (usaIa) {
      try {
        perfilVector = await generarEmbedding(textoPerfil);
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
      // Si no consintió, el vector se limpia: así "quitar el consentimiento"
      // tiene efecto de verdad y no deja el embedding anterior dando vueltas.
      perfil_vector: perfilVector,
      latitud_universidad: coords?.lat ?? null,
      longitud_universidad: coords?.lng ?? null,
      // Se escribe AL FINAL, cuando ya quedó todo lo demás: es lo que el guard
      // de §26 lee para decidir si esta persona puede entrar a las pestañas.
      cuestionario_completo: true,
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
