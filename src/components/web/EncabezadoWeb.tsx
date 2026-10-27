import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { PestanasWeb, type SeccionWeb } from '@/components/web/PestanasWeb';
import { Filete, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';

/**
 * La barra de las páginas interiores (`/departamentos`, `/roomies`, `/servicios`): el logo (lleva al inicio), las tres pestañas con la de esta página marcada y las dos cuentas.
 * En una tableta las pestañas pasan a una segunda fila que se desliza. En el teléfono (`telefono`) el encabezado es delgado —el logo y «Iniciar sesión»— porque la navegación vive en la barra inferior fija.
 */
export function EncabezadoWeb({ activa, escritorio, telefono = false }: { activa: SeccionWeb | null; escritorio: boolean; telefono?: boolean }) {
  const theme = useTheme();
  const pestanas = <PestanasWeb activa={activa} tono="claro" />;
  return (
    <View style={[estilos.barra, { borderBottomColor: theme.filete }]}>
      <View style={estilos.fila}>
        <Pulsable onPress={() => router.push(RutasWeb.inicio)} accessibilityRole="link" accessibilityLabel="Ir al inicio" style={estilos.marca}>
          <LogoMarca tamano={40} />
          {escritorio ? <ThemedText style={Texto.subtitulo}>Cuervo 360</ThemedText> : null}
        </Pulsable>
        {escritorio ? <View style={estilos.pestanas}>{pestanas}</View> : null}
        <View style={estilos.cuentas}>
          <BotonWeb compacto={!escritorio} variante="contorno" onPress={() => router.push('/(auth)/login')}>Iniciar sesión</BotonWeb>
          {telefono ? null : <BotonWeb compacto={!escritorio} variante="carbon" onPress={() => router.push('/(auth)/registro')}>Crear cuenta</BotonWeb>}
        </View>
      </View>
      {!escritorio && !telefono ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pestanas}
        </ScrollView>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: Filete.fino },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  pestanas: { marginLeft: Spacing.three },
  cuentas: { flexDirection: 'row', gap: Spacing.two, marginLeft: 'auto', alignItems: 'center' },
});
