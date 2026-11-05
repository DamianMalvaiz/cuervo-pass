import { useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { FormularioNegocio, type VistaPreviaNegocio } from '@/components/FormularioNegocio';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConVistaPreviaApp } from '@/components/ConVistaPreviaApp';
import { MarcoNegocioWeb } from '@/components/web/MarcoNegocioWeb';
import { VistaPreviaNegocioWeb } from '@/components/web/VistaPreviaNegocioWeb';
import { Spacing } from '@/constants/theme';
import { useMiNegocio } from '@/hooks/queries/useMisNegocios';

/**
 * Editar un negocio propio. Tres estados y no dos (END-11): cargando, falló, y «no existe o no es tuyo» se pintan distinto.
 * El formulario solo se monta cuando ya están el negocio y su menú, para que arranque con los datos reales y no en blanco.
 */
export default function EditarNegocioScreen() {
  // En la web, con el marco de la web y una vista previa al lado; sin marco (app), el formulario lleva su propia barra de vista previa.
  return Platform.OS === 'web' ? <MarcoNegocioWeb>{(alVistaPrevia) => <EditarNegocio alVistaPrevia={alVistaPrevia} />}</MarcoNegocioWeb> : <EditarNegocio />;
}

function EditarNegocio({ alVistaPrevia }: { alVistaPrevia?: (v: VistaPreviaNegocio) => void }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { negocio, items, turnos, cargando, fallo, reintentar } = useMiNegocio(id);

  if (cargando) {
    return (
      <ThemedView style={estilos.centrado}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando…</ThemedText>
      </ThemedView>
    );
  }
  if (fallo) {
    return (
      <ThemedView style={estilos.centrado}>
        <ThemedText type="small" themeColor="textSecondary">No pudimos cargar tu negocio. Revisa tu conexión e intenta de nuevo.</ThemedText>
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">Reintentar</Sello>
      </ThemedView>
    );
  }
  if (!negocio) {
    return (
      <ThemedView style={estilos.centrado}>
        <ThemedText type="small" themeColor="textSecondary">Este negocio no existe o no es tuyo.</ThemedText>
      </ThemedView>
    );
  }
  const formulario = (alVista?: (v: VistaPreviaNegocio) => void) => <FormularioNegocio inicial={{ negocio, items, turnos }} onVistaPrevia={alVista} />;
  // En la app (y solo con el negocio ya cargado) una barra fija ofrece la vista previa en una hoja.
  if (Platform.OS !== 'web') {
    return (
      <ConVistaPreviaApp<VistaPreviaNegocio> boton="Ver cómo se verá" titulo="Así se verá en Servicios" vista={(v) => <VistaPreviaNegocioWeb v={v} />}>
        {(alVista) => formulario(alVista)}
      </ConVistaPreviaApp>
    );
  }
  return formulario(alVistaPrevia);
}

const estilos = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
});
