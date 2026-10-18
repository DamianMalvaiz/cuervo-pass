// Verificación de vendedor · Cuervo 360
//
// Una lectura (el rastro de la revisión de ESTA cuenta) y un envío que sube la evidencia ANTES de llamar a la RPC. El
// orden importa: si la RPC fuera primero y la subida fallara, la verificación quedaría «pendiente» apuntando a archivos
// que no existen y el admin no podría revisar nada. Si una subida falla, no se envía nada y la persona reintenta; los
// archivos ya subidos quedan huérfanos en su carpeta privada (nombre único, sin sobrescribir) y no estorban.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { subirEvidenciaVerificacion } from '@/lib/storage';
import { VERSION_AVISO, type RolVendedor } from '@/lib/verificacion';
import { claveMisRoles } from '@/hooks/queries/useRoles';
import { enviarVerificacion, obtenerMiVerificacion } from '@/services/verificacion.service';

const clave = (usuarioId: string | undefined, rol: string) => ['miVerificacion', usuarioId ?? '', rol] as const;

export function useMiVerificacion(usuarioId: string | undefined, rol: RolVendedor) {
  const q = useQuery({
    queryKey: clave(usuarioId, rol),
    queryFn: () => obtenerMiVerificacion(usuarioId as string, rol),
    enabled: Boolean(usuarioId),
  });
  // Tres estados y no dos (END-11): `verificacion: null` con `fallo: false` es «nunca envió».
  return {
    verificacion: q.data ?? null,
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

export interface EntradaEnvio {
  rol: RolVendedor;
  nombreLegal: string;
  direccion: string;
  /** URIs locales (de la galería) de cada archivo. */
  ineFrente: string;
  ineReverso: string;
  fotosLugar: string[];
}

export function useEnviarVerificacion(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (e: EntradaEnvio) => {
      if (!usuarioId) throw new Error('sin sesión');
      const ineFrente = await subirEvidenciaVerificacion(usuarioId, e.rol, 'ine-frente', e.ineFrente);
      const ineReverso = await subirEvidenciaVerificacion(usuarioId, e.rol, 'ine-reverso', e.ineReverso);
      const fotos: string[] = [];
      for (const [i, uri] of e.fotosLugar.entries()) {
        fotos.push(await subirEvidenciaVerificacion(usuarioId, e.rol, `lugar-${i + 1}`, uri));
      }
      await enviarVerificacion({
        rol: e.rol,
        nombreLegal: e.nombreLegal,
        direccion: e.direccion,
        ineFrente,
        ineReverso,
        fotos,
        versionAviso: VERSION_AVISO,
      });
    },
    // El estado (pendiente) lo decide el servidor: se vuelve a pedir en vez de escribirlo a mano.
    onSuccess: (_d, e) => {
      void cliente.invalidateQueries({ queryKey: claveMisRoles(usuarioId) });
      void cliente.invalidateQueries({ queryKey: clave(usuarioId, e.rol) });
    },
  });
}
