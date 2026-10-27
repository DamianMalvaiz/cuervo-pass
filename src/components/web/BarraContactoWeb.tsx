import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useContactoPublicacion } from '@/hooks/use-contacto-publicacion';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';

const precioFormato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
// Fija abajo de la ventana (RN no tiene `position: fixed`; React Native Web sí lo deja pasar al CSS). Sale de `unknown` porque el tipo `ViewStyle` no conoce `fixed`.
const FIJA = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20 } as unknown as ViewStyle;

/** Lo que una ficha del teléfono deja libre abajo para que la barra no tape el final. */
export const ALTO_BARRA_CONTACTO = 92;

/**
 * La barra fija abajo de una ficha en teléfono: a la izquierda lo que cuesta (vivienda) o el nombre y su estado (negocio); a la derecha, el camino para escribir, que sin cuenta es entrar.
 * Con cuenta y con la vivienda (`publicacionId`) es «Escribir» (lo principal) y un botón de WhatsApp (lo segundo). Reemplaza a la tarjeta de escritorio, que en una pantalla angosta quedaba al final de todo.
 */
export function BarraContactoWeb({ precio, nombre, detalle, publicacionId, titulo }: { precio?: number; nombre?: string; detalle?: string; publicacionId?: string; titulo?: string }) {
  const hayCuenta = useAuthStore((s) => Boolean(s.session));
  if (hayCuenta && publicacionId && precio !== undefined) return <BarraConCuenta precio={precio} publicacionId={publicacionId} titulo={titulo ?? ''} />;
  return (
    <Barra
      dato={<DatoBarra precio={precio} nombre={nombre} detalle={detalle} />}
      accion={
        precio !== undefined ? (
          <BotonWeb grande onPress={() => router.push('/(auth)/login')} accessibilityLabel="Iniciar sesión para escribir">Escribir</BotonWeb>
        ) : (
          // Un negocio no recibe mensajes: la barra no promete escribir.
          <BotonWeb grande onPress={() => router.push('/(auth)/login')} accessibilityLabel="Entrar para ver la dirección exacta">Entrar</BotonWeb>
        )
      }
    />
  );
}

function BarraConCuenta({ precio, publicacionId, titulo }: { precio: number; publicacionId: string; titulo: string }) {
  const theme = useTheme();
  const c = useContactoPublicacion(publicacionId, titulo);
  let accion = null;
  if (c.fallo) accion = <BotonWeb variante="contorno" onPress={() => void c.reintentar()} accessibilityLabel="Reintentar">Reintentar</BotonWeb>;
  else if (c.esMia) accion = <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">Es tu publicación</ThemedText>;
  else if (!c.cargando) {
    accion = (
      <View style={estilos.acciones}>
        {c.puedeEscribir ? <BotonWeb grande onPress={() => void c.escribir()} accessibilityLabel="Escribir en la app">Escribir</BotonWeb> : null}
        <Pulsable onPress={() => void c.verContacto()} accessibilityRole="button" accessibilityLabel="Ver contacto" style={[estilos.whatsapp, { backgroundColor: theme.sello }]}>
          <Ionicons name="logo-whatsapp" size={22} color={theme.selloTexto} />
        </Pulsable>
      </View>
    );
  }
  return <Barra dato={<DatoBarra precio={precio} />} accion={accion} />;
}

function Barra({ dato, accion }: { dato: ReactNode; accion: ReactNode }) {
  const theme = useTheme();
  return (
    <View role="region" aria-label="Contactar" style={[estilos.barra, FIJA, { backgroundColor: theme.backgroundElement, borderTopColor: theme.filete }]}>
      <View style={estilos.dato}>{dato}</View>
      {accion}
    </View>
  );
}

function DatoBarra({ precio, nombre, detalle }: { precio?: number; nombre?: string; detalle?: string }) {
  return precio !== undefined ? (
    <ThemedText numberOfLines={1}>
      <Text style={Texto.titulo}>${precioFormato.format(precio)}</Text>
      <Text style={Texto.pequeno}> al mes</Text>
    </ThemedText>
  ) : (
    <>
      <ThemedText style={Texto.titulo} numberOfLines={1}>{nombre}</ThemedText>
      {detalle ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{detalle}</ThemedText> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderTopWidth: Filete.fino, paddingTop: Spacing.three, paddingBottom: Spacing.three, paddingHorizontal: Spacing.three },
  dato: { flex: 1, minWidth: 0 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  whatsapp: { width: 52, height: 52, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
});
