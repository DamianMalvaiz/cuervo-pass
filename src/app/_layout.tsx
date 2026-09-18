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
        {/* §29 — se abre desde el registro ANTES de aceptar, y desde Mi perfil
            después. Con cabecera para que haya "atrás" sin gestos. */}
        <Stack.Screen name="aviso-privacidad" options={{ headerShown: true, title: 'Aviso de privacidad' }} />
        {/* La ruta es la conversación, no el otro usuario: el hilo existe como
            fila en `conversaciones` desde la migración 0012 (§26). */}
        <Stack.Screen name="chat/[conversacionId]" options={{ headerShown: true, title: 'Chat' }} />
      </Stack>
    </ThemeProvider>
  );
}
