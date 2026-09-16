import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

// TODO (Semana 2): foto, biografía y campos del cuestionario editables (usePerfilStore).
export default function PerfilScreen() {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);

  const onCerrarSesion = async () => {
    await cerrarSesion();
    router.replace('/(auth)/login');
  };

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Mi perfil</ThemedText>
      <ThemedText type="small" style={{ marginVertical: Spacing.three }}>
        Foto, biografía y preferencias editables llegan en la Semana 2.
      </ThemedText>
      <Pressable style={styles.boton} onPress={onCerrarSesion}>
        <ThemedText style={styles.botonTexto}>Cerrar sesión</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  boton: {
    backgroundColor: '#d92d20',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
  },
  botonTexto: { color: '#fff', fontWeight: '600' },
});
