import { useState } from 'react';

import { Sello } from '@/components/ficha/Sello';
import { useCuentaRestringida } from '@/hooks/queries/useCuentaRestringida';
import { abrirChatCon } from '@/lib/abrirChat';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * «Escribir en la app» · Cuervo 360. El camino principal para contactar a quien publicó.
 *
 * Contactar dentro de la app deja la conversación DENTRO: se puede moderar, queda constancia y no se
 * expone ningún teléfono. «Ver contacto» (WhatsApp) es la segunda opción, con su cuota diaria. Abrir la
 * conversación crea una fila, así que dos toques seguidos no la abren dos veces. La base rechaza
 * escribirse a uno mismo, así que en tu propia publicación el botón ni se ofrece.
 */
export function BotonEscribir({ otroUsuarioId }: { otroUsuarioId: string }) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const [abriendo, setAbriendo] = useState(false);
  // Una cuenta restringida (0082) no abre conversaciones nuevas: no se ofrece lo que la base va a rechazar.
  const restringida = useCuentaRestringida(miId);

  if (!miId || miId === otroUsuarioId || restringida) return null;

  const abrir = async () => {
    if (abriendo) return;
    setAbriendo(true);
    try {
      await abrirChatCon(otroUsuarioId);
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <Sello
      icono="chatbubble-ellipses-outline"
      onPress={abrir}
      cargando={abriendo}
      accessibilityLabel="Escribir en la app"
    >
      Escribir en la app
    </Sello>
  );
}
