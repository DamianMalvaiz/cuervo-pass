import { router } from 'expo-router';
import { View } from 'react-native';

import { ConfianzaWeb } from '@/components/web/ConfianzaWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { RoomiesWeb } from '@/components/web/RoomiesWeb';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { medidasWeb } from '@/lib/medidasWeb';

// `/roomies` · la página de Roomies. Sin cuenta no hay perfiles reales que enseñar (se ven al iniciar sesión): aquí se explica de qué trata y cómo se ve una tarjeta de compatibilidad, con personas de EJEMPLO marcadas como tales.

export default function Roomies() {
  const { ancho } = useTamanoPantalla();
  const { escritorio } = medidasWeb(ancho);
  return (
    <PaginaWeb activa="roomies" titulo="Roomies">
      <RoomiesWeb escritorio={escritorio} textoBoton="Iniciar sesión para ver roomies" alBoton={() => router.push('/(auth)/login')} />
      <View>
        <ConfianzaWeb escritorio={escritorio} />
      </View>
    </PaginaWeb>
  );
}
