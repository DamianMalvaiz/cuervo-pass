// Los errores de la app llegan a un sitio donde alguien los mira · plan de excelencia 0.2 (migración 0068).
//
// `lib/registro.ts` ya centraliza los avisos y errores, y ya limpia correos y claves sensibles; solo le faltaba un destino que no fuera la consola del
// teléfono (invisible en una APK de producción). Este módulo es ese sumidero. Lo que se manda: nivel, mensaje y un detalle técnico, más la versión de la
// app y la plataforma. NO se manda quién: el servidor ni siquiera guarda un id de cuenta.
//
// Reglas de un registrador que no puede volverse un problema:
//   · registrar un error NUNCA produce otro: todo fallo del envío se traga en silencio (no se llama a `aviso`, que volvería a pasar por aquí);
//   · no repite el mismo mensaje en 10 minutos y tiene tope por sesión: un bucle de errores no inunda la red ni la cuota;
//   · sin sesión no envía (el servidor solo acepta cuentas con sesión);
//   · no se traga el error original: la captura global entrega el error al manejador anterior de React Native.

import type { Evento } from '@/lib/registro';
import { textoDeError } from '@/lib/registro';

export interface ReporteError {
  nivel: 'aviso' | 'error';
  mensaje: string;
  detalle: string | null;
  version: string;
  plataforma: string;
}

const VENTANA_MS = 10 * 60 * 1000;
const MAX_DETALLE = 500;

export function crearSumideroRemoto(opciones: {
  enviar: (r: ReporteError) => Promise<unknown> | unknown;
  version: string;
  plataforma: string;
  haySesion: () => boolean;
  ahora?: () => number;
  maxPorSesion?: number;
}): (evento: Evento) => void {
  const { enviar, version, plataforma, haySesion } = opciones;
  const ahora = opciones.ahora ?? Date.now;
  const maximo = opciones.maxPorSesion ?? 20;
  const vistos = new Map<string, number>();
  let enviados = 0;

  return (evento) => {
    try {
      if (enviados >= maximo || !haySesion()) return;
      const clave = `${evento.nivel}|${evento.mensaje}`;
      const t = ahora();
      const antes = vistos.get(clave);
      if (antes !== undefined && t - antes < VENTANA_MS) return;
      vistos.set(clave, t);
      enviados++;

      const partes: string[] = [];
      if (evento.error !== undefined) partes.push(textoDeError(evento.error));
      if (evento.datos && Object.keys(evento.datos).length > 0) {
        try {
          partes.push(JSON.stringify(evento.datos));
        } catch {
          /* datos no serializables: se omiten */
        }
      }
      const detalle = partes.length > 0 ? partes.join(' | ').slice(0, MAX_DETALLE) : null;

      const resultado = enviar({ nivel: evento.nivel, mensaje: evento.mensaje, detalle, version, plataforma });
      if (resultado && typeof (resultado as Promise<unknown>).catch === 'function') {
        (resultado as Promise<unknown>).catch(() => undefined);
      }
    } catch {
      /* registrar un error no puede producir otro */
    }
  };
}

interface UtilidadesDeError {
  getGlobalHandler?: () => ((e: unknown, fatal?: boolean) => void) | undefined;
  setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void;
}

/**
 * Captura los errores que nadie atrapó (los que hoy cierran la app) y los registra ANTES de entregarlos al manejador anterior de React Native: se ve
 * el fallo, y el comportamiento de siempre (la pantalla de error, el cierre) no cambia. Sin `ErrorUtils` (web, pruebas) no hace nada.
 */
export function iniciarCapturaGlobal(
  utilidades: UtilidadesDeError | undefined,
  registrar: (mensaje: string, datos?: Record<string, unknown>, error?: unknown) => void,
): void {
  if (!utilidades) return;
  const previo = utilidades.getGlobalHandler?.();
  utilidades.setGlobalHandler((error, esFatal) => {
    try {
      registrar(esFatal ? 'Error fatal no capturado' : 'Error no capturado', undefined, error);
    } catch {
      /* el registro no puede impedir que el error siga su camino */
    }
    previo?.(error, esFatal);
  });
}
