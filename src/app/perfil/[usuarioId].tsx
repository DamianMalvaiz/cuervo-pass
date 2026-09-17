import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { obtenerUsuarioPublico, reportarUsuario } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Usuario } from '@/types/database.types';

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
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuarioId) return;
    obtenerUsuarioPublico(usuarioId)
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, [usuarioId]);

  const onReportar = () => {
    const miId = session?.user.id;
    if (!miId || !usuarioId) return;
    const enviar = async (motivo: string) => {
      try {
        await reportarUsuario(miId, usuarioId, motivo);
        Alert.alert('Gracias', 'Reportamos a este usuario para revisión.');
      } catch {
        Alert.alert('No se pudo enviar el reporte', 'Intenta de nuevo en un momento.');
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
      <ThemedView style={styles.centrado}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!usuario) {
    return (
      <ThemedView style={styles.centrado}>
        <Ionicons name="person-remove-outline" size={40} color={theme.textSecondary} />
        <ThemedText style={{ marginTop: Spacing.two }}>No se encontró este perfil.</ThemedText>
      </ThemedView>
    );
  }

  const rangoPresupuesto =
    usuario.presupuesto_min != null && usuario.presupuesto_max != null
      ? `$${usuario.presupuesto_min}–$${usuario.presupuesto_max}/mes`
      : 'Sin especificar';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: usuario.nombre_completo }} />

      <Animated.View entering={FadeIn.duration(250)}>
        <View style={styles.encabezado}>
          {usuario.foto_url ? (
            <Image source={{ uri: usuario.foto_url }} style={styles.foto} contentFit="cover" />
          ) : (
            <View style={[styles.foto, styles.fotoVacia, { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name="person" size={44} color={theme.textSecondary} />
            </View>
          )}
          <ThemedText type="title" style={styles.nombre} numberOfLines={1}>
            {usuario.nombre_completo}
          </ThemedText>
          {usuario.universidad && (
            <View style={styles.filaUniversidad}>
              <Ionicons name="school-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {usuario.universidad}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.tarjeta, { backgroundColor: theme.tintedSurface, borderColor: theme.tintedBorder }]}>
          <View style={styles.tituloTarjeta}>
            <Ionicons name="shield-checkmark-outline" size={18} color={AppColors.primary} />
            <ThemedText type="smallBold" style={{ color: AppColors.primary }}>
              Compatibilidad
            </ThemedText>
          </View>

          <FilaCompatibilidad
            icono="wallet-outline"
            etiqueta="Presupuesto"
            valor={rangoPresupuesto}
            colorBorde={theme.tintedBorder}
          />
          <FilaCompatibilidad
            icono="paw-outline"
            etiqueta="Mascotas"
            valor={usuario.mascotas ? 'Sí tiene' : 'No tiene'}
            positivo={usuario.mascotas}
            colorBorde={theme.tintedBorder}
          />
          <FilaCompatibilidad
            icono="ban-outline"
            etiqueta="Fuma"
            valor={usuario.fuma ? 'Sí fuma' : 'No fuma'}
            positivo={!usuario.fuma}
            esUltima
            colorBorde={theme.tintedBorder}
          />
        </View>

        {usuario.biografia && (
          <View style={styles.bloqueBio}>
            <ThemedText type="smallBold" style={styles.tituloSeccion}>
              Sobre mí
            </ThemedText>
            <ThemedText style={styles.biografia}>{usuario.biografia}</ThemedText>
          </View>
        )}

        <Pressable
          onPress={() => router.push(`/chat/${usuarioId}`)}
          style={({ pressed }) => [styles.botonChat, pressed && styles.botonChatPresionado]}
          accessibilityRole="button"
          accessibilityLabel={`Chatear con ${usuario.nombre_completo}`}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
          <ThemedText style={styles.botonChatTexto}>Iniciar chat</ThemedText>
        </Pressable>

        <Pressable
          onPress={onReportar}
          style={({ pressed }) => [styles.reportarBoton, pressed && styles.reportarBotonPresionado]}
          accessibilityRole="button"
          accessibilityLabel="Reportar usuario"
          hitSlop={8}
        >
          <Ionicons name="flag-outline" size={14} color={AppColors.destructiveRed} />
          <ThemedText style={styles.reportarTexto}>Reportar usuario</ThemedText>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

interface FilaCompatibilidadProps {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  valor: string;
  positivo?: boolean;
  esUltima?: boolean;
  colorBorde: string;
}

function FilaCompatibilidad({ icono, etiqueta, valor, positivo, esUltima, colorBorde }: FilaCompatibilidadProps) {
  const theme = useTheme();
  const colorPunto = positivo === undefined ? undefined : positivo ? AppColors.successGreen : theme.textSecondary;

  return (
    <View style={[styles.filaCompatibilidad, !esUltima && { borderBottomWidth: 1, borderBottomColor: colorBorde }]}>
      <View style={styles.filaCompatibilidadIzq}>
        <Ionicons name={icono} size={18} color={AppColors.primary} />
        <ThemedText type="small">{etiqueta}</ThemedText>
      </View>
      <View style={styles.filaCompatibilidadDer}>
        {colorPunto && <View style={[styles.punto, { backgroundColor: colorPunto }]} />}
        <ThemedText type="smallBold">{valor}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
  encabezado: { alignItems: 'center', gap: Spacing.one },
  foto: { width: 100, height: 100, borderRadius: 50 },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 24, lineHeight: 28, marginTop: Spacing.two, textAlign: 'center' },
  filaUniversidad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  tarjeta: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    marginTop: Spacing.five,
    gap: Spacing.one,
  },
  tituloTarjeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  filaCompatibilidad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  filaCompatibilidadIzq: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  filaCompatibilidadDer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  punto: { width: 8, height: 8, borderRadius: 4 },
  bloqueBio: { marginTop: Spacing.four },
  tituloSeccion: { marginBottom: Spacing.one },
  biografia: { lineHeight: 22 },
  botonChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: AppColors.primary,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.five,
    minHeight: 44,
  },
  botonChatPresionado: { opacity: 0.85 },
  botonChatTexto: { color: '#fff', fontWeight: '600', fontSize: 16 },
  reportarBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    marginTop: Spacing.three,
    padding: Spacing.three,
    minHeight: 44,
  },
  reportarBotonPresionado: { opacity: 0.6 },
  reportarTexto: { color: AppColors.destructiveRed },
});
