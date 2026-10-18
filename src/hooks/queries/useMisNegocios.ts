// Mi negocio · Cuervo 360
//
// Lecturas de los negocios de ESTA cuenta (claves con su id; al cerrar sesión la caché se vacía) y la escritura completa de
// un negocio: datos, fotos y menú, en el orden que no deja basura a medias.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { borrarFotos, subirFotoNegocio } from '@/lib/storage';
import { parsearPrecio, type ItemEditable } from '@/lib/negocio';
import {
  actualizarNegocio, borrarNegocio, crearNegocio, guardarMenu, listarMisNegocios, obtenerMiNegocio,
  type DatosNegocio,
} from '@/services/negociosPropios.service';

const claveLista = (usuarioId: string | undefined) => ['misNegocios', usuarioId ?? ''] as const;
const claveUno = (id: string | undefined) => ['miNegocio', id ?? ''] as const;

export function useMisNegocios(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: claveLista(usuarioId),
    queryFn: () => listarMisNegocios(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
  // Tres estados y no dos (END-11): cargando, falló, y lista (que puede ser vacía).
  return {
    negocios: q.data ?? [],
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

export function useMiNegocio(id: string | undefined) {
  const q = useQuery({
    queryKey: claveUno(id),
    queryFn: () => obtenerMiNegocio(id as string),
    enabled: Boolean(id),
  });
  return {
    negocio: q.data?.negocio ?? null,
    items: q.data?.items ?? [],
    cargando: q.isPending && Boolean(id),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

/** El negocio ya se creó pero un paso posterior falló: quien llama puede llevar a la persona a terminarlo. */
export class ErrorParcial extends Error {
  constructor(public readonly idCreado: string, public readonly causa: unknown) {
    super('El negocio se creó pero no se pudo terminar de guardar');
  }
}

export interface EntradaGuardado {
  /** Ausente = negocio nuevo. */
  id?: string;
  datos: DatosNegocio;
  /** Rutas de Storage que ya estaban y se conservan. */
  fotosConservadas: string[];
  /** Rutas que estaban y se QUITARON: se borran de Storage al final. */
  fotosQuitadas: string[];
  /** URIs locales de fotos nuevas. */
  fotosNuevas: string[];
  items: ItemEditable[];
}

export function useGuardarNegocio(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (e: EntradaGuardado): Promise<string> => {
      if (!usuarioId) throw new Error('sin sesión');
      // 1. Los datos. Si esto falla no hay nada que limpiar.
      let id: string;
      const esNuevo = !e.id;
      if (e.id) {
        await actualizarNegocio(e.id, e.datos);
        id = e.id;
      } else {
        id = await crearNegocio(usuarioId, e.datos);
      }
      try {
        // 2. Las fotos nuevas, luego la lista final en la fila (la base valida que vivan en la carpeta del negocio).
        const subidas: string[] = [];
        for (const uri of e.fotosNuevas) subidas.push(await subirFotoNegocio(id, uri));
        const fotos = [...e.fotosConservadas, ...subidas];
        if (esNuevo || e.fotosNuevas.length > 0 || e.fotosQuitadas.length > 0) await actualizarNegocio(id, { fotos });
        // 3. El menú.
        await guardarMenu(
          id,
          e.items.map((i) => ({ id: i.id, nombre: i.nombre.trim(), precio: parsearPrecio(i.precio) as number | null }))
        );
        // 4. Lo quitado se borra al FINAL: si algo anterior falló, las fotos viejas siguen siendo las de la fila.
        await borrarFotos(e.fotosQuitadas);
      } catch (err) {
        if (esNuevo) throw new ErrorParcial(id, err);
        throw err;
      }
      return id;
    },
    onSuccess: (id) => {
      void cliente.invalidateQueries({ queryKey: claveLista(usuarioId) });
      void cliente.invalidateQueries({ queryKey: claveUno(id) });
      // La lista pública y la ficha de Servicios cambian con esto.
      void cliente.invalidateQueries({ queryKey: ['negocios'] });
      void cliente.invalidateQueries({ queryKey: ['negocio', id] });
    },
  });
}

export function useBorrarNegocio(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fotos }: { id: string; fotos: string[] }) => borrarNegocio(id, fotos),
    onSuccess: (_d, { id }) => {
      void cliente.invalidateQueries({ queryKey: claveLista(usuarioId) });
      void cliente.removeQueries({ queryKey: claveUno(id) });
      void cliente.invalidateQueries({ queryKey: ['negocios'] });
    },
  });
}
