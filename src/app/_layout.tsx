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
        <Stack.Screen name="chat/[usuarioId]" options={{ headerShown: true, title: 'Chat' }} />
      </Stack>
    </ThemeProvider>
  );
}
