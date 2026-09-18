import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// Documento maestro v5 · §26 — el guard de sesión tiene TRES estados, no dos:
//
//   sin sesión                      → login
//   con sesión, sin cuestionario    → cuestionario
//   con sesión y cuestionario       → pestañas
//
// El tercero es el que v3 olvidaba. Un usuario con sesión pero sin cuestionario
// llega a una pantalla de sugerencias vacía y parece que la app está rota.
//
// v3 lo aproximaba con `universidad is not null`, que es una proxy frágil:
// alguien que guardó universidad y abandonó antes del presupuesto pasaba el
// filtro igual. Ahora hay una columna explícita, `cuestionario_completo`, que
// se escribe una sola vez al terminar de verdad.
export default function Index() {
  const { session, cargando, cargarSesionInicial } = useAuthStore();
  const [cuestionarioCompleto, setCuestionarioCompleto] = useState<boolean | null>(null);

  useEffect(() => {
    if (supabaseConfigurado) cargarSesionInicial();
  }, [cargarSesionInicial]);

  useEffect(() => {
    if (!session?.user.id) return;
    let activo = true;
    supabase
      .from('usuarios')
      .select('cuestionario_completo')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setCuestionarioCompleto(Boolean(data?.cuestionario_completo));
      });
    return () => {
      activo = false;
    };
  }, [session?.user.id]);

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

  if (cargando || (session && cuestionarioCompleto === null)) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  return <Redirect href={cuestionarioCompleto ? '/(tabs)/inicio' : '/(auth)/cuestionario-inicial'} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  titulo: { fontSize: 24, lineHeight: 30 },
});
