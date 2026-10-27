import { router } from 'expo-router';
import { Dimensions, Platform } from 'react-native';

import { CP, SQL, esCodigo } from '@/lib/erroresPostgres';
import { aviso } from '@/lib/registro';
import { toast } from '@/lib/toast';
import { abrirConversacion } from '@/services/mensajes.service';

/** A dónde va una conversación recién abierta: en la web de escritorio, a la bandeja con ella elegida; en el teléfono y en la app, a su pantalla. */
export function rutaDeConversacion(conversacionId: string, plataforma: string, ancho: number): string {
  return plataforma === 'web' && ancho >= 1000 ? `/chats?c=${conversacionId}` : `/chat/${conversacionId}`;
}

/**
 * Abre —o recupera— la conversación con otra persona y navega a ella. NUNCA lanza: quien la llama
 * solo gestiona su propio estado de «abriendo».
 *
 * La conversación la crea una función de Postgres, no un insert del cliente (AUD-07): dos personas que
 * tocan a la vez reciben el MISMO identificador. Si falla, NO se navega: llevar a `/chat/undefined`
 * dejaría a la persona en una pantalla vacía después de haber pulsado.
 *
 * Los dos fallos se dicen distinto, y por CÓDIGO (END-27). `abrir_conversacion` falla con `raise
 * exception` (P0001) cuando el destinatario no es válido o ya no está activo; cualquier otro fallo es
 * de conexión. Antes TODO se decía «esta persona ya no está disponible», incluida una caída de red:
 * la app afirmaba algo sobre otra persona que no era cierto (END-11).
 */
export async function abrirChatCon(otroUsuarioId: string): Promise<void> {
  try {
    const conversacionId = await abrirConversacion(otroUsuarioId);
    router.push(rutaDeConversacion(conversacionId, Platform.OS, Dimensions.get('window').width) as never);
  } catch (e) {
    aviso('abrirConversacion falló', undefined, e);
    toast.error(
      esCodigo(e, CP.CUENTA_RESTRINGIDA)
        ? 'Una cuenta de vendedor no puede iniciar conversaciones. Sí puedes responder a quien te escribe.'
        : esCodigo(e, SQL.RAISE_EXCEPTION)
          ? 'No se pudo abrir el chat. Esta persona ya no está disponible.'
          : 'No pudimos abrir el chat. Revisa tu conexión e intenta de nuevo.'
    );
  }
}
