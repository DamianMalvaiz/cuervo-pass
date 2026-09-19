import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { FileteHoja } from '@/components/ficha/CampoFicha';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTheme } from '@/hooks/use-theme';
import { formateadorHora } from '@/lib/formatoHora';
import { useAuthStore } from '@/store/useAuthStore';
import { useConversaciones } from '@/hooks/queries/useChat';

// Documento maestro v5 · §25. El nombre de la contraparte y el último mensaje
// ya vienen resueltos desde el servicio: antes esta pantalla pedía los perfiles
// aparte y armaba los hilos agrupando todos los mensajes del usuario.
export default function ChatsScreen() {
  const theme = useTheme();
  const margenSuperior = useMargenSuperior();
  const session = useAuthStore((s) => s.session);
  // END-18 · La suscripción de Realtime, el guardia de respuestas fuera de orden
  // y la distinción entre recarga visible y silenciosa viven ahora en el hook.
  const { conversaciones, cargando } = useConversaciones(session?.user.id);

  // AUD-08: una sola petición firmada para todos los avatares visibles, no una
  // por fila. El bucket es privado (§14), así que una ruta cruda no carga.
  const { urls: urlsFirmadas } = useFotosFirmadas(conversaciones.map((c) => c.otroUsuario.foto_url));

  return (
    <ThemedView style={estilos.pantalla}>
      {/* Membrete del registro: qué es y cuántas entradas tiene. */}
      <View style={[estilos.encabezado, { paddingTop: margenSuperior }]}>
        <Encabezado
          kicker="REGISTRO DE MENSAJES"
          titulo="Chats"
          meta={conversaciones.length === 1 ? '1 CONVERSACIÓN' : `${conversaciones.length} CONVERSACIONES`}
        />
      </View>

      {cargando ? (
        <View style={estilos.cargando}>
          <ActivityIndicator color={theme.textSecondary} />
          <ThemedText type="etiqueta" themeColor="textSecondary">
            CONSULTANDO REGISTRO
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={conversaciones}
          keyExtractor={(item) => item.conversacionId}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          // Filete entre renglones, como un registro impreso. Sin él, una lista
          // de nombres sobre fondo plano se lee como un bloque continuo.
          ItemSeparatorComponent={() => <FileteHoja />}
          renderItem={({ item }) => {
            const inicial = (item.otroUsuario.nombre_completo ?? '?').trim().charAt(0).toUpperCase();
            const url = item.otroUsuario.foto_url ? urlsFirmadas.get(item.otroUsuario.foto_url) : null;
            return (
              <Pressable
                onPress={() => router.push(`/chat/${item.conversacionId}`)}
                style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}
                accessibilityRole="button"
                accessibilityLabel={
                  `Conversación con ${item.otroUsuario.nombre_completo}. ` +
                  (item.noLeidos > 0 ? `${item.noLeidos} sin leer. ` : '') +
                  (item.ultimoMensaje?.contenido ?? 'Sin mensajes todavía')
                }
              >
                {url ? (
                  <Image source={{ uri: url }} style={[estilos.avatar, { borderColor: theme.filete }]} />
                ) : (
                  // Sin foto, la inicial. Un círculo gris vacío no distingue una
                  // conversación de otra; una letra sí.
                  <View style={[estilos.avatar, estilos.avatarVacio, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {inicial}
                    </ThemedText>
                  </View>
                )}

                <View style={estilos.centro}>
                  <ThemedText
                    numberOfLines={1}
                    style={item.noLeidos > 0 ? estilos.nombreNoLeido : undefined}
                  >
                    {item.otroUsuario.nombre_completo}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor={item.noLeidos > 0 ? 'text' : 'textSecondary'}
                    numberOfLines={1}
                  >
                    {item.ultimoMensaje?.contenido ?? 'Sin mensajes todavía'}
                  </ThemedText>
                </View>

                <View style={estilos.derecha}>
                  {item.ultimoMensaje && (
                    <ThemedText type="folio" themeColor="textSecondary">
                      {formateadorHora.format(new Date(item.ultimoMensaje.creado_en))}
                    </ThemedText>
                  )}
                  {/* Cuño de tinta, no de ámbar: un contador de no leídos informa,
                      no compromete. Y no va solo en color: el nombre y el último
                      mensaje también cambian de peso y de tono. */}
                  {item.noLeidos > 0 && (
                    <View style={[estilos.insignia, { backgroundColor: theme.text }]}>
                      <ThemedText type="folio" themeColor="background">
                        {item.noLeidos > 99 ? '99+' : item.noLeidos}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <BloqueEstado
              etiqueta="SIN CONVERSACIONES"
              mensaje="Cuando pidas el contacto de una publicación o te escriba alguien, el hilo aparece aquí."
              icono="chatbubbles-outline"
            />
          }
        />
      )}
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  encabezado: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.one },
  lista: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  cargando: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 72,
  },
  presionada: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: Filete.fino },
  avatarVacio: { alignItems: 'center', justifyContent: 'center' },
  centro: { flex: 1, gap: Spacing.half },
  nombreNoLeido: Texto.pesoFuerte,
  derecha: { alignItems: 'flex-end', gap: Spacing.one },
  insignia: {
    borderRadius: Radios.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
});
