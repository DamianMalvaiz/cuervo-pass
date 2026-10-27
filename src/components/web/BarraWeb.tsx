import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { PestanasWeb, type SeccionWeb } from '@/components/web/PestanasWeb';
import { Colors, Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';

const D = Colors.dark;

/**
 * La barra de arriba del hero, sobre el carbón (siempre oscuro: el hero no cambia con el modo). El logo lleva al inicio, las pestañas a su página y las dos cuentas a entrar y registrarse.
 * En pantalla angosta no caben las pestañas ni el nombre: quedan el logo y las dos cuentas (la navegación sigue en el menú de cada página).
 */
export function BarraWeb({ escritorio, activa = null }: { escritorio: boolean; activa?: SeccionWeb | null }) {
  return (
    <View style={estilos.fila}>
      <Pulsable onPress={() => router.push(RutasWeb.inicio)} accessibilityRole="link" accessibilityLabel="Ir al inicio" style={estilos.marca}>
        <LogoMarca tamano={40} />
        {escritorio ? <ThemedText style={[Texto.subtitulo, { color: D.text }]}>Cuervo 360</ThemedText> : null}
      </Pulsable>

      {escritorio ? (
        <View style={estilos.pestanas}>
          <PestanasWeb activa={activa} tono="oscuro" />
        </View>
      ) : null}

      <View style={estilos.cuentas}>
        <BotonWeb compacto={!escritorio} variante="contornoClaro" onPress={() => router.push('/(auth)/login')}>Iniciar sesión</BotonWeb>
        <BotonWeb compacto={!escritorio} onPress={() => router.push('/(auth)/registro')}>Crear cuenta</BotonWeb>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  pestanas: { marginLeft: Spacing.three },
  cuentas: { flexDirection: 'row', gap: Spacing.two, marginLeft: 'auto', alignItems: 'center' },
});
