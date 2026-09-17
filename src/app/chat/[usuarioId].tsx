import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BurbujaMensaje } from '@/components/BurbujaMensaje';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  enviarMensaje,
  listarConversacion,
  marcarConversacionComoLeida,
  suscribirseAMensajes,
} from '@/services/mensajes.service';
import { obtenerUsuarioPublico } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import { MENSAJES_VACIO, useChatStore } from '@/store/useChatStore';

// Sección 9/14: burbujas de mensaje, campo de texto, indicador de leído — en
// vivo vía Supabase Realtime (migración 0004). Orden siempre por creado_en,
// nunca por el orden de llegada del websocket (sección 17, useChatStore ya lo hace).
export default function ConversacionScreen() {
  const theme = useTheme();
  const { usuarioId: otroUsuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const session = useAuthStore((s) => s.session);
  const miId = session?.user.id;

  const mensajes = useChatStore((s) => s.mensajesPorConversacion[otroUsuarioId ?? ''] ?? MENSAJES_VACIO);
  const setMensajes = useChatStore((s) => s.setMensajes);
  const agregarMensaje = useChatStore((s) => s.agregarMensaje);
  const actualizarMensaje = useChatStore((s) => s.actualizarMensaje);

  const [nombreOtro, setNombreOtro] = useState('Conversación');
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!miId || !otroUsuarioId) return;
    let activo = true;
    (async () => {
      const [historial, otroUsuario] = await Promise.all([
        listarConversacion(miId, otroUsuarioId),
        obtenerUsuarioPublico(otroUsuarioId).catch(() => null),
      ]);
      if (!activo) return;
      setMensajes(otroUsuarioId, historial);
      if (otroUsuario) setNombreOtro(otroUsuario.nombre_completo);
      setCargando(false);
      marcarConversacionComoLeida(miId, otroUsuarioId).catch(() => {});
    })();
    return () => {
      activo = false;
    };
  }, [miId, otroUsuarioId, setMensajes]);

  useEffect(() => {
    if (!miId || !otroUsuarioId) return;
    return suscribirseAMensajes((mensaje, evento) => {
      const esDeEstaConversacion =
        (mensaje.remitente_id === otroUsuarioId && mensaje.destinatario_id === miId) ||
        (mensaje.remitente_id === miId && mensaje.destinatario_id === otroUsuarioId);
      if (!esDeEstaConversacion) return;

      if (evento === 'UPDATE') {
        // Ej. el otro lado marcó como leído — actualiza la burbuja en vivo
        // (✓ -> ✓✓) sin esperar a reabrir la conversación.
        actualizarMensaje(otroUsuarioId, mensaje);
        return;
      }

      // agregarMensaje deduplica por id (útil para el eco de mi propio envío) — ver useChatStore.
      agregarMensaje(otroUsuarioId, mensaje);
      if (mensaje.remitente_id === otroUsuarioId) {
        marcarConversacionComoLeida(miId, otroUsuarioId).catch(() => {});
      }
    });
  }, [miId, otroUsuarioId, agregarMensaje, actualizarMensaje]);

  const onEnviar = useCallback(async () => {
    const contenido = texto.trim();
    if (!contenido || !miId || !otroUsuarioId || enviando) return;
    setTexto('');
    setEnviando(true);
    try {
      const mensaje = await enviarMensaje(miId, otroUsuarioId, contenido);
      agregarMensaje(otroUsuarioId, mensaje);
    } catch {
      setTexto(contenido);
    } finally {
      setEnviando(false);
    }
  }, [texto, miId, otroUsuarioId, enviando, agregarMensaje]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: nombreOtro }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {cargando ? (
          <ActivityIndicator style={{ marginTop: Spacing.four }} />
        ) : (
          <FlatList
            ref={listaRef}
            data={mensajes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.lista}
            renderItem={({ item }) => <BurbujaMensaje mensaje={item} esPropio={item.remitente_id === miId} />}
            onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <ThemedText type="small" style={styles.vacio}>
                Aún no hay mensajes — escribe el primero.
              </ThemedText>
            }
          />
        )}

        <View style={[styles.filaInput, { borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Mensaje"
            value={texto}
            onChangeText={setTexto}
            multiline
          />
          <Pressable
            onPress={onEnviar}
            disabled={!texto.trim() || enviando}
            style={[styles.botonEnviar, { opacity: !texto.trim() || enviando ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.three, flexGrow: 1, justifyContent: 'flex-end' },
  vacio: { textAlign: 'center', marginTop: Spacing.four },
  filaInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: 1,
  },
  input: { flex: 1, borderWidth: 1, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, maxHeight: 100 },
  botonEnviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
