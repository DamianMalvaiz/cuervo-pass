import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { AppColors, Filete, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { registrarTokenPush, useAbrirChatDesdeNotificacion } from '@/lib/pushNotifications';
import { useAuthStore } from '@/store/useAuthStore';

type NombreIcono = keyof typeof Ionicons.glyphMap;

/**
 * La pestaña activa se marca con TRES señales, no con una.
 *
 * Solo teñir de ámbar sería codificar el estado únicamente con color, y quien no
 * distingue ese tono no ve nada. Aquí el estado activo trae: barra de sello
 * encima (una marca, como la pestaña levantada de un folder), icono relleno en
 * vez de contorno, y la etiqueta en semibold. Cualquiera de las tres basta.
 */
function crearIcono(activo: NombreIcono, inactivo: NombreIcono) {
  function Icono({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return (
      <View style={estilos.envolturaIcono}>
        <View style={[estilos.marca, focused && estilos.marcaActiva]} />
        <Ionicons name={focused ? activo : inactivo} size={size - 2} color={color as string} />
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
  useAbrirChatDesdeNotificacion();

  useEffect(() => {
    if (miId) registrarTokenPush(miId);
  }, [miId]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: theme.acento,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          // Un impreso separa sus bloques con filete, no con sombra. En Android
          // `elevation` pinta una sombra gris que este mundo no usa en ningún
          // lado, así que se apaga explícitamente.
          borderTopWidth: Filete.fino,
          borderTopColor: theme.border,
          elevation: 0,
          height: 64,
          paddingTop: Spacing.one,
        },
        tabBarLabelStyle: {
          fontFamily: Tipografia.semibold,
          fontSize: 10,
          letterSpacing: 0.6,
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
        options={{ title: 'Sugerencias', tabBarIcon: crearIcono('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="publicaciones"
        options={{ title: 'Publicaciones', tabBarIcon: crearIcono('business', 'business-outline') }}
      />
      <Tabs.Screen
        name="roomies"
        options={{ title: 'Roomies', tabBarIcon: crearIcono('people', 'people-outline') }}
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
}

const estilos = StyleSheet.create({
  envolturaIcono: { alignItems: 'center', gap: Spacing.one },
  // Siempre ocupa su espacio, activa o no: si apareciera solo al activarse,
  // el icono brincaría dos píxeles en cada cambio de pestaña.
  marca: { width: 18, height: Filete.grueso, backgroundColor: 'transparent' },
  marcaActiva: { backgroundColor: AppColors.sello },
});
