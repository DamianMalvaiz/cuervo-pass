import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { subirFotoPerfil } from '@/lib/storage';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// TODO (Semana 4): campos del cuestionario (presupuesto, mascotas, ruido) editables aquí también.
export default function PerfilScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const { perfil, cargando, cargarPerfil, actualizarPerfil } = usePerfilStore();

  const [biografia, setBiografia] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza el borrador local con el perfil cargado, sin useEffect: React
  // recomienda "ajustar estado durante el render" para este caso exacto
  // (un valor que llega async y debe resetear un draft editable).
  const [biografiaSincronizada, setBiografiaSincronizada] = useState<string | null | undefined>(undefined);
  if (perfil?.biografia !== biografiaSincronizada) {
    setBiografiaSincronizada(perfil?.biografia);
    setBiografia(perfil?.biografia ?? '');
  }

  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  const onCambiarFoto = async () => {
    if (!session?.user.id) return;
    setError(null);
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('Necesitamos permiso para acceder a tus fotos');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      aspect: [1, 1],
      allowsEditing: true,
    });
    if (resultado.canceled) return;

    setSubiendoFoto(true);
    try {
      const url = await subirFotoPerfil(session.user.id, resultado.assets[0].uri);
      await actualizarPerfil(session.user.id, { foto_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const onGuardarBiografia = async () => {
    if (!session?.user.id) return;
    setError(null);
    setGuardando(true);
    try {
      await actualizarPerfil(session.user.id, { biografia });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la biografía');
    } finally {
      setGuardando(false);
    }
  };

  const onCerrarSesion = async () => {
    await cerrarSesion();
    router.replace('/(auth)/login');
  };

  if (cargando) {
    return (
      <ThemedView style={styles.centrado}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Mi perfil</ThemedText>

          <Pressable
            onPress={onCambiarFoto}
            style={styles.fotoContenedor}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            accessibilityState={{ busy: subiendoFoto }}
          >
            {perfil?.foto_url ? (
              <Image source={{ uri: perfil.foto_url }} style={styles.foto} />
            ) : (
              <View style={[styles.foto, { backgroundColor: theme.backgroundSelected }]} />
            )}
            <View style={styles.fotoOverlay}>
              {subiendoFoto ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <ThemedText style={styles.fotoOverlayTexto}>Cambiar foto</ThemedText>
              )}
            </View>
          </Pressable>

          <ThemedText type="small" style={styles.etiqueta}>
            Biografía
          </ThemedText>
          <TextInput
            style={[styles.biografiaInput, { borderColor: theme.border, color: theme.text }]}
            placeholder="Cuéntale a otros quién eres (genera confianza para quien no puede visitarte antes)"
            placeholderTextColor={theme.textSecondary}
            multiline
            accessibilityLabel="Biografía"
            value={biografia}
            onChangeText={setBiografia}
          />

          {error && (
            <ThemedText style={styles.error} accessibilityLiveRegion="assertive">
              {error}
            </ThemedText>
          )}

          <Pressable
            style={styles.boton}
            onPress={onGuardarBiografia}
            disabled={guardando}
            accessibilityRole="button"
            accessibilityLabel="Guardar biografía"
            accessibilityState={{ disabled: guardando, busy: guardando }}
          >
            {guardando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Guardar</ThemedText>}
          </Pressable>

          <Pressable
            style={[styles.boton, styles.botonCerrarSesion]}
            onPress={onCerrarSesion}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <ThemedText style={styles.botonTexto}>Cerrar sesión</ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  fotoContenedor: { alignSelf: 'center', marginVertical: Spacing.three },
  foto: { width: 120, height: 120, borderRadius: 60 },
  fotoOverlay: { alignItems: 'center', marginTop: Spacing.one },
  fotoOverlayTexto: { color: AppColors.primary, fontWeight: '600' },
  etiqueta: { marginBottom: Spacing.one },
  biografiaInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: { color: AppColors.destructiveRed, marginTop: Spacing.two },
  boton: {
    backgroundColor: AppColors.primary,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonCerrarSesion: { backgroundColor: AppColors.destructiveRed },
  botonTexto: { color: '#fff', fontWeight: '600' },
});
