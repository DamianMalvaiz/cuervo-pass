import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formateadorHora } from '@/lib/formatoHora';
import {
  listarConversaciones,
  suscribirseAMisChats,
  type ResumenConversacion,
} from '@/services/mensajes.service';
import { useAuthStore } from '@/store/useAuthStore';

// Documento maestro v5 · §25. El nombre de la contraparte y el último mensaje
// ya vienen resueltos desde el servicio: antes esta pantalla pedía los perfiles
// aparte y armaba los hilos agrupando todos los mensajes del usuario.
export default function ChatsScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const [conversaciones, setConversaciones] = useState<ResumenConversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const idCargaActual = useRef(0);

  // `mostrarSpinner` es false para los refrescos disparados por Realtime — sin
  // esto, CADA mensaje entrante reemplazaba toda la lista por un spinner y
  // perdía el scroll. El contador descarta respuestas fuera de orden.
  const cargar = useCallback(
    async (mostrarSpinner: boolean) => {
      const miId = session?.user.id;
      if (!miId) return;
      const idCarga = ++idCargaActual.current;
      if (mostrarSpinner) setCargando(true);
      try {
        const resumenes = await listarConversaciones(miId);
        if (idCarga !== idCargaActual.current) return;
        setConversaciones(resumenes);
      } catch (e) {
        console.warn('listarConversaciones falló:', e);
      } finally {
        if (idCarga === idCargaActual.current) setCargando(false);
      }
    },
    [session?.user.id]
  );

  useFocusEffect(
    useCallback(() => {
      cargar(true);
    }, [cargar])
  );

  useEffect(() => {
    return suscribirseAMisChats(() => cargar(false));
  }, [cargar]);

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Chats</ThemedText>
      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={conversaciones}
          keyExtractor={(item) => item.conversacionId}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/chat/${item.conversacionId}`)}
              style={styles.fila}
              accessibilityRole="button"
              accessibilityLabel={`Conversación con ${item.otroUsuario.nombre_completo}`}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.otroUsuario.nombre_completo}</ThemedText>
                <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
                  {item.ultimoMensaje?.contenido ?? 'Sin mensajes todavía'}
                </ThemedText>
              </View>
              <View style={styles.derecha}>
                {item.ultimoMensaje && (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {formateadorHora.format(new Date(item.ultimoMensaje.creado_en))}
                  </ThemedText>
                )}
                {/* Cuño de tinta, no de ámbar: un contador de no leídos informa,
                    no compromete. Alto contraste y monocromo. */}
                {item.noLeidos > 0 && (
                  <View style={[styles.insigniaNoLeidos, { backgroundColor: theme.text }]}>
                    <ThemedText type="small" themeColor="background" style={styles.textoInsignia}>
                      {item.noLeidos}
                    </ThemedText>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<ThemedText type="small">Aún no tienes conversaciones.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three, minHeight: 44 },
  derecha: { alignItems: 'flex-end', gap: Spacing.half },
  insigniaNoLeidos: {
    borderRadius: Radios.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.half,
  },
  textoInsignia: { fontSize: 11, lineHeight: 14 },
});
