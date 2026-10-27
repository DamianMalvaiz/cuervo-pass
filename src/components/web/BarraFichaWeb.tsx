import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * La barra de las fichas públicas: el logo (lleva a la portada) y las dos cuentas arriba; abajo, «Volver» y las dos acciones de la ficha.
 * «Volver» regresa si hay a dónde; si la persona llegó por un enlace directo, no hay historial y va a la portada.
 * «Guardar» pide entrar (sin cuenta no se guarda nada); «Compartir» copia el enlace de la ficha (solo en la web, donde hay portapapeles).
 */
export function BarraFichaWeb({ escritorio }: { escritorio: boolean }) {
  const theme = useTheme();
  const [copiado, setCopiado] = useState(false);

  const volver = () => (router.canGoBack() ? router.back() : router.push('/explorar'));
  const compartir = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
    } catch {
      // Sin portapapeles (o sin permiso) no hay nada que avisar: el enlace está en la barra de direcciones.
    }
  };
  const puedeCompartir = Platform.OS === 'web' && typeof navigator !== 'undefined' && Boolean(navigator.clipboard);

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.fila}>
        <Pulsable onPress={() => router.push('/explorar')} accessibilityRole="link" accessibilityLabel="Ir a la portada" style={estilos.marca}>
          <LogoMarca tamano={40} />
          {escritorio ? <ThemedText style={Texto.subtitulo}>Cuervo 360</ThemedText> : null}
        </Pulsable>
        <View style={estilos.cuentas}>
          <BotonWeb compacto={!escritorio} variante="contorno" onPress={() => router.push('/(auth)/login')}>Iniciar sesión</BotonWeb>
          <BotonWeb compacto={!escritorio} variante="carbon" onPress={() => router.push('/(auth)/registro')}>Crear cuenta</BotonWeb>
        </View>
      </View>
      <View style={estilos.fila}>
        <Pulsable onPress={volver} accessibilityRole="link" accessibilityLabel="Volver" style={estilos.volver}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <ThemedText style={Texto.pequenoFuerte}>{escritorio ? 'Volver a los resultados' : 'Volver'}</ThemedText>
        </Pulsable>
        <View style={estilos.acciones}>
          {puedeCompartir ? (
            <Pulsable onPress={compartir} accessibilityRole="button" accessibilityLabel="Compartir" style={[estilos.accion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <Ionicons name={copiado ? 'checkmark' : 'share-outline'} size={18} color={theme.text} />
              <ThemedText style={Texto.pequenoFuerte}>{copiado ? 'Enlace copiado' : 'Compartir'}</ThemedText>
            </Pulsable>
          ) : null}
          <Pulsable onPress={() => router.push('/(auth)/login')} accessibilityRole="button" accessibilityLabel="Guardar: inicia sesión para guardar" style={[estilos.accion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="heart-outline" size={18} color={theme.text} />
            <ThemedText style={Texto.pequenoFuerte}>Guardar</ThemedText>
          </Pulsable>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Spacing.three },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, flexWrap: 'wrap' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  cuentas: { flexDirection: 'row', gap: Spacing.two },
  volver: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
  acciones: { flexDirection: 'row', gap: Spacing.two },
  accion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino },
});
