import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;
const precioFormato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * La tarjeta que invita a entrar, al lado de una ficha: el precio (si lo hay), lo que se gana con una cuenta y los dos botones. `accion` es lo que dice el botón: por omisión «escribir» (viviendas); un negocio no recibe mensajes, así que no lo promete. Sin cuenta no se escribe, no se ve la dirección exacta ni el ajuste con el lugar.
 */
export function TarjetaEntrarWeb({ precio, mensaje, garantia, accion = 'Iniciar sesión para escribir' }: { precio?: number; mensaje: string; garantia?: string; accion?: string }) {
  const theme = useTheme();
  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      {precio !== undefined ? (
        <ThemedText>
          <Text style={Texto.seccionWeb}>${precioFormato.format(precio)}</Text>
          <Text style={Texto.cuerpo}> al mes</Text>
        </ThemedText>
      ) : null}
      <View style={[estilos.bloqueo, { backgroundColor: theme.background }]}>
        <View style={estilos.candado}>
          <Ionicons name="lock-closed-outline" size={20} color={D.lima} />
        </View>
        <ThemedText style={[Texto.pequenoFuerte, estilos.mensaje]}>{mensaje}</ThemedText>
      </View>
      <BotonWeb grande onPress={() => router.push('/(auth)/login')} accessibilityLabel={accion}>{accion}</BotonWeb>
      <BotonWeb grande variante="contorno" onPress={() => router.push('/(auth)/registro')}>Crear cuenta</BotonWeb>
      {garantia ? (
        <View style={estilos.garantia}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.bosque} />
          <ThemedText style={[Texto.pequeno, estilos.mensaje]} themeColor="textSecondary">{garantia}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino, boxShadow: '0px 30px 60px -28px rgba(10, 14, 11, 0.45)' },
  bloqueo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radios.tarjeta - Spacing.two },
  candado: { width: 44, height: 44, borderRadius: Radios.control, backgroundColor: D.background, alignItems: 'center', justifyContent: 'center' },
  mensaje: { flex: 1 },
  garantia: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
});
