import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  FormularioPublicacion,
  type ControlPublicacion,
} from '@/components/FormularioPublicacion';
import { PieFijo } from '@/components/ficha/PieFijo';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { actualizarPublicacion, obtenerMiPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';
import { aviso } from '@/lib/registro';

export default function EditarPublicacionScreen() {
  const formulario = useRef<ControlPublicacion>(null);
  const [guardando, setGuardando] = useState(false);
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const [publicacion, setPublicacion] = useState<Publicacion | null>(null);
  const [cargando, setCargando] = useState(true);
  // END-11 · Un estado APARTE, no un `publicacion` en null.
  //
  // Este `.catch` dejaba la publicación en null, y la pantalla entonces decía
  // «No se encontró esta publicación». Se cae el wifi y la app te afirma que tu
  // propia publicación ya no existe — la misma acusación inventada que END-11
  // corrigió en la ficha pública, en una pantalla que aquella orden no tocó.
  const [fallo, setFallo] = useState(false);

  // `consultar` NO reinicia el estado: lo hace `reintentar`. Si lo hiciera, el
  // efecto de abajo estaría llamando a `setState` de forma síncrona en su
  // cuerpo —renders en cascada, y el compilador de React lo marca como error—
  // y además sería redundante: el estado inicial ya es «cargando, sin fallo».
  const consultar = useCallback(() => {
    if (!id) return;
    // `obtenerMiPublicacion` lee la TABLA, no la vista pública: la vista no trae
    // `whatsapp`, y aquí hace falta para poder editarlo. La policy
    // publicaciones_select_propias garantiza que solo funcione con las propias.
    obtenerMiPublicacion(id)
      .then(setPublicacion)
      .catch((e) => {
        aviso('obtenerMiPublicacion falló', undefined, e);
        setFallo(true);
      })
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const reintentar = useCallback(() => {
    setCargando(true);
    setFallo(false);
    consultar();
  }, [consultar]);

  if (cargando) {
    return (
      <ThemedView style={styles.centrado}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText type="etiqueta" themeColor="textSecondary">
          CONSULTANDO LA PUBLICACIÓN
        </ThemedText>
      </ThemedView>
    );
  }

  // El fallo va PRIMERO y no comparte pantalla con el vacío: son dos cosas
  // distintas y la persona hace algo distinto con cada una.
  if (fallo) {
    return (
      <ThemedView style={styles.centrado}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.error} />
        <ThemedText type="etiqueta" themeColor="error">
          NO PUDIMOS CONSULTAR
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.textoCentrado}>
          No pudimos abrir tu publicación para editarla. Revisa tu conexión y reintenta.
        </ThemedText>
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </ThemedView>
    );
  }

  if (!publicacion) {
    return (
      <ThemedView style={styles.centrado}>
        <ThemedText>No se encontró esta publicación.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, clase === 'amplia' && styles.centradoAmplio]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.columna, { maxWidth: anchoContenido }]}>
            <View style={styles.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                MODIFICACIÓN DE PUBLICACIÓN
              </ThemedText>
              <ThemedText type="title">Editar publicación</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.explicacion}>
                Al guardar se vuelve a geocodificar la dirección y se regenera el vector de la publicación.
              </ThemedText>
              <View style={[styles.filete, { backgroundColor: theme.text }]} />
            </View>
          <FormularioPublicacion
              ref={formulario}
              botonEnPie
              onEstadoEnvio={setGuardando}
            textoBoton="Guardar cambios"
            valoresIniciales={{
              titulo: publicacion.titulo,
              tipo: publicacion.tipo,
              direccion: publicacion.direccion,
              precioRenta: String(publicacion.precio_renta),
              descripcion: publicacion.descripcion ?? '',
              permiteMascotas: publicacion.permite_mascotas,
              amueblado: publicacion.amueblado,
              serviciosIncluidos: publicacion.servicios_incluidos,
              recamaras: String(publicacion.recamaras),
              whatsapp: publicacion.whatsapp,
            }}
            fotosIniciales={publicacion.fotos ?? []}
            onGuardar={async (datos) => {
              if (!session?.user.id) return;
              await actualizarPublicacion(publicacion.id, {
                usuarioId: session.user.id,
                titulo: datos.titulo,
                tipo: datos.tipo,
                direccion: datos.direccion,
                precioRenta: Number(datos.precioRenta),
                descripcion: datos.descripcion,
                permiteMascotas: datos.permiteMascotas,
                amueblado: datos.amueblado,
                serviciosIncluidos: datos.serviciosIncluidos,
                recamaras: Number(datos.recamaras),
                whatsapp: datos.whatsapp,
                fotos: datos.fotos,
              });
              router.replace(`/publicacion/${publicacion.id}`);
            }}
          />
          </View>
        </ScrollView>

        {/* Dieciséis campos: el botón al final obligaba a deslizar hasta abajo
            para confirmar, y mientras editabas un campo de en medio no había
            ninguna pista de que existiera una acción pendiente. */}
        <PieFijo>
          <Sello
            onPress={() => formulario.current?.enviar()}
            cargando={guardando}
            accessibilityLabel="Guardar cambios"
          >
            Guardar cambios
          </Sello>
        </PieFijo>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  textoCentrado: { textAlign: 'center', lineHeight: 20 },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  membrete: { gap: Spacing.one, paddingTop: Spacing.two },
  explicacion: { lineHeight: 20 },
  filete: { height: Filete.grueso, marginTop: Spacing.two },
});
