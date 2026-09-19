import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  FormularioCuestionario,
  type ControlCuestionario,
  type RespuestasCuestionario,
} from '@/components/FormularioCuestionario';
import { PieFijo } from '@/components/ficha/PieFijo';
import { Sello } from '@/components/ficha/Sello';
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

// Documento maestro v5 · §25 — el cuestionario es editable, no una pregunta de
// una sola vez. Cambiar de presupuesto, de universidad o de consentimiento para
// la IA no debería exigir crear otra cuenta.
//
// Reutiliza el MISMO formulario del alta: si la validación y los campos vivieran
// en dos lugares, tarde o temprano divergen y solo uno de los dos coincide con
// los CHECK de la tabla.
export default function PreferenciasScreen() {
  const theme = useTheme();
  const formulario = useRef<ControlCuestionario>(null);
  const [guardando, setGuardando] = useState(false);
  const { anchoContenido, clase } = useTamanoPantalla();
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

    const teniaVector = Boolean(perfil?.perfil_vector);
    const resultadoVector = await resolverPerfilVector(
      usaIa,
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
      //
      // Pero SOLO si lo retiró de verdad. Cuando el servicio falla, campoVector
      // no manda la columna y el vector anterior sobrevive: antes un fallo de
      // red lo borraba igual que un "no consiento", y nadie se enteraba.
      ...campoVector(resultadoVector),
      latitud_universidad: coords?.lat ?? null,
      longitud_universidad: coords?.lng ?? null,
    });

    const aviso = avisoVector(resultadoVector, teniaVector);
    if (aviso) {
      Alert.alert(aviso.titulo, aviso.cuerpo, [{ text: 'Entendido', onPress: () => router.back() }]);
      return;
    }
    router.back();
  };

  if (!perfil) {
    return (
      <ThemedView style={styles.centrado}>
        <ActivityIndicator color={theme.acento} />
        <ThemedText type="etiqueta" themeColor="textSecondary">
          CONSULTANDO TU FICHA
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.pantalla}>
      <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, clase === 'amplia' && styles.centradoAmplio]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.columna, { maxWidth: anchoContenido }]}>
            {/* Decir de entrada qué HACE este formulario: no son gustos, es el
                corte que decide qué publicaciones existen para ti. */}
            <View style={styles.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                FICHA DE BÚSQUEDA
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.explicacion}>
                Esto define qué publicaciones ves y en qué orden. El presupuesto y la distancia son
                filtros duros: lo que quede fuera no aparece.
              </ThemedText>
              <View style={[styles.filete, { backgroundColor: theme.text }]} />
            </View>

            <FormularioCuestionario
              ref={formulario}
              botonEnPie
              onEstadoEnvio={setGuardando}
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
          </View>
        </ScrollView>

        {/* La acción fija al pie: en un formulario de cinco secciones, el botón
            al final obliga a deslizar hasta abajo para confirmar, y mientras
            editas un campo de en medio no hay ninguna pista de que exista una
            acción pendiente. */}
        <PieFijo>
          <Sello
            onPress={() => formulario.current?.enviar()}
            cargando={guardando}
            accessibilityLabel="Guardar preferencias"
          >
            Guardar preferencias
          </Sello>
        </PieFijo>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  membrete: { gap: Spacing.one, paddingTop: Spacing.two },
  explicacion: { lineHeight: 20 },
  filete: { height: Filete.grueso, marginTop: Spacing.two },
});
