import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MarcoSesionWeb } from '@/components/web/MarcoSesionWeb';
import { Spacing, Texto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';

/**
 * Pone una pantalla de la app DENTRO del marco de la web (el encabezado de la web arriba y, en teléfono, la barra inferior) cuando corre en el navegador; en la app no hace nada. Es para las pantallas de formulario o de lectura
 * que se hicieron para el teléfono y funcionan igual en la web, pero salían con la cabecera de la app (su título y la flecha atrás) en vez de la navegación del sitio. Cada ruta que lo usa apaga su cabecera de app en el layout.
 *
 * Esa cabecera era también quien ponía el TÍTULO de la pantalla: sin ella, «Configuración» o «Cambiar contraseña» quedaban sin nombre. `titulo` lo devuelve (encabezado de la página, alineado con la columna del contenido,
 * y título de la pestaña del navegador). Las pantallas que ya traen su título en el cuerpo no lo pasan. `ancho`: «columna» (lo normal) alinea el título con la columna estrecha de los formularios; «completo» lo alinea con el texto que ocupa todo el ancho (los documentos legales).
 */
export function EnMarcoWeb({ titulo, ancho = 'columna', children }: { titulo?: string; ancho?: 'columna' | 'completo'; children: ReactNode }) {
  const { anchoContenido } = useTamanoPantalla();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <MarcoSesionWeb>
      {titulo ? (
        <>
          <Head>
            <title>{`${titulo} · Cuervo 360`}</title>
          </Head>
          <View style={[estilos.titulo, ancho === 'columna' ? { maxWidth: anchoContenido } : estilos.tituloCompleto]}>
            <ThemedText accessibilityRole="header" style={Texto.seccionWebCompacto}>{titulo}</ThemedText>
          </View>
        </>
      ) : null}
      <View style={estilos.cuerpo}>{children}</View>
    </MarcoSesionWeb>
  );
}

const estilos = StyleSheet.create({
  titulo: { width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.one, paddingTop: Spacing.four },
  tituloCompleto: { paddingHorizontal: Spacing.four },
  cuerpo: { flex: 1 },
});
