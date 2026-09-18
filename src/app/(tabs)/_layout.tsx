import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';

import { AppColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { registrarTokenPush, useAbrirChatDesdeNotificacion } from '@/lib/pushNotifications';
import { useAuthStore } from '@/store/useAuthStore';

type NombreIcono = keyof typeof Ionicons.glyphMap;

function crearIcono(activo: NombreIcono, inactivo: NombreIcono) {
  function Icono({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? activo : inactivo} size={size} color={color as string} />;
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
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
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
