import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ALTO_BARRA_INFERIOR, BarraInferiorWeb, type DestinoInferior } from '@/components/web/BarraInferiorWeb';
import { EncabezadoWeb } from '@/components/web/EncabezadoWeb';
import { AnchoMaximoWeb, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { medidasWeb } from '@/lib/medidasWeb';

const DESTINOS: Record<string, DestinoInferior> = { '/chats': 'chats', '/perfil': 'cuenta', '/panel': 'panel', '/publicar': 'publicar' };

/**
 * El marco de las pantallas de DENTRO en la web (favoritos, chats, perfil, panel, publicar): el encabezado de la web arriba, el contenido en medio y, solo en teléfono, la barra inferior fija.
 * Esas pantallas se hicieron para el teléfono y traían su propia barra de pestañas; en la web la barra de pestañas se apaga y este marco ocupa su lugar.
 */
export function MarcoSesionWeb({ children }: { children: ReactNode }) {
  const { ancho } = useTamanoPantalla();
  const { escritorio, telefono, relleno } = medidasWeb(ancho);
  const ruta = usePathname();
  return (
    <ThemedView style={estilos.raiz}>
      <View style={[estilos.encabezado, { paddingHorizontal: relleno }]}>
        <EncabezadoWeb activa={null} escritorio={escritorio} telefono={telefono} />
      </View>
      <View style={[estilos.contenido, telefono && { paddingBottom: ALTO_BARRA_INFERIOR }]}>{children}</View>
      {telefono ? <BarraInferiorWeb activa={DESTINOS[ruta] ?? null} /> : null}
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  encabezado: { width: '100%', maxWidth: AnchoMaximoWeb, alignSelf: 'center', paddingTop: Spacing.three },
  contenido: { flex: 1, width: '100%', maxWidth: AnchoMaximoWeb, alignSelf: 'center' },
});
