// Cliente de consultas y claves · END-18
//
// Antes, cada pantalla de lista era `useState` + `useFocusEffect(cargar)`. Eso
// significa: sin caché, sin deduplicación, sin reintento, sin backoff, sin
// offline. Cada regreso desde el detalle reconsultaba el motor completo, y el
// arreglo se reemplazaba entero — parpadeo y pérdida de la posición del scroll.
//
// Las CLAVES viven aquí y no esparcidas por los hooks. Una clave escrita a mano
// en dos sitios es una invalidación que algún día deja de funcionar en uno de
// los dos, y ese fallo es silencioso: la pantalla simplemente muestra datos
// viejos y nadie lo nota hasta que alguien jura que guardó algo.

import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

export const claves = {
  sugerencias: (tipo: string | null) => ['sugerencias', tipo] as const,
  publicacion: (id: string) => ['publicacion', id] as const,
  misPublicaciones: (usuarioId: string) => ['misPublicaciones', usuarioId] as const,
  contactosRecibidos: () => ['contactosRecibidos'] as const,
  conversaciones: (usuarioId: string) => ['conversaciones', usuarioId] as const,
  mensajes: (conversacionId: string) => ['mensajes', conversacionId] as const,
  miPerfil: (usuarioId: string) => ['miPerfil', usuarioId] as const,
  perfilPublico: (usuarioId: string) => ['perfilPublico', usuarioId] as const,
  roomies: () => ['roomies'] as const,
} as const;

/**
 * `extra` existe para las pruebas: permite acortar el backoff sin duplicar el
 * resto de la configuración, que es lo que haría que la prueba dejara de
 * comprobar la configuración real.
 */
export function crearClienteConsultas(extra?: QueryClientConfig['defaultOptions']) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Treinta segundos. Volver del detalle a la lista no debe reconsultar
        // el motor entero; abrir la app por la mañana sí.
        staleTime: 30_000,

        // Dos reintentos con backoff. La red móvil falla de forma transitoria
        // mucho más a menudo que de forma definitiva, y hasta ahora un fallo
        // puntual dejaba la pantalla vacía hasta que alguien deslizara.
        retry: 2,
        retryDelay: (intento) => Math.min(1000 * 2 ** intento, 8000),

        // No existe "ventana" en un teléfono, y `AppState` dispara esto al
        // volver del selector de fotos o de WhatsApp. Reconsultar ahí es gastar
        // batería y datos para redibujar lo mismo.
        refetchOnWindowFocus: false,
        ...extra?.queries,
      },
      mutations: {
        // Las mutaciones NO se reintentan solas: revelar un contacto consume
        // cuota y enviar un mensaje lo duplica. Un reintento automático aquí
        // convierte un fallo en dos efectos.
        retry: 0,
        ...extra?.mutations,
      },
    },
  });
}
