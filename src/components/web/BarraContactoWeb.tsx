import { router } from 'expo-router';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Filete, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const precioFormato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
// Fija abajo de la ventana (RN no tiene `position: fixed`; React Native Web sí lo deja pasar al CSS). Sale de `unknown` porque el tipo `ViewStyle` no conoce `fixed`.
const FIJA = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20 } as unknown as ViewStyle;

/** Lo que una ficha del teléfono deja libre abajo para que la barra no tape el final. */
export const ALTO_BARRA_CONTACTO = 92;

/**
 * La barra fija abajo de una ficha en teléfono: a la izquierda lo que cuesta (vivienda) o el nombre y su estado (negocio); a la derecha, el camino para escribir, que sin cuenta es entrar.
 * Reemplaza a la tarjeta de entrar de escritorio, que en una pantalla angosta quedaba al final de todo.
 */
export function BarraContactoWeb({ precio, nombre, detalle }: { precio?: number; nombre?: string; detalle?: string }) {
  const theme = useTheme();
  return (
    <View role="region" aria-label="Contactar" style={[estilos.barra, FIJA, { backgroundColor: theme.backgroundElement, borderTopColor: theme.filete }]}>
      <View style={estilos.dato}>
        {precio !== undefined ? (
          <ThemedText numberOfLines={1}>
            <Text style={Texto.titulo}>${precioFormato.format(precio)}</Text>
            <Text style={Texto.pequeno}> al mes</Text>
          </ThemedText>
        ) : (
          <>
            <ThemedText style={Texto.titulo} numberOfLines={1}>{nombre}</ThemedText>
            {detalle ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{detalle}</ThemedText> : null}
          </>
        )}
      </View>
      <BotonWeb grande onPress={() => router.push('/(auth)/login')} accessibilityLabel="Iniciar sesión para escribir">Escribir</BotonWeb>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: Filete.fino, paddingTop: Spacing.three, paddingBottom: Spacing.three, paddingHorizontal: Spacing.three },
  dato: { flex: 1, minWidth: 0 },
});
