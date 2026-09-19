import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_900Black, useFonts } from '@expo-google-fonts/archivo';
import { Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors, Tipografia } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// La pantalla de arranque se sostiene hasta que Archivo esté en memoria. Sin
// esto la app pinta un fotograma con la tipografía del sistema y luego salta a
// la propia — el parpadeo que delata que las fuentes se cargaron tarde.
SplashScreen.preventAutoHideAsync().catch(() => {
  // En Expo Go puede haberse ocultado sola antes de llegar aquí; no es un fallo.
});

/**
 * El tema de NAVEGACIÓN, que es distinto del tema de la app.
 *
 * Lo que React Navigation pinta por su cuenta —fondo de cada pantalla al
 * empujarla, filete bajo el encabezado, color del botón atrás— sale de aquí. Si
 * se deja en `DefaultTheme`, esas superficies se quedan en el gris de fábrica y
 * delatan que la app está ensamblada y no construida. Es lo más barato de
 * arreglar y lo que más se omite.
 */
function temaNavegacion(esOscuro: boolean): Theme {
  const c = esOscuro ? Colors.dark : Colors.light;
  return {
    dark: esOscuro,
    colors: {
      primary: c.acento,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.filete,
      notification: c.acento,
    },
    fonts: {
      regular: { fontFamily: Tipografia.regular, fontWeight: '400' },
      medium: { fontFamily: Tipografia.medium, fontWeight: '500' },
      bold: { fontFamily: Tipografia.semibold, fontWeight: '600' },
      heavy: { fontFamily: Tipografia.bold, fontWeight: '700' },
    },
  };
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const esOscuro = scheme === 'dark';
  const c = esOscuro ? Colors.dark : Colors.light;

  const [fuentesListas, errorFuentes] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_900Black,
  });

  useEffect(() => {
    // También se oculta si las fuentes FALLAN: quedarse en la pantalla de
    // arranque para siempre es peor que pintar con la tipografía del sistema.
    if (fuentesListas || errorFuentes) SplashScreen.hideAsync().catch(() => {});
  }, [fuentesListas, errorFuentes]);

  if (!fuentesListas && !errorFuentes) return null;

  const encabezado = {
    headerShown: true,
    headerStyle: { backgroundColor: c.background },
    headerTintColor: c.acento,
    headerTitleStyle: { fontFamily: Tipografia.semibold, fontSize: 16, color: c.text },
    headerShadowVisible: false,
    // Un impreso separa sus bloques con filete, no con sombra. Android ignora
    // `shadowColor` de todos modos (comprobado y revertido en este proyecto).
    headerBackground: undefined,
  } as const;

  return (
    <ThemeProvider value={temaNavegacion(esOscuro)}>
      <StatusBar style={esOscuro ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="publicacion/[id]" options={{ ...encabezado, title: 'Ficha' }} />
        <Stack.Screen name="publicacion/nueva" options={{ ...encabezado, title: 'Nueva publicación' }} />
        <Stack.Screen name="publicacion/editar/[id]" options={{ ...encabezado, title: 'Editar publicación' }} />
        <Stack.Screen name="perfil/[usuarioId]" options={{ ...encabezado, title: 'Perfil' }} />
        <Stack.Screen name="perfil/preferencias" options={{ ...encabezado, title: 'Mis preferencias' }} />
        {/* La ruta es la conversación, no el otro usuario: el hilo existe como
            fila en `conversaciones` desde la migración 0012 (§26). */}
        <Stack.Screen name="chat/[conversacionId]" options={{ ...encabezado, title: 'Chat' }} />
        {/* §29 — se abre desde el registro ANTES de aceptar, y desde Mi perfil
            después. Con cabecera para que haya "atrás" sin gestos. */}
        <Stack.Screen name="aviso-privacidad" options={{ ...encabezado, title: 'Aviso de privacidad' }} />
      </Stack>
    </ThemeProvider>
  );
}
