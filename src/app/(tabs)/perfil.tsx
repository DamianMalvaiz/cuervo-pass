import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { subirFotoPerfil } from '@/lib/storage';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// TODO (Semana 4): campos del cuestionario (presupuesto, mascotas, ruido) editables aquí también.
export default function PerfilScreen() {
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
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Mi perfil</ThemedText>

      <Pressable onPress={onCambiarFoto} style={styles.fotoContenedor} disabled={subiendoFoto}>
        {perfil?.foto_url ? (
          <Image source={{ uri: perfil.foto_url }} style={styles.foto} />
        ) : (
          <View style={[styles.foto, styles.fotoVacia]} />
        )}
        <View style={styles.fotoOverlay}>
          {subiendoFoto ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.fotoOverlayTexto}>Cambiar foto</ThemedText>}
        </View>
      </Pressable>

      <ThemedText type="small" style={styles.etiqueta}>
        Biografía
      </ThemedText>
      <TextInput
        style={styles.biografiaInput}
        placeholder="Cuéntale a otros quién eres (genera confianza para quien no puede visitarte antes)"
        multiline
        value={biografia}
        onChangeText={setBiografia}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.boton} onPress={onGuardarBiografia} disabled={guardando}>
        {guardando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Guardar</ThemedText>}
      </Pressable>

      <Pressable style={[styles.boton, styles.botonCerrarSesion]} onPress={onCerrarSesion}>
        <ThemedText style={styles.botonTexto}>Cerrar sesión</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fotoContenedor: { alignSelf: 'center', marginVertical: Spacing.three },
  foto: { width: 120, height: 120, borderRadius: 60 },
  fotoVacia: { backgroundColor: '#E0E1E6' },
  fotoOverlay: { alignItems: 'center', marginTop: Spacing.one },
  fotoOverlayTexto: { color: '#208AEF', fontWeight: '600' },
  etiqueta: { marginBottom: Spacing.one },
  biografiaInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: { color: '#d92d20', marginTop: Spacing.two },
  boton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  botonCerrarSesion: { backgroundColor: '#d92d20' },
  botonTexto: { color: '#fff', fontWeight: '600' },
});
