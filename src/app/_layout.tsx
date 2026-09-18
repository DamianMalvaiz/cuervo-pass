import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="publicacion/[id]" options={{ headerShown: true, title: 'Publicación' }} />
        <Stack.Screen name="publicacion/nueva" options={{ headerShown: true, title: 'Nueva publicación' }} />
        <Stack.Screen name="publicacion/editar/[id]" options={{ headerShown: true, title: 'Editar publicación' }} />
        <Stack.Screen name="perfil/[usuarioId]" options={{ headerShown: true, title: 'Perfil' }} />
        <Stack.Screen name="perfil/preferencias" options={{ headerShown: true, title: 'Mis preferencias' }} />
        {/* La ruta es la conversación, no el otro usuario: el hilo existe como
            fila en `conversaciones` desde la migración 0012 (§26). */}
        <Stack.Screen name="chat/[conversacionId]" options={{ headerShown: true, title: 'Chat' }} />
      </Stack>
    </ThemeProvider>
  );
}
