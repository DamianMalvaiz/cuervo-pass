import { QueryClientProvider } from '@tanstack/react-query';
import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_900Black, useFonts } from '@expo-google-fonts/archivo';
import { Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, Tipografia } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { crearClienteConsultas } from '@/lib/consultas';
import { fallo, limpiar, textoDeError } from '@/lib/registro';

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
      primary: c.text,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.filete,
      notification: c.text,
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
  // El cliente se crea UNA vez por montaje de la app, no en cada render: un
  // QueryClient nuevo tira la caché entera, que es justo lo contrario de para
  // lo que está. `useState` con inicializador perezoso es la forma corta de
  // decir eso sin un `useRef` y una guarda.
  const [clienteConsultas] = useState(crearClienteConsultas);

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
    headerTintColor: c.text,
    headerTitleStyle: { fontFamily: Tipografia.semibold, fontSize: 16, color: c.text },
    headerShadowVisible: false,
    // Un impreso separa sus bloques con filete, no con sombra. Android ignora
    // `shadowColor` de todos modos (comprobado y revertido en este proyecto).
    headerBackground: undefined,
  } as const;

  return (
    <QueryClientProvider client={clienteConsultas}>
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
        {/* Hoja modal, no empujada: editar tus preferencias es una tarea
            autocontenida de la que se sale cancelando, y el gesto de arrastrar
            hacia abajo para cerrar ya lo conoce cualquiera. */}
        <Stack.Screen
          name="perfil/preferencias"
          options={{ ...encabezado, title: 'Mis preferencias', presentation: 'modal' }}
        />
        {/* La ruta es la conversación, no el otro usuario: el hilo existe como
            fila en `conversaciones` desde la migración 0012 (§26). */}
        <Stack.Screen name="chat/[conversacionId]" options={{ ...encabezado, title: 'Chat' }} />
        {/* §29 — se abre desde el registro ANTES de aceptar, y desde Mi perfil
            después. Con cabecera para que haya "atrás" sin gestos. */}
        <Stack.Screen name="aviso-privacidad" options={{ ...encabezado, title: 'Aviso de privacidad' }} />
      </Stack>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * END-12 · La red de seguridad en tiempo de ejecución.
 *
 * expo-router reconoce un `ErrorBoundary` exportado desde un layout **por su
 * nombre** y lo pinta en lugar del subárbol que reventó. Sin esto, un error de
 * render en un build de release es una PANTALLA BLANCA: sin traza, sin mensaje,
 * sin salida, y en vivo. El principio #1 de PRODUCT.md es «Reliability over
 * features», y ése era el modo de fallo más visible que tenía la app.
 *
 * Tres decisiones:
 *
 *   · **Reintentar de verdad.** `retry()` remonta el subárbol. Un error sin
 *     salida deja la app muerta hasta que se mate el proceso, y quien está
 *     enseñándola no puede hacer eso delante de nadie.
 *
 *   · **Compartir, no copiar.** El portapapeles exigiría `expo-clipboard`, que
 *     es un módulo nativo y obliga a reconstruir el binario. `Share` ya viene
 *     en React Native, cuesta cero, y además deja mandarse el detalle por
 *     WhatsApp — que es lo que uno hace de verdad con un error.
 *
 *   · **El detalle se limpia antes de salir.** Va por `limpiar()` de
 *     `registro.ts`: §29 exige minimización y esto sale del dispositivo hacia
 *     donde la persona decida.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const detalle = textoDeError(error);

  useEffect(() => {
    fallo('error de render capturado por ErrorBoundary', { detalle }, error);
  }, [detalle, error]);

  const compartir = () => {
    const cuerpo = String(limpiar(`Cuervo Pass — error\n\n${detalle}\n\n${error?.stack ?? ''}`));
    Share.share({ message: cuerpo }).catch(() => {
      // Si el diálogo del sistema no abre, no hay nada más que hacer aquí: lo
      // importante —que la pantalla no esté en blanco— ya está resuelto.
    });
  };

  return (
    <ThemedView style={estilos.pantallaError}>
      <ScrollView contentContainerStyle={estilos.contenidoError}>
        <BloqueEstado
          etiqueta="ALGO SE ROMPIÓ"
          mensaje="La pantalla no pudo dibujarse. Puedes reintentar; si vuelve a pasar, comparte el detalle."
          icono="warning-outline"
          tono="alerta"
        />
        {/* El detalle, seleccionable y legible. Esconderlo obliga a adivinar. */}
        <ThemedText type="small" themeColor="textSecondary" selectable style={estilos.detalleError}>
          {detalle}
        </ThemedText>
        <View style={estilos.accionesError}>
          <Sello onPress={retry} icono="refresh" accessibilityLabel="Reintentar">
            Reintentar
          </Sello>
          <Sello onPress={compartir} variante="contorno" icono="share-outline" accessibilityLabel="Compartir detalle">
            Compartir detalle
          </Sello>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantallaError: { flex: 1 },
  contenidoError: { flexGrow: 1, justifyContent: 'center', padding: Spacing.three, gap: Spacing.three },
  detalleError: { lineHeight: 20 },
  accionesError: { gap: Spacing.two },
});
