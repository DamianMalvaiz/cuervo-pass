import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { BurbujaMensaje } from '@/components/BurbujaMensaje';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import {
  enviarMensaje,
  listarMensajes,
  marcarConversacionComoLeida,
  PAGINA_MENSAJES,
  suscribirseAConversacion,
} from '@/services/mensajes.service';
import { obtenerPerfilPublico } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import { MENSAJES_VACIO, useChatStore } from '@/store/useChatStore';
import type { Conversacion } from '@/types/database.types';

// Documento maestro v5 · §15 (realtime y paginación), §26 (la ruta ahora es la
// conversación, no el otro usuario).
//
// La ruta cambió de chat/[usuarioId] a chat/[conversacionId] porque el hilo
// existe en la base: antes la "conversación" era una convención del cliente
// (el par de ids) que no correspondía a ninguna fila.
export default function ConversacionScreen() {
  const theme = useTheme();
  const { conversacionId } = useLocalSearchParams<{ conversacionId: string }>();
  const session = useAuthStore((s) => s.session);
  const miId = session?.user.id;

  const mensajes = useChatStore((s) => s.mensajesPorConversacion[conversacionId ?? ''] ?? MENSAJES_VACIO);
  const setMensajes = useChatStore((s) => s.setMensajes);
  const agregarMensaje = useChatStore((s) => s.agregarMensaje);
  const actualizarMensaje = useChatStore((s) => s.actualizarMensaje);

  const [nombreOtro, setNombreOtro] = useState('Conversación');
  const [cargando, setCargando] = useState(true);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayMasAntiguos, setHayMasAntiguos] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listaRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!miId || !conversacionId) return;
    let activo = true;
    (async () => {
      const [{ data: conversacion }, pagina] = await Promise.all([
        supabase.from('conversaciones').select('*').eq('id', conversacionId).maybeSingle(),
        listarMensajes(conversacionId),
      ]);
      if (!activo) return;

      setMensajes(conversacionId, pagina);
      setHayMasAntiguos(pagina.length === PAGINA_MENSAJES);
      setCargando(false);

      const fila = conversacion as Conversacion | null;
      if (fila) {
        const otroId = fila.usuario_a === miId ? fila.usuario_b : fila.usuario_a;
        const perfil = await obtenerPerfilPublico(otroId).catch(() => null);
        // §27: si la contraparte eliminó su cuenta, la conversación se queda sin
        // el otro lado. Se dice, en vez de mostrar una pantalla anónima.
        if (activo) setNombreOtro(perfil?.nombre_completo ?? 'Usuario no disponible');
      }

      marcarConversacionComoLeida(conversacionId, miId).catch(() => {});
    })();
    return () => {
      activo = false;
    };
  }, [miId, conversacionId, setMensajes]);

  useEffect(() => {
    if (!miId || !conversacionId) return;
    // El filtro va en el servidor (`conversacion_id=eq.…`): antes llegaban TODOS
    // los mensajes del usuario a cada pantalla abierta y se descartaban aquí.
    return suscribirseAConversacion(conversacionId, (mensaje, evento) => {
      if (evento === 'UPDATE') {
        // Ej. el otro lado marcó como leído — actualiza la burbuja en vivo
        // (✓ → ✓✓) sin esperar a reabrir la conversación.
        actualizarMensaje(conversacionId, mensaje);
        return;
      }
      // agregarMensaje deduplica por id: un mensaje propio se agrega al
      // enviarlo y el eco de Realtime del mismo insert llega después.
      agregarMensaje(conversacionId, mensaje);
      if (mensaje.remitente_id !== miId) {
        marcarConversacionComoLeida(conversacionId, miId).catch(() => {});
      }
    });
  }, [miId, conversacionId, agregarMensaje, actualizarMensaje]);

  // AUD-09: paginación por cursor hacia atrás. v3 cargaba la conversación
  // completa en memoria cada vez que se abría.
  const cargarAnteriores = useCallback(async () => {
    if (!conversacionId || cargandoAnteriores || !hayMasAntiguos || mensajes.length === 0) return;
    setCargandoAnteriores(true);
    try {
      const anteriores = await listarMensajes(conversacionId, mensajes[0].creado_en);
      if (anteriores.length === 0) {
        setHayMasAntiguos(false);
        return;
      }
      setMensajes(conversacionId, [...anteriores, ...mensajes]);
      setHayMasAntiguos(anteriores.length === PAGINA_MENSAJES);
    } finally {
      setCargandoAnteriores(false);
    }
  }, [conversacionId, cargandoAnteriores, hayMasAntiguos, mensajes, setMensajes]);

  const onEnviar = useCallback(async () => {
    const contenido = texto.trim();
    if (!contenido || !miId || !conversacionId || enviando) return;
    setTexto('');
    setError(null);
    setEnviando(true);
    try {
      const mensaje = await enviarMensaje(conversacionId, miId, contenido);
      agregarMensaje(conversacionId, mensaje);
    } catch {
      // Se devuelve el texto al campo en vez de perderlo, y se dice qué pasó.
      setTexto(contenido);
      setError('No se pudo enviar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }, [texto, miId, conversacionId, enviando, agregarMensaje]);

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
            ListHeaderComponent={
              hayMasAntiguos && mensajes.length > 0 ? (
                <Pressable
                  onPress={cargarAnteriores}
                  style={styles.botonAnteriores}
                  accessibilityRole="button"
                  accessibilityLabel="Cargar mensajes anteriores"
                >
                  {cargandoAnteriores ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <ThemedText type="small" style={{ color: AppColors.primary }}>
                      Ver mensajes anteriores
                    </ThemedText>
                  )}
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <ThemedText type="small" style={styles.vacio}>
                Aún no hay mensajes — escribe el primero.
              </ThemedText>
            }
          />
        )}

        {error && (
          <ThemedText type="small" style={styles.error} accessibilityLiveRegion="assertive">
            {error}
          </ThemedText>
        )}

        <View style={[styles.filaInput, { borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Mensaje"
            value={texto}
            onChangeText={setTexto}
            // Mismo tope que el CHECK de la tabla (migración 0012). Ambas capas,
            // siempre: el cliente para avisar, la base para garantizar.
            maxLength={2000}
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
  error: { color: AppColors.destructiveRed, paddingHorizontal: Spacing.three },
  botonAnteriores: { alignItems: 'center', paddingVertical: Spacing.two, minHeight: 44, justifyContent: 'center' },
  filaInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxHeight: 100,
  },
  botonEnviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
