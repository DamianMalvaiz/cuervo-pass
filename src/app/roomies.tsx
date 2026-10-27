import { router } from 'expo-router';
import { View } from 'react-native';

import { ConfianzaWeb } from '@/components/web/ConfianzaWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { RoomiesConCuentaWeb } from '@/components/web/RoomiesConCuentaWeb';
import { RoomiesWeb } from '@/components/web/RoomiesWeb';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { medidasWeb } from '@/lib/medidasWeb';
import { useAuthStore } from '@/store/useAuthStore';

// `/roomies` · la página de Roomies. Con cuenta, las personas reales con su compatibilidad. Sin cuenta no hay perfiles reales que enseñar (se ven al iniciar sesión): aquí se explica de qué trata y cómo se ve una tarjeta de compatibilidad, con personas de EJEMPLO marcadas como tales.

export default function Roomies() {
  const hayCuenta = useAuthStore((s) => Boolean(s.session));
  const { ancho } = useTamanoPantalla();
  const { escritorio } = medidasWeb(ancho);
  if (hayCuenta) return <RoomiesConCuentaWeb />;
  return (
    <PaginaWeb activa="roomies" titulo="Roomies">
      <RoomiesWeb escritorio={escritorio} textoBoton="Iniciar sesión para ver roomies" alBoton={() => router.push('/(auth)/login')} />
      <View>
        <ConfianzaWeb escritorio={escritorio} />
      </View>
    </PaginaWeb>
  );
}
