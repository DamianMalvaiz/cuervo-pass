import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useContactoPublicacion } from '@/hooks/use-contacto-publicacion';
import { useTheme } from '@/hooks/use-theme';

const precioFormato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * La tarjeta de contacto de una ficha para una cuenta con sesión (la de escritorio; en teléfono es la barra de abajo). «Escribir en la app» es el camino principal: la conversación se queda dentro, sin teléfonos.
 * «Ver contacto» abre WhatsApp y gasta una de las revelaciones del día, por eso lleva el sello (carbón). No se ofrece lo que la base va a rechazar: en tu propia publicación o, escribir, con una cuenta restringida.
 */
export function ContactoWeb({ publicacionId, titulo, precio }: { publicacionId: string; titulo: string; precio: number }) {
  const theme = useTheme();
  const c = useContactoPublicacion(publicacionId, titulo);
  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <ThemedText>
        <Text style={Texto.seccionWeb}>${precioFormato.format(precio)}</Text>
        <Text style={Texto.cuerpo}> al mes</Text>
      </ThemedText>
      {c.fallo ? (
        <ErrorDeCarga etiqueta="No pudimos cargar el contacto" onReintentar={() => void c.reintentar()} />
      ) : c.cargando ? (
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
      ) : c.esMia ? (
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Esta es tu publicación.</ThemedText>
      ) : (
        <>
          {c.puedeEscribir ? (
            <BotonWeb grande icono="chatbubble-ellipses-outline" onPress={() => void c.escribir()} accessibilityLabel="Escribir en la app">Escribir en la app</BotonWeb>
          ) : null}
          <BotonWeb grande variante="carbon" icono="logo-whatsapp" onPress={() => void c.verContacto()} accessibilityLabel="Ver contacto">Ver contacto</BotonWeb>
          <View style={estilos.nota}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.bosque} />
            <ThemedText style={[Texto.pequeno, estilos.notaTexto]} themeColor="textSecondary">
              Escribir en la app deja la conversación aquí, sin dar tu teléfono. «Ver contacto» abre WhatsApp y usa una de tus revelaciones de hoy.
            </ThemedText>
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino, boxShadow: '0px 30px 60px -28px rgba(10, 14, 11, 0.45)' },
  nota: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  notaTexto: { flex: 1 },
});
