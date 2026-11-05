import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ConversacionHilo } from '@/components/ConversacionHilo';

// La conversación en pantalla completa (teléfono). El hilo mismo vive en `ConversacionHilo`; aquí solo se pone el nombre de la contraparte de título.
export default function ConversacionScreen() {
  const { conversacionId } = useLocalSearchParams<{ conversacionId: string }>();
  const [nombreOtro, setNombreOtro] = useState('Conversación');
  return (
    <>
      <Stack.Screen options={{ title: nombreOtro }} />
      <ConversacionHilo conversacionId={conversacionId} alConocerNombre={setNombreOtro} />
    </>
  );
}
