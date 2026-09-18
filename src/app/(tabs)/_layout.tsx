import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { AppColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NombreIcono = keyof typeof Ionicons.glyphMap;

function crearIcono(activo: NombreIcono, inactivo: NombreIcono) {
  function Icono({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? activo : inactivo} size={size} color={color as string} />;
  }
  Icono.displayName = `Icono(${activo})`;
  return Icono;
}

export default function TabsLayout() {
  const theme = useTheme();

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
