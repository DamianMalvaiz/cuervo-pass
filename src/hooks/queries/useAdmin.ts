// Panel de administración · Cuervo 360. Tres lecturas y tres acciones, todas por la Edge Function `admin`.
//
// Las lecturas dicen sus TRES estados (END-11): cargando, falló, y lista (que puede estar vacía). Un fallo nunca se pinta como «no hay
// nada pendiente»: en un panel de revisión eso haría creer que no hay solicitudes cuando solo no se pudieron leer.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { ErrorAdmin, esAdmin } from '@/lib/admin';
import { supabaseConfigurado } from '@/lib/supabase';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useAuthStore } from '@/store/useAuthStore';
import {
  type ErrorRegistrado, type ItemModeracion, type ResumenAdmin, type VerificacionPendiente,
  borrarError, fijarModoDemo, listarErrores, listarModeracion, listarVerificaciones, moderar, obtenerResumen, resolverVerificacion,
} from '@/services/admin.service';

const claveResumen = ['admin', 'resumen'] as const;
const claveVerificaciones = ['admin', 'verificaciones'] as const;
const claveModeracion = ['admin', 'moderacion'] as const;

// Sin reintentos automáticos: un 403 («no eres admin») no mejora repitiéndolo, y un fallo de red se reintenta a mano, con el botón.
const sinReintento = { retry: false } as const;

function lectura<T>(q: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }) {
  return {
    datos: q.data,
    cargando: q.isPending,
    fallo: q.isError,
    error: q.error instanceof ErrorAdmin ? q.error : null,
    reintentar: () => void q.refetch(),
  };
}

export function useResumenAdmin(habilitado: boolean) {
  return lectura<ResumenAdmin>(useQuery({ queryKey: claveResumen, queryFn: obtenerResumen, enabled: habilitado, ...sinReintento }));
}

export function useVerificacionesAdmin(habilitado: boolean) {
  return lectura<VerificacionPendiente[]>(useQuery({ queryKey: claveVerificaciones, queryFn: listarVerificaciones, enabled: habilitado, ...sinReintento }));
}

export function useModeracionAdmin(habilitado: boolean) {
  return lectura<ItemModeracion[]>(useQuery({ queryKey: claveModeracion, queryFn: listarModeracion, enabled: habilitado, ...sinReintento }));
}

const claveErrores = ['admin', 'errores'] as const;

export function useErroresAdmin(habilitado: boolean) {
  return lectura<ErrorRegistrado[]>(useQuery({ queryKey: claveErrores, queryFn: listarErrores, enabled: habilitado, ...sinReintento }));
}

export function useBorrarError() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => borrarError(id),
    onSettled: () => void cliente.invalidateQueries({ queryKey: claveErrores }),
  });
}

export function useResolverVerificacion() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (v: { usuarioId: string; rol: 'comerciante' | 'arrendador'; aprobar: boolean; motivo: string | null }) =>
      resolverVerificacion(v.usuarioId, v.rol, v.aprobar, v.motivo),
    // El estado lo decide el servidor: se vuelve a pedir en vez de quitar la fila a mano.
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claveVerificaciones });
      void cliente.invalidateQueries({ queryKey: claveResumen });
    },
  });
}

export function useModerar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (v: { tipo: 'resena' | 'negocio'; id: string; ocultar: boolean; motivo: string | null }) =>
      moderar(v.tipo, v.id, v.ocultar, v.motivo),
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claveModeracion });
      void cliente.invalidateQueries({ queryKey: claveResumen });
    },
  });
}

export function useModoDemo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (activo: boolean) => fijarModoDemo(activo),
    onSettled: () => void cliente.invalidateQueries({ queryKey: claveResumen }),
  });
}

/** ¿Esta cuenta es admin aprobado? Es comodidad de interfaz: el servidor vuelve a comprobarlo en cada llamada. */
export function useEsAdmin() {
  const miId = useAuthStore((s) => s.session?.user.id);
  const cargandoSesion = useAuthStore((s) => s.cargando);
  const cargarSesionInicial = useAuthStore((s) => s.cargarSesionInicial);
  // La única pantalla que leía la sesión guardada era la de inicio (`app/index.tsx`): un enlace directo a /admin (la web) no pasa por ahí y la sesión
  // se quedaba «cargando» para siempre. Llamarla dos veces es inofensivo (ver el store).
  useEffect(() => {
    if (supabaseConfigurado) void cargarSesionInicial();
  }, [cargarSesionInicial]);
  const { roles, cargando: cargandoRoles } = useMisRoles(miId);
  // Sin sesión la consulta de roles está deshabilitada y su «cargando» no termina nunca: se decide ANTES, o `/admin` sin sesión se queda esperando.
  const sinSesion = !cargandoSesion && !miId;
  return { admin: esAdmin(roles), cargando: cargandoSesion || (Boolean(miId) && cargandoRoles), sinSesion };
}
