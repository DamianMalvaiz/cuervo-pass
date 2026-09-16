import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabaseConfigurado } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  const { session, cargando, cargarSesionInicial } = useAuthStore();

  useEffect(() => {
    if (supabaseConfigurado) cargarSesionInicial();
  }, [cargarSesionInicial]);

  if (!supabaseConfigurado) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.titulo}>
          Falta configurar Supabase
        </ThemedText>
        <ThemedText type="small">
          Copia .env.example a .env y completa EXPO_PUBLIC_SUPABASE_URL y
          EXPO_PUBLIC_SUPABASE_ANON_KEY con los datos de tu proyecto (Project Settings → API),
          luego reinicia `npx expo start`.
        </ThemedText>
      </ThemedView>
    );
  }

  if (cargando) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return <Redirect href={session ? '/(tabs)/inicio' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  titulo: { fontSize: 24, lineHeight: 30 },
});
