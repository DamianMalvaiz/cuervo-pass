import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formateadorHora } from '@/lib/formatoHora';
import { listarConversaciones, suscribirseAMensajes, type ResumenConversacion } from '@/services/mensajes.service';
import { obtenerUsuariosPublicos } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Usuario } from '@/types/database.types';

interface ConversacionConNombre extends ResumenConversacion {
  usuario: Usuario | null;
}

// Sección 9: "lista de conversaciones con último mensaje y hora".
export default function ChatsScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const [conversaciones, setConversaciones] = useState<ConversacionConNombre[]>([]);
  const [cargando, setCargando] = useState(true);
  const idCargaActual = useRef(0);

  // `mostrarSpinner` es false para los refrescos disparados por Realtime — sin
  // esto, CADA mensaje entrante (de cualquier conversación) reemplazaba toda la
  // lista por un spinner y perdía el scroll. El contador de idCarga descarta
  // respuestas que lleguen fuera de orden (dos cargar() en vuelo a la vez).
  const cargar = useCallback(
    async (mostrarSpinner: boolean) => {
      const miId = session?.user.id;
      if (!miId) return;
      const idCarga = ++idCargaActual.current;
      if (mostrarSpinner) setCargando(true);
      try {
        const resumenes = await listarConversaciones(miId);
        const usuarios = await obtenerUsuariosPublicos(resumenes.map((r) => r.otroUsuarioId));
        if (idCarga !== idCargaActual.current) return;
        const porId = new Map(usuarios.map((u) => [u.id, u]));
        setConversaciones(resumenes.map((r) => ({ ...r, usuario: porId.get(r.otroUsuarioId) ?? null })));
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

  // Refresca la lista cuando llega o se envía un mensaje mientras esta pantalla
  // está abierta — no solo al reenfocarla. Sin spinner: es un refresco de fondo.
  useEffect(() => {
    return suscribirseAMensajes(() => cargar(false));
  }, [cargar]);

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Chats</ThemedText>
      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={conversaciones}
          keyExtractor={(item) => item.otroUsuarioId}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/chat/${item.otroUsuarioId}`)}
              style={styles.fila}
              accessibilityRole="button"
              accessibilityLabel={`Conversación con ${item.usuario?.nombre_completo ?? 'usuario'}`}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.usuario?.nombre_completo ?? 'Usuario'}</ThemedText>
                <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
                  {item.ultimoMensaje.contenido}
                </ThemedText>
              </View>
              <View style={styles.derecha}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formateadorHora.format(new Date(item.ultimoMensaje.creado_en))}
                </ThemedText>
                {item.noLeidos > 0 && (
                  <View style={styles.insigniaNoLeidos}>
                    <ThemedText type="small" style={styles.textoInsignia}>
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
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.half,
  },
  textoInsignia: { color: '#fff', fontSize: 11, lineHeight: 14 },
});
