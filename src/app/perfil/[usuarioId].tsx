import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CampoFicha } from '@/components/ficha/CampoFicha';
import { Seccion } from '@/components/ficha/Seccion';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { folioDe } from '@/lib/folio';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { abrirConversacion } from '@/services/mensajes.service';
import { obtenerPerfilPublico, reportarUsuario } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { PerfilPublico } from '@/types/database.types';
import { aviso } from '@/lib/registro';

const ETIQUETA_RUIDO: Record<string, string> = {
  bajo: 'Prefiere silencio',
  medio: 'Ruido normal',
  alto: 'Ambiente animado',
};

const ETIQUETA_HORARIO: Record<string, string> = {
  diurno: 'De día',
  nocturno: 'De noche',
  mixto: 'Variable',
};

// Documento maestro v5 · §25 — el perfil ajeno muestra foto, biografía y
// compatibilidad, SIN presupuesto ni universidad.
//
// Eso no es una decisión de diseño: es lo que la vista `perfiles_publicos`
// permite ver. v3 hacía `from('usuarios').select('*')` y pintaba el rango de
// presupuesto de cualquier persona en pantalla, porque su RLS filtraba filas y
// no columnas. Ahora esos campos no llegan al cliente, punto.
//
// Sección 9: "esta pantalla es la que le da confianza a alguien como Karla,
// que no puede visitar antes de mudarse". El tratamiento visual se apoya en
// UN solo acento (el azul de marca, sección "The One Accent Rule" de
// DESIGN.md) usado como fondo tintado de la tarjeta de compatibilidad — no en
// sombras ni rebotes, que no existen en ningún otro lado de la app y aquí se
// verían fuera de lugar. Un único fundido de entrada (mismo patrón que
// Collapsible.tsx: FadeIn simple, sin cascada ni spring) y presión con opacio
// -dad, igual que el resto de los Pressable de la app.
export default function PerfilRoomieScreen() {
  const theme = useTheme();
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const session = useAuthStore((s) => s.session);
  const [usuario, setUsuario] = useState<PerfilPublico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abriendoChat, setAbriendoChat] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    obtenerPerfilPublico(usuarioId)
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, [usuarioId]);

  const { urls: urlsFirmadas } = useFotosFirmadas([usuario?.foto_url]);

  // AUD-07: la conversación la abre una función de Postgres, no un insert desde
  // el cliente. Dos personas tocando el botón a la vez reciben el MISMO
  // identificador, en vez de que la segunda vea un error de índice único justo
  // al iniciar el chat.
  const onIniciarChat = async () => {
    if (!usuarioId || abriendoChat) return;
    setAbriendoChat(true);
    try {
      const conversacionId = await abrirConversacion(usuarioId);
      router.push(`/chat/${conversacionId}`);
    } catch (e) {
      aviso('abrirConversacion falló', undefined, e);
      Alert.alert('No se pudo abrir el chat', 'Esta persona ya no está disponible.');
    } finally {
      setAbriendoChat(false);
    }
  };

  const onReportar = () => {
    const miId = session?.user.id;
    if (!miId || !usuarioId) return;
    const enviar = async (motivo: string) => {
      try {
        await reportarUsuario(miId, usuarioId, motivo);
        // Se dice QUÉ pasa, no solo «gracias». Hasta la migración 0023 este
        // acuse era falso: el trigger salía sin hacer nada para los reportes
        // de personas, así que la app agradecía por algo que no ocurría.
        Alert.alert(
          'Reporte registrado',
          'Al tercer reporte de cuentas distintas, el perfil se suspende y deja de aparecer en la app. Si corres peligro, no uses solo esta app: avisa a alguien de confianza.'
        );
      } catch (e) {
        // 23505 = ya lo habías reportado. El índice reportes_unico_usuario
        // existe para que una sola cuenta no pueda empujar el contador.
        const codigo = (e as { code?: string })?.code;
        Alert.alert(
          'No se pudo enviar el reporte',
          codigo === '23505' ? 'Ya habías reportado a esta persona.' : 'Intenta de nuevo en un momento.'
        );
      }
    };
    Alert.alert('Reportar usuario', '¿Por qué lo reportas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Comportamiento sospechoso', onPress: () => enviar('comportamiento sospechoso') },
      { text: 'Información falsa', onPress: () => enviar('información falsa') },
    ]);
  };

  if (cargando) {
    return (
      <ThemedView style={estilos.centrado}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!usuario) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="person-remove-outline" size={40} color={theme.textSecondary} />
        <ThemedText style={{ marginTop: Spacing.two }}>No se encontró este perfil.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={estilos.hoja} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: usuario.nombre_completo }} />

      {/* Un solo FadeIn plano, la única gramática de movimiento del proyecto.
          Aquí se intentó una vez un resorte escalonado con sombras de color y se
          revirtió: Android ignora `shadowColor` y el rebote era el único de la
          app. */}
      <Animated.View entering={FadeIn.duration(250)} style={estilos.contenido}>
        <View style={estilos.identidad}>
          {usuario.foto_url && urlsFirmadas.get(usuario.foto_url) ? (
            <Image
              source={{ uri: urlsFirmadas.get(usuario.foto_url)! }}
              style={[estilos.foto, { borderColor: theme.filete }]}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                estilos.foto,
                estilos.fotoVacia,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <Ionicons name="person-outline" size={34} color={theme.textSecondary} />
            </View>
          )}
          <View style={estilos.datosIdentidad}>
            <ThemedText type="folio" themeColor="textSecondary">
              EXPEDIENTE {folioDe(usuario.id)}
            </ThemedText>
            <ThemedText type="subtitle" numberOfLines={2}>
              {usuario.nombre_completo}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              @{usuario.nombre_usuario}
            </ThemedText>
          </View>
        </View>

        <View style={[estilos.filetePrincipal, { backgroundColor: theme.text }]} />

        {/* Antes esto era una tarjeta con lavado ámbar e iconos ámbar. Saber si
            alguien fuma no compromete nada, así que no gasta sello: son campos
            del documento, como los de cualquier otra ficha. */}
        <Seccion titulo="CONVIVENCIA">
          <View style={estilos.rejilla}>
            <CampoFicha
              etiqueta="NIVEL DE RUIDO"
              valor={ETIQUETA_RUIDO[usuario.nivel_ruido ?? 'medio'] ?? 'Sin especificar'}
              ancho={1}
              icono="volume-low-outline"
              tono={usuario.nivel_ruido ? 'normal' : 'atenuado'}
            />
            <CampoFicha
              etiqueta="HORARIO"
              valor={ETIQUETA_HORARIO[usuario.horario_predominante ?? 'mixto'] ?? 'Variable'}
              ancho={1}
              icono="moon-outline"
              tono={usuario.horario_predominante ? 'normal' : 'atenuado'}
            />
          </View>
          <View style={estilos.rejilla}>
            <CampoFicha
              etiqueta="MASCOTAS"
              valor={usuario.mascotas ? 'Sí tiene' : 'No tiene'}
              ancho={1}
              icono="paw-outline"
              tono={usuario.mascotas ? 'normal' : 'atenuado'}
            />
            <CampoFicha
              etiqueta="TABACO"
              valor={usuario.fuma ? 'Sí fuma' : 'No fuma'}
              ancho={1}
              tono={usuario.fuma ? 'normal' : 'atenuado'}
            />
          </View>
        </Seccion>

        {usuario.biografia ? (
          <Seccion titulo="SOBRE MÍ">
            <ThemedText style={estilos.biografia}>{usuario.biografia}</ThemedText>
          </Seccion>
        ) : null}

        {/* Iniciar el chat SÍ compromete: crea la fila en `conversaciones`
            (abrir_conversacion, AUD-07). Es el único ámbar de esta pantalla. */}
        <Sello
          onPress={onIniciarChat}
          cargando={abriendoChat}
          icono="chatbubble-ellipses-outline"
          accessibilityLabel={`Iniciar chat con ${usuario.nombre_completo}`}
        >
          Iniciar chat
        </Sello>

        <Pressable
          onPress={onReportar}
          style={({ pressed }) => [estilos.reportar, pressed && estilos.presionado]}
          accessibilityRole="button"
          accessibilityLabel="Reportar usuario"
          hitSlop={8}
        >
          <Ionicons name="flag-outline" size={14} color={theme.error} />
          <ThemedText type="small" themeColor="error">
            Reportar usuario
          </ThemedText>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  hoja: { paddingBottom: Spacing.six },
  contenido: { padding: Spacing.three, gap: Spacing.four },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  foto: { width: 88, height: 88, borderRadius: 44, borderWidth: Filete.fino },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  datosIdentidad: { flex: 1, gap: Spacing.half },
  filetePrincipal: { height: Filete.grueso },
  rejilla: { flexDirection: 'row', gap: Spacing.three },
  biografia: { lineHeight: 24 },
  reportar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 48,
  },
  presionado: { opacity: 0.6 },
});
