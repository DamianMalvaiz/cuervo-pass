import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { medidasWeb } from '@/lib/medidasWeb';
import { RutasWeb } from '@/lib/rutasWeb';

/** Las páginas informativas de la web (ayuda, guía de visita, contrato, acuerdos): contenido que no depende de la red ni de la cuenta, y que se ve igual con o sin sesión. */
export const PAGINAS_INFO = [
  { ruta: RutasWeb.ayuda, nombre: 'Ayuda y contacto' },
  { ruta: RutasWeb.guiaDeVisita, nombre: 'Guía para visitar un lugar' },
  { ruta: RutasWeb.contrato, nombre: 'Entiende tu contrato' },
  { ruta: RutasWeb.acuerdos, nombre: 'Acuerdos de convivencia' },
  { ruta: RutasWeb.presupuesto, nombre: '¿Qué alcanza con tu presupuesto?' },
] as const;

export function PaginaInfoWeb({ titulo, subtitulo, actual, children }: { titulo: string; subtitulo: string; actual: string; children: ReactNode }) {
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const { escritorio } = medidasWeb(ancho);
  const otras = PAGINAS_INFO.filter((p) => p.ruta !== actual);
  const cruces = (
    <View style={[estilos.otras, { borderTopColor: theme.filete }]}>
      <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">También te puede servir</ThemedText>
      <View style={estilos.enlaces}>
        {otras.map((p) => (
          <Pulsable key={p.ruta} onPress={() => router.push(p.ruta as never)} accessibilityRole="link" accessibilityLabel={p.nombre} style={[estilos.enlace, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={Texto.pequenoFuerte}>{p.nombre}</ThemedText>
          </Pulsable>
        ))}
      </View>
    </View>
  );
  // En la app no hay marco de la web (barra, pie): la cabecera de la navegación ya trae el título y la página es una columna que se desliza.
  if (Platform.OS !== 'web') {
    return (
      <ThemedView style={estilos.pantalla}>
        <ScrollView contentContainerStyle={estilos.desplazable} showsVerticalScrollIndicator={false}>
          <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{subtitulo}</ThemedText>
          {children}
          {cruces}
        </ScrollView>
      </ThemedView>
    );
  }
  return (
    <PaginaWeb activa={null} titulo={titulo}>
      <View style={estilos.cabecera}>
        <ThemedText accessibilityRole="header" style={escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto}>{titulo}</ThemedText>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{subtitulo}</ThemedText>
      </View>
      {children}
      {cruces}
    </PaginaWeb>
  );
}

/** Una caja con título, la unidad de lectura de estas páginas. */
export function BloqueInfoWeb({ titulo, children }: { titulo: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[estilos.bloque, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
      <ThemedText accessibilityRole="header" style={Texto.titulo}>{titulo}</ThemedText>
      {children}
    </View>
  );
}

/** La nota de «esto es orientación»: va siempre que una página habla de algo con consecuencias. */
export function NotaInfoWeb({ children }: { children: string }) {
  return <ThemedText style={Texto.pequeno} themeColor="textSecondary">{children}</ThemedText>;
}

export const estilosInfo = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'flex-start' },
  mitad: { flexGrow: 1, flexBasis: 320, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
});

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
  cabecera: { gap: Spacing.two },
  bloque: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.four, gap: Spacing.three },
  otras: { borderTopWidth: Filete.fino, paddingTop: Spacing.four, gap: Spacing.two },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  enlace: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, justifyContent: 'center' },
});
