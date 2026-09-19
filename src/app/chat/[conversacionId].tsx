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
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Filete, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import {
  enviarMensaje,
  cursorDe,
  listarMensajes,
  marcarConversacionComoLeida,
  PAGINA_MENSAJES,
  suscribirseAConversacion,
} from '@/services/mensajes.service';
import { obtenerPerfilPublico } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import { MENSAJES_VACIO, useChatStore } from '@/store/useChatStore';
import type { Conversacion } from '@/types/database.types';
import { aviso } from '@/lib/registro';
import { type MensajeLocal } from '@/store/useChatStore';

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
  const limpiarConversacion = useChatStore((s) => s.limpiarConversacion);
  const agregarOptimista = useChatStore((s) => s.agregarOptimista);
  const confirmarOptimista = useChatStore((s) => s.confirmarOptimista);
  const marcarFallido = useChatStore((s) => s.marcarFallido);
  const marcarEnviando = useChatStore((s) => s.marcarEnviando);

  const [nombreOtro, setNombreOtro] = useState('Conversación');
  const [cargando, setCargando] = useState(true);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayMasAntiguos, setHayMasAntiguos] = useState(true);
  const [texto, setTexto] = useState('');
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

  // END-19 · Soltar el historial al salir. El store nunca desalojaba nada:
  // abrir veinte chats en una sesión dejaba veinte historiales en memoria hasta
  // matar la app. Volver a entrar cuesta una consulta, que además está cacheada.
  useEffect(() => {
    if (!conversacionId) return;
    return () => limpiarConversacion(conversacionId);
  }, [conversacionId, limpiarConversacion]);

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
      // Cursor COMPUESTO. Con solo `creado_en`, dos mensajes del mismo instante
      // hacían que uno desapareciera al paginar: el primero cerraba la página y
      // el segundo caía fuera del `<`.
      const anteriores = await listarMensajes(conversacionId, cursorDe(mensajes));
      if (anteriores.length === 0) {
        setHayMasAntiguos(false);
        return;
      }
      setMensajes(conversacionId, [...anteriores, ...mensajes]);
      setHayMasAntiguos(anteriores.length === PAGINA_MENSAJES);
    } catch (e) {
      // END-20 · Antes solo había `finally`. Una página que fallaba no mostraba
      // NADA, y la persona concluía que no había más historial — la app
      // afirmando una ausencia que era un fallo de red.
      aviso('cargarAnteriores falló', undefined, e);
      setError('No pudimos cargar los mensajes anteriores. Desliza otra vez para reintentar.');
    } finally {
      setCargandoAnteriores(false);
    }
  }, [conversacionId, cargandoAnteriores, hayMasAntiguos, mensajes, setMensajes]);

  /**
   * END-20 · Envío optimista.
   *
   * La burbuja aparece ANTES del viaje de ida y vuelta. Esperar a que el
   * servidor confirme para pintar hace que escribir se sienta lento en
   * cualquier red que no sea la de una oficina.
   *
   * Y si falla, el texto NO vuelve al campo. Devolverlo se lee como que el
   * mensaje se borró: la persona ya lo había «mandado». La burbuja se queda en
   * su sitio marcada como fallida, con su reintento encima — que es lo que hace
   * cualquier app de mensajería y lo que la gente espera.
   */
  const enviarContenido = useCallback(
    async (contenido: string, idTemporal: string) => {
      if (!miId || !conversacionId) return;
      marcarEnviando(conversacionId, idTemporal);
      try {
        const mensaje = await enviarMensaje(conversacionId, miId, contenido);
        confirmarOptimista(conversacionId, idTemporal, mensaje);
      } catch (e) {
        aviso('enviarMensaje falló', undefined, e);
        marcarFallido(conversacionId, idTemporal);
      }
    },
    [miId, conversacionId, marcarEnviando, confirmarOptimista, marcarFallido]
  );

  const onEnviar = useCallback(() => {
    const contenido = texto.trim();
    if (!contenido || !miId || !conversacionId) return;
    setTexto('');
    setError(null);
    const idTemporal = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    agregarOptimista(conversacionId, { id: idTemporal, contenido, remitenteId: miId });
    void enviarContenido(contenido, idTemporal);
  }, [texto, miId, conversacionId, agregarOptimista, enviarContenido]);

  const onReintentar = useCallback(
    (mensaje: MensajeLocal) => void enviarContenido(mensaje.contenido, mensaje.id),
    [enviarContenido]
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: nombreOtro }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {cargando ? (
          <View style={styles.cargando}>
            <ActivityIndicator color={theme.textSecondary} />
            <ThemedText type="etiqueta" themeColor="textSecondary">
              CONSULTANDO EL HILO
            </ThemedText>
          </View>
        ) : (
          <FlatList
            ref={listaRef}
            data={mensajes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.lista}
            renderItem={({ item }) => (
              <BurbujaMensaje
                mensaje={item}
                esPropio={item.remitente_id === miId}
                onReintentar={onReintentar}
              />
            )}
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
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <>
                      <Ionicons name="chevron-up" size={14} color={theme.acento} />
                      <ThemedText type="small" themeColor="acento">
                        Ver mensajes anteriores
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <BloqueEstado
                etiqueta="HILO SIN MENSAJES"
                mensaje="Escribe el primero. Los mensajes son inmutables una vez enviados: no se pueden editar ni borrar."
                icono="chatbubble-ellipses-outline"
              />
            }
          />
        )}

        {error && (
          <View style={[styles.errorBloque, { borderColor: theme.error }]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
            <ThemedText
              type="small"
              themeColor="error"
              style={styles.textoError}
              accessibilityLiveRegion="assertive"
            >
              {error}
            </ThemedText>
          </View>
        )}

        <View style={[styles.filaInput, { borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="Escribe un mensaje…"
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
            disabled={!texto.trim()}
            style={[styles.botonEnviar, { opacity: !texto.trim() ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            {/* Enviar un mensaje SÍ compromete: escribe una fila inmutable que
                no se puede editar ni borrar (trigger de la 0012). Por eso lleva
                sello, y es el único ámbar de esta pantalla. */}
            <Ionicons name="send" size={18} color={AppColors.selloTexto} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.three, flexGrow: 1, justifyContent: 'flex-end', gap: Spacing.half },
  cargando: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two },
  errorBloque: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.two,
  },
  textoError: { flex: 1, lineHeight: 18 },
  botonAnteriores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  // El compositor se separa del hilo con filete, no con sombra: es la misma
  // regla que la barra de pestañas y que el encabezado.
  filaInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: Filete.fino,
  },
  input: {
    flex: 1,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
    maxHeight: 120,
    fontFamily: Tipografia.regular,
    fontSize: 16,
  },
  botonEnviar: {
    width: 48,
    height: 48,
    borderRadius: Radios.full,
    backgroundColor: AppColors.sello,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
