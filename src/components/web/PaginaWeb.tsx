import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ALTO_BARRA_INFERIOR, BarraInferiorWeb } from '@/components/web/BarraInferiorWeb';
import { EncabezadoWeb } from '@/components/web/EncabezadoWeb';
import { PieWeb } from '@/components/web/PieWeb';
import type { SeccionWeb } from '@/components/web/PestanasWeb';
import { AnchoMaximoWeb, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { medidasWeb } from '@/lib/medidasWeb';
import { anim } from '@/lib/movimientoWeb';

/**
 * El armazón de una página interior de la web: la barra con su sección marcada, el contenido acotado y centrado, y el pie de borde a borde. Pone además el título de la pestaña del navegador
 * («Departamentos y cuartos · Cuervo 360»): cada página tiene el suyo.
 */
export function PaginaWeb({ activa, titulo, children }: { activa: SeccionWeb | null; titulo: string; children: ReactNode }) {
  const { ancho } = useTamanoPantalla();
  const { escritorio, telefono, relleno } = medidasWeb(ancho);
  return (
    <ThemedView style={estilos.raiz}>
      <Head>
        <title>{`${titulo} · Cuervo 360`}</title>
      </Head>
      <ScrollView contentContainerStyle={telefono ? { paddingBottom: ALTO_BARRA_INFERIOR } : undefined}>
        <View style={[estilos.contenido, { paddingHorizontal: relleno }]}>
          <EncabezadoWeb activa={activa} escritorio={escritorio} telefono={telefono} />
          {/* El encabezado se queda quieto; el contenido de cada página entra con un ascenso corto. */}
          <View style={estilos.cuerpo} {...anim('pagina')}>{children}</View>
        </View>
        <PieWeb />
      </ScrollView>
      {telefono ? <BarraInferiorWeb activa={activa} /> : null}
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  cuerpo: { gap: Spacing.five },
  contenido: { width: '100%', maxWidth: AnchoMaximoWeb, alignSelf: 'center', gap: Spacing.five, paddingTop: Spacing.three, paddingBottom: Spacing.six },
});
