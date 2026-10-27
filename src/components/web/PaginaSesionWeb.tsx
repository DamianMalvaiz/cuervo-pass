import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PieWeb } from '@/components/web/PieWeb';
import { Spacing, Texto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { medidasWeb } from '@/lib/medidasWeb';

/**
 * El cuerpo de una página de DENTRO en la web (favoritos, chats, perfil…): título grande, subtítulo, el contenido con el margen de siempre y el pie. El encabezado y la barra inferior los pone el marco
 * (`MarcoSesionWeb`); aquí solo va lo que cambia de página a página. Pone además el título de la pestaña del navegador.
 */
export function PaginaSesionWeb({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  const { ancho } = useTamanoPantalla();
  const { escritorio, telefono, relleno } = medidasWeb(ancho);
  return (
    <ScrollView>
      <Head>
        <title>{`${titulo} · Cuervo 360`}</title>
      </Head>
      <View style={[estilos.contenido, { paddingHorizontal: relleno }]}>
        <View style={estilos.cabecera}>
          <ThemedText accessibilityRole="header" style={escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto}>{titulo}</ThemedText>
          {subtitulo && !telefono ? <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{subtitulo}</ThemedText> : null}
        </View>
        {children}
      </View>
      <PieWeb />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.six },
  cabecera: { gap: Spacing.two },
});
