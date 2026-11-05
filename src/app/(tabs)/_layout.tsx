import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AltoBarraPestanas,
  AltoPastillaPestana,
  AnchoPastillaPestana,
  DescuentoBarraIOS,
  Filete,
  Radios,
  Spacing,
  Tipografia,
} from '@/constants/theme';
import { MarcoSesionWeb } from '@/components/web/MarcoSesionWeb';
import { useTheme } from '@/hooks/use-theme';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { puedePublicar } from '@/lib/funciones';
import { pestanasVisibles, type NombrePestana } from '@/lib/perfilActivo';
import { registrarTokenPush, useAbrirChatDesdeNotificacion } from '@/lib/pushNotifications';
import { useAuthStore } from '@/store/useAuthStore';

type NombreIcono = keyof typeof Ionicons.glyphMap;

/**
 * La pestaña activa se marca con una PASTILLA lima detrás del icono, el icono relleno en vez de contorno y la
 * etiqueta más gruesa. Tres señales, ninguna dependiente solo del color. La pastilla ocupa su sitio siempre,
 * activa o no (transparente): si apareciera solo al activarse, el icono brincaría en cada cambio de pestaña.
 * El lima es RELLENO, nunca texto ni icono (1.68:1 sobre blanco), así que el icono va en carbón encima.
 */
function crearIcono(activo: NombreIcono, inactivo: NombreIcono) {
  function Icono({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    const theme = useTheme();
    return (
      <View style={[estilos.pastilla, { backgroundColor: focused ? theme.lima : 'transparent' }]}>
        <Ionicons
          name={focused ? activo : inactivo}
          size={size - 2}
          color={focused ? theme.limaTexto : (color as string)}
        />
      </View>
    );
  }
  Icono.displayName = `Icono(${activo})`;
  return Icono;
}

// Solo se llega aquí con sesión activa Y cuestionario completo (guard de §26 en
// index.tsx) — momento correcto para pedir permiso y registrar el token push,
// sin bloquear el flujo si falla (Expo Go, permiso negado, etc.).
export default function TabsLayout() {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { bottom: insetInferior } = useSafeAreaInsets();
  // En iPhone se resta un poco del área segura para que la barra no quede tan alta; en Android, completa.
  const bottom = Math.max(insetInferior - (Platform.OS === 'ios' ? DescuentoBarraIOS : 0), 0);
  // «Publicar» solo con una función de vendedor aprobada. Mientras se comprueba, o si la lectura
  // falla, `roles` viene vacío y la pestaña queda oculta: ante la duda, cerrada. Es una regla de
  // interfaz; la de la base llega con la verificación de vendedor.
  const { roles } = useMisRoles(miId);
  const verPublicar = puedePublicar(roles);
  // El perfil que usa la cuenta (0083) decide la barra: un negocio no ve Depas ni Roomies, un estudiante no ve el panel de un vendedor.
  // Mientras no se sabe, la de siempre. `href: null` esconde la pestaña sin quitar la ruta.
  const { perfil } = usePerfilActivo(miId);
  const visibles = pestanasVisibles(perfil, verPublicar);
  const href = (nombre: NombrePestana) => (visibles.includes(nombre) ? undefined : null);
  useAbrirChatDesdeNotificacion();

  useEffect(() => {
    if (miId) registrarTokenPush(miId);
  }, [miId]);

  const tabs = (
    <Tabs
      // En la web no hay barra de pestañas de app: el marco de la web (encabezado, y barra inferior en teléfono) ocupa su lugar.
      tabBar={Platform.OS === 'web' ? () => null : undefined}
      screenOptions={{
        // Sin barra de título: cada pantalla carga el suyo en el cuerpo, a
        // cuerpo grande y bajo el área segura. Es el patrón de la referencia, y
        // resuelve algo real: un título largo no se abrevia con puntos
        // suspensivos, y la etiqueta de la pestaña ya dice en qué sección estás.
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          // Un impreso separa sus bloques con filete, no con sombra. En Android
          // `elevation` pinta una sombra gris que este mundo no usa en ningún
          // lado, así que se apaga explícitamente.
          borderTopWidth: Filete.fino,
          borderTopColor: theme.border,
          elevation: 0,
          // El alto SUMA el área segura inferior. Un `height` fijo reemplaza el
          // que calcula React Navigation (49 + inset), y en Android con
          // navegación por gestos la barra del sistema se comía el icono y
          // la etiqueta: se vio en un teléfono real, no en las pruebas.
          height: AltoBarraPestanas + bottom,
          paddingBottom: bottom,
          paddingTop: Spacing.one,
        },
        tabBarLabelStyle: {
          fontFamily: Tipografia.semibold,
          fontSize: 11,
          marginTop: Spacing.half,
        },
        tabBarItemStyle: { paddingVertical: Spacing.one },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: Tipografia.semibold, fontSize: 16, letterSpacing: 0.2 },
        headerShadowVisible: false,
        // El filete bajo el encabezado sustituye a la sombra que se apagó arriba.
        headerStatusBarHeight: undefined,
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{ title: 'Explorar', href: href('inicio'), tabBarIcon: crearIcono('compass', 'compass-outline') }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{ title: 'Favoritos', href: href('favoritos'), tabBarIcon: crearIcono('heart', 'heart-outline') }}
      />
      <Tabs.Screen
        name="panel"
        options={{ title: 'Mi panel', href: href('panel'), tabBarIcon: crearIcono('grid', 'grid-outline') }}
      />
      <Tabs.Screen
        name="publicar"
        options={{
          title: perfil === 'vendedor' ? 'Publicaciones' : 'Publicar',
          // `href: null` la esconde de la barra sin quitar la ruta; la propia pantalla se guarda
          // por si se llega por un enlace directo. Para un vendedor es SU pestaña, aprobado o no.
          href: href('publicar'),
          tabBarIcon: crearIcono('add-circle', 'add-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: 'Chats', tabBarIcon: crearIcono('chatbubble', 'chatbubble-outline') }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: crearIcono('person-circle', 'person-circle-outline') }}
      />
    </Tabs>
  );
  return Platform.OS === 'web' ? <MarcoSesionWeb>{tabs}</MarcoSesionWeb> : tabs;
}

const estilos = StyleSheet.create({
  pastilla: {
    width: AnchoPastillaPestana,
    height: AltoPastillaPestana,
    borderRadius: Radios.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
