// Conecta el registro de la app con la base (ver `lib/telemetria.ts` y la migración 0068). Se llama UNA vez al arrancar.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { fallo, registrarSumidero } from '@/lib/registro';
import { supabase } from '@/lib/supabase';
import { crearSumideroRemoto, iniciarCapturaGlobal } from '@/lib/telemetria';
import { useAuthStore } from '@/store/useAuthStore';

let iniciado = false;

/**
 * Enchufa el sumidero remoto y la captura de errores globales. Idempotente. NO envía nada desde una compilación de desarrollo: los errores de quien
 * está programando no son los de la gente que usa la app, y mezclarlos ensuciaría el panel de producción.
 */
export function iniciarRegistroRemoto(): void {
  if (iniciado || __DEV__) return;
  iniciado = true;

  registrarSumidero(
    crearSumideroRemoto({
      enviar: async (r) => {
        const { error } = await supabase.rpc('registrar_error_app', {
          p_nivel: r.nivel,
          p_mensaje: r.mensaje,
          p_detalle: r.detalle,
          p_version: r.version,
          p_plataforma: r.plataforma,
        });
        if (error) throw error; // se traga en el sumidero: registrar un error no puede producir otro
      },
      version: Constants.expoConfig?.version ?? '?',
      plataforma: Platform.OS,
      haySesion: () => Boolean(useAuthStore.getState().session),
    }),
  );

  iniciarCapturaGlobal((globalThis as { ErrorUtils?: Parameters<typeof iniciarCapturaGlobal>[0] }).ErrorUtils, fallo);
}
