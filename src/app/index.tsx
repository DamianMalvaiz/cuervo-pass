import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  const { session, cargando, cargarSesionInicial } = useAuthStore();
  // Con sesión no basta para mandar a (tabs) — si alguien salió a medias del
  // cuestionario inicial (o la app se recargó a medio flujo), se queda con
  // sesión activa pero sin universidad/presupuesto guardados, y antes este
  // guard lo mandaba directo a Sugerencias para siempre, sin universidad
  // configurada (rompe el cálculo de distancia y todo lo que dependa del perfil).
  const [perfilCompleto, setPerfilCompleto] = useState<boolean | null>(null);

  useEffect(() => {
    if (supabaseConfigurado) cargarSesionInicial();
  }, [cargarSesionInicial]);

  useEffect(() => {
    // Sin sesión no se usa perfilCompleto para nada (el render de abajo manda
    // a login antes de consultarlo) — no hace falta resetearlo aquí.
    if (!session?.user.id) return;
    let activo = true;
    supabase
      .from('usuarios')
      .select('universidad')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (activo) setPerfilCompleto(Boolean(data?.universidad));
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

  if (cargando || (session && perfilCompleto === null)) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  return <Redirect href={perfilCompleto ? '/(tabs)/inicio' : '/(auth)/cuestionario-inicial'} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  titulo: { fontSize: 24, lineHeight: 30 },
});
