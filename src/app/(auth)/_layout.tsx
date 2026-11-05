import { Stack, useSegments } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { PanelAccesoWeb } from '@/components/web/PanelAccesoWeb';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { conPanelDeAcceso } from '@/lib/accesoWeb';

export default function AuthLayout() {
  const { ancho } = useTamanoPantalla();
  const segmentos = useSegments();
  const pila = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="registro" />
      <Stack.Screen name="cuestionario-inicial" />
      <Stack.Screen name="recuperar-contrasena" />
    </Stack>
  );
  if (!conPanelDeAcceso({ plataforma: Platform.OS, ancho, segmentos })) return pila;
  return (
    <View style={estilos.fila}>
      <PanelAccesoWeb />
      <View style={estilos.formulario}>{pila}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flex: 1, flexDirection: 'row' },
  formulario: { flex: 1, minWidth: 0 },
});
