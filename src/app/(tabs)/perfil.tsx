import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { subirFotoPerfil } from '@/lib/storage';
import { eliminarMiCuenta, exportarMisDatos } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Documento maestro v5 · §25 y §29 (derechos ARCO).
export default function PerfilScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const { perfil, cargando, cargarPerfil, actualizarPerfil } = usePerfilStore();

  const [biografia, setBiografia] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
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

  // El bucket es privado (§14): `foto_url` guarda una ruta, y para mostrarla
  // hay que firmarla.
  const urlsFirmadas = useFotosFirmadas([perfil?.foto_url]);
  const urlFoto = perfil?.foto_url ? urlsFirmadas.get(perfil.foto_url) : null;

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
      const ruta = await subirFotoPerfil(session.user.id, resultado.assets[0].uri);
      await actualizarPerfil(session.user.id, { foto_url: ruta });
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

  // ACCESO (§29). Se comparte como texto en vez de escribir un archivo: la app
  // no tiene todavía una dependencia de sistema de archivos, y el volumen de
  // datos de un usuario cabe de sobra. Si algún día no cabe, el cambio es
  // expo-file-system aquí, no en la función de Postgres.
  const onDescargarMisDatos = async () => {
    setExportando(true);
    try {
      const datos = await exportarMisDatos();
      await Share.share({
        title: 'Mis datos en Cuervo Pass',
        message: JSON.stringify(datos, null, 2),
      });
    } catch (e) {
      Alert.alert('No se pudieron exportar tus datos', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  };

  // CANCELACIÓN (§29). Irreversible y en cascada: por eso se confirma dos veces
  // y se dice exactamente qué desaparece.
  const onEliminarCuenta = () => {
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borran tu perfil, tus publicaciones, tus fotos y tus mensajes. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarMiCuenta();
              router.replace('/(auth)/login');
            } catch (e) {
              Alert.alert('No se pudo eliminar la cuenta', e instanceof Error ? e.message : 'Intenta de nuevo.');
            }
          },
        },
      ]
    );
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
            {urlFoto ? (
              <Image source={{ uri: urlFoto }} style={styles.foto} />
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

          {/* §25: el cuestionario es editable desde aquí. Antes solo se podía
              contestar una vez, al registrarse, así que cambiar de presupuesto
              o de universidad exigía crear otra cuenta. */}
          <Pressable
            style={[styles.boton, styles.botonSecundario, { borderColor: theme.border }]}
            onPress={() => router.push('/perfil/preferencias')}
            accessibilityRole="button"
            accessibilityLabel="Editar mis preferencias de búsqueda"
          >
            <ThemedText style={[styles.botonTexto, { color: theme.text }]}>Editar mis preferencias</ThemedText>
          </Pressable>

          <View style={[styles.bloqueDatos, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Tus datos</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Puedes llevarte una copia de todo lo que guardamos, o borrarlo por completo.
            </ThemedText>

            <Pressable
              style={[styles.boton, styles.botonSecundario, { borderColor: theme.border }]}
              onPress={onDescargarMisDatos}
              disabled={exportando}
              accessibilityRole="button"
              accessibilityLabel="Descargar mis datos"
              accessibilityState={{ disabled: exportando, busy: exportando }}
            >
              {exportando ? (
                <ActivityIndicator />
              ) : (
                <ThemedText style={[styles.botonTexto, { color: theme.text }]}>Descargar mis datos</ThemedText>
              )}
            </Pressable>

            <Pressable
              style={[styles.boton, styles.botonPeligro]}
              onPress={onEliminarCuenta}
              accessibilityRole="button"
              accessibilityLabel="Eliminar mi cuenta"
            >
              <ThemedText style={[styles.botonTexto, { color: AppColors.destructiveRed }]}>
                Eliminar mi cuenta
              </ThemedText>
            </Pressable>
          </View>

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
  botonSecundario: { backgroundColor: 'transparent', borderWidth: 1 },
  botonPeligro: { backgroundColor: 'transparent', borderWidth: 1, borderColor: AppColors.destructiveRed },
  botonCerrarSesion: { backgroundColor: AppColors.destructiveRed },
  botonTexto: { color: '#fff', fontWeight: '600' },
  bloqueDatos: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.one,
  },
});
