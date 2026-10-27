import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';
import { useTheme } from '@/hooks/use-theme';

export type DestinoInferior = 'inicio' | 'depas' | 'roomies' | 'servicios';

// `selected` no se escribe para enlaces en la web: la página actual se anuncia con `aria-current="page"`.
const ACTUAL = { 'aria-current': 'page' } as object;
// Fija abajo de la ventana (RN no tiene `position: fixed`; React Native Web sí lo deja pasar al CSS).
const FIJA = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20 } as unknown as ViewStyle;

const ITEMS: { clave: DestinoInferior | 'entrar'; etiqueta: string; visible: string; icono: keyof typeof Ionicons.glyphMap; ruta: string }[] = [
  { clave: 'inicio', etiqueta: 'Inicio', visible: 'Inicio', icono: 'home-outline', ruta: RutasWeb.inicio },
  { clave: 'depas', etiqueta: 'Departamentos', visible: 'Lugares', icono: 'bed-outline', ruta: RutasWeb.departamentos },
  { clave: 'roomies', etiqueta: 'Roomies', visible: 'Roomies', icono: 'people-outline', ruta: RutasWeb.roomies },
  { clave: 'servicios', etiqueta: 'Servicios', visible: 'Servicios', icono: 'storefront-outline', ruta: RutasWeb.servicios },
  { clave: 'entrar', etiqueta: 'Iniciar sesión', visible: 'Entrar', icono: 'person-circle-outline', ruta: '/(auth)/login' },
];

/**
 * La barra inferior fija del teléfono: Inicio, Lugares, Roomies, Servicios y Entrar. Es la navegación a la mano (las pestañas de arriba solo existen en pantallas anchas). La página actual se
 * anuncia con `aria-current` y se tiñe del acento; cada botón mide al menos 44 de alto.
 */
export function BarraInferiorWeb({ activa }: { activa: DestinoInferior | null }) {
  const theme = useTheme();
  return (
    <View role="navigation" aria-label="Navegación principal" style={[estilos.barra, FIJA, { backgroundColor: theme.backgroundElement, borderTopColor: theme.filete }]}>
      {ITEMS.map((i) => {
        const actual = activa === i.clave;
        const color = actual ? theme.acento : theme.textSecondary;
        return (
          <Pulsable key={i.clave} onPress={() => router.push(i.ruta as never)} accessibilityRole="link" accessibilityLabel={i.etiqueta} {...(actual ? ACTUAL : {})} style={estilos.item}>
            <Ionicons name={i.icono} size={24} color={color} />
            <ThemedText style={[Texto.etiqueta, { color }]}>{i.visible}</ThemedText>
          </Pulsable>
        );
      })}
    </View>
  );
}

/** Lo que una página del teléfono debe dejar libre abajo para que la barra no tape el final. */
export const ALTO_BARRA_INFERIOR = 76;

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', borderTopWidth: Filete.fino, paddingTop: Spacing.one, paddingBottom: Spacing.two },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: Spacing.half },
});
