import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EnMarcoWeb } from '@/components/web/EnMarcoWeb';
import { Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';

/**
 * «No encontramos esa página». Sustituye a la pantalla por omisión de Expo Router («Unmatched Route», en inglés y con un enlace a un mapa de TODAS las rutas del sitio). Dice qué pasó sin culpar a nadie y da dos salidas.
 * En la web va dentro del marco del sitio (con la navegación); en la app, sola.
 */
export default function NoEncontrada() {
  return (
    <EnMarcoWeb titulo="No encontramos esa página">
      <ThemedView style={estilos.pantalla}>
        <View style={estilos.columna}>
          <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Puede que el enlace esté mal escrito o que el lugar ya no esté publicado.</ThemedText>
          <View style={estilos.acciones}>
            <BotonWeb onPress={() => router.replace(RutasWeb.inicio)} accessibilityLabel="Ir al inicio">Ir al inicio</BotonWeb>
            <BotonWeb variante="contorno" onPress={() => router.replace(RutasWeb.departamentos)} accessibilityLabel="Ver departamentos">Ver departamentos</BotonWeb>
          </View>
        </View>
      </ThemedView>
    </EnMarcoWeb>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, padding: Spacing.three },
  columna: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: Spacing.four },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
