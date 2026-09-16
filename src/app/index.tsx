import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  const { session, cargando, cargarSesionInicial } = useAuthStore();

  useEffect(() => {
    cargarSesionInicial();
  }, [cargarSesionInicial]);

  if (cargando) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return <Redirect href={session ? '/(tabs)/inicio' : '/(auth)/login'} />;
}
