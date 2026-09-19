import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { FormularioCuestionario, type RespuestasCuestionario } from '@/components/FormularioCuestionario';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { parsearPerfil } from '@/lib/aiService';
import { geocodificarDireccion } from '@/lib/geocoding';
import { construirTextoPerfil } from '@/lib/perfilTexto';
import { avisoVector, campoVector, resolverPerfilVector } from '@/lib/perfilVector';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Documento maestro v5 · §26 (el tercer estado de navegación) y §29.
export default function CuestionarioInicialScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
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

    const resultadoVector = await resolverPerfilVector(usaIa, textoPerfil);

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
      // Un fallo del servicio NO cuenta como no consentir (ver perfilVector.ts).
      ...campoVector(resultadoVector),
      latitud_universidad: coords?.lat ?? null,
      longitud_universidad: coords?.lng ?? null,
      // Se escribe AL FINAL, cuando ya quedó todo lo demás: es lo que el guard
      // de §26 lee para decidir si esta persona puede entrar a las pestañas.
      cuestionario_completo: true,
    });

    const aviso = avisoVector(resultadoVector, false);
    if (aviso) {
      Alert.alert(aviso.titulo, aviso.cuerpo, [
        { text: 'Entendido', onPress: () => router.replace('/(tabs)/inicio') },
      ]);
      return;
    }
    router.replace('/(tabs)/inicio');
  };

  return (
    <ThemedView style={styles.pantalla}>
      <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, clase === 'amplia' && styles.centradoAmplio]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.columna, { maxWidth: anchoContenido }]}>
            {/* Es la primera pantalla tras crear la cuenta, así que dice PARA QUÉ
                sirve contestar. Un cuestionario sin propósito declarado se
                contesta a la carrera, y sus respuestas son el filtro duro que
                decide qué publicaciones existen para esta persona. */}
            <View style={styles.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                ALTA DE FICHA DE BÚSQUEDA · PASO 2 DE 2
              </ThemedText>
              <ThemedText type="title">Cuéntanos de ti</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.explicacion}>
                Con esto calculamos tus sugerencias. El presupuesto y la distancia son
                filtros duros: lo que quede fuera no aparece. Puedes cambiarlo cuando
                quieras desde Mi perfil.
              </ThemedText>
              <View style={[styles.filete, { backgroundColor: theme.text }]} />
            </View>

            <FormularioCuestionario onCompletar={onCompletar} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  membrete: { gap: Spacing.one, paddingTop: Spacing.two },
  explicacion: { lineHeight: 20 },
  filete: { height: Filete.grueso, marginTop: Spacing.two },
});
