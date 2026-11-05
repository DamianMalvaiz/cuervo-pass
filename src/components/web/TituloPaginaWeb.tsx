import Head from 'expo-router/head';
import { Platform, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Texto } from '@/constants/theme';

/**
 * El título de una pantalla de DENTRO en la web (y el de la pestaña del navegador), puesto dentro del propio contenido para que quede alineado con él, sea de una columna o de dos.
 * En la app no pinta nada: ahí lo pone la cabecera de la navegación.
 */
export function TituloPaginaWeb({ children }: { children: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <>
      <Head>
        <title>{`${children} · Cuervo 360`}</title>
      </Head>
      <ThemedText accessibilityRole="header" style={[Texto.seccionWebCompacto, estilos.titulo]}>{children}</ThemedText>
    </>
  );
}

const estilos = StyleSheet.create({
  titulo: { width: '100%', paddingTop: Spacing.two },
});
