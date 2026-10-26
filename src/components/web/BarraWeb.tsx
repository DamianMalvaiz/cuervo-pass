import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';

const D = Colors.dark;

export type SeccionWeb = 'depas' | 'roomies' | 'servicios';

const PESTANAS: { seccion: SeccionWeb; nombre: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { seccion: 'depas', nombre: 'Departamentos', icono: 'home-outline' },
  { seccion: 'roomies', nombre: 'Roomies', icono: 'people-outline' },
  { seccion: 'servicios', nombre: 'Servicios', icono: 'storefront-outline' },
];

/**
 * La barra de arriba de la web pública, sobre el carbón del hero (siempre oscuro: el hero no cambia con el modo).
 * Las pestañas llevan a una sección de la misma página; Roomies solo enseña de qué trata, sus perfiles piden cuenta.
 */
export function BarraWeb({ escritorio, onIrASeccion }: { escritorio: boolean; onIrASeccion: (s: SeccionWeb) => void }) {
  return (
    <View style={estilos.fila}>
      <View style={estilos.marca}>
        <LogoMarca tamano={40} />
        {escritorio ? <ThemedText style={[Texto.subtitulo, { color: D.text }]}>Cuervo 360</ThemedText> : null}
      </View>

      {escritorio ? (
        <View style={estilos.pestanas}>
          {PESTANAS.map((p, i) => (
            <Pulsable
              key={p.seccion}
              onPress={() => onIrASeccion(p.seccion)}
              accessibilityRole="link"
              accessibilityLabel={p.nombre}
              style={[estilos.pestana, i === 0 && estilos.pestanaActiva]}
            >
              <Ionicons name={p.icono} size={20} color={D.text} />
              <ThemedText style={[Texto.pequenoFuerte, { color: D.text }]}>{p.nombre}</ThemedText>
            </Pulsable>
          ))}
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
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pestanas: { flexDirection: 'row', gap: Spacing.one, marginLeft: Spacing.three },
  pestana: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full },
  pestanaActiva: { backgroundColor: D.backgroundSelected },
  cuentas: { flexDirection: 'row', gap: Spacing.two, marginLeft: 'auto', alignItems: 'center' },
});
