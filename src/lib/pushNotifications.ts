// Notificaciones push (Semana 11) vía el servicio propio de Expo — no FCM/
// Firebase directo (esa API legacy ya no existe; Expo entrega por FCM/APNs
// por dentro sin que este proyecto tenga que configurar nada de Firebase).
//
// Requiere un development build (EAS Build) — Expo Go en Android ya no
// soporta push remoto desde el SDK 53. En Expo Go, registrarTokenPush()
// simplemente no obtiene token y no hace nada (nunca bloquea el flujo,
// sección 17).
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registrarTokenPush(usuarioId: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Falta el projectId de EAS en app.json — no se puede pedir el token push.');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ usuario_id: usuarioId, token, actualizado_en: new Date().toISOString() }, { onConflict: 'usuario_id' });
    if (error) console.warn('No se pudo guardar el token push:', error);
  } catch (e) {
    console.warn('registrarTokenPush falló (normal en Expo Go, sección 17 — nunca bloquea):', e);
  }
}

// Al tocar una notificación de mensaje nuevo, abre esa conversación en vez de
// solo abrir la app en la pantalla que tenía abierta.
//
// La ruta es `chat/[conversacionId]`, no el id del remitente: desde v5 §26 el
// hilo es una fila real en `conversaciones` y la pantalla se dirige por su id.
// Con `remitente_id` esto abría una ruta que ya no existe — y un deep link roto
// no truena, solo deja al usuario en una pantalla vacía después de haber tocado
// la notificación, que es la peor forma de fallar.
//
// `conversacion_id` lo manda el trigger `al_insertar_mensaje` (migración 0012).
export function useAbrirChatDesdeNotificacion() {
  useEffect(() => {
    const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      const datos = respuesta.notification.request.content.data as {
        tipo?: string;
        conversacion_id?: string;
      };
      if (datos?.tipo === 'nuevo_mensaje' && datos.conversacion_id) {
        router.push(`/chat/${datos.conversacion_id}`);
      }
    });
    return () => suscripcion.remove();
  }, []);
}
