import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="inicio" options={{ title: 'Sugerencias' }} />
      <Tabs.Screen name="publicaciones" options={{ title: 'Publicaciones' }} />
      <Tabs.Screen name="roomings" options={{ title: 'Roomings' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
