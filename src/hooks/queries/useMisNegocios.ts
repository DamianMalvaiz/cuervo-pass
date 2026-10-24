// Mi negocio · Cuervo 360
//
// Lecturas de los negocios de ESTA cuenta (claves con su id; al cerrar sesión la caché se vacía) y la escritura completa de
// un negocio (datos y galería) y de su menú, cada uno en el orden que no deja basura a medias.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Turno } from '@/lib/horario';
import { borrarFotos, subirFotoNegocio, subirFotoProducto } from '@/lib/storage';
import { parsearPrecio, type ProductoEditable } from '@/lib/menu';
import {
  actualizarNegocio, borrarNegocio, crearNegocio, guardarHorario, guardarMenu, listarMisNegocios, obtenerMiNegocio,
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
    turnos: q.data?.turnos ?? [],
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
  /** El horario completo (0070). `undefined` = no se toca; `[]` = se borra. */
  turnos?: Turno[];
  /** Los productos con que SE PUBLICA un negocio nuevo (el primero es obligatorio). `undefined` = no se toca el menú (al editar, el menú tiene su pantalla). */
  productos?: ProductoEditable[];
}

/** Sube las fotos NUEVAS de los productos y manda la lista entera en una sola llamada. Devuelve los renglones guardados (para saber qué fotos siguen en uso). */
async function guardarProductos(negocioId: string, productos: ProductoEditable[]) {
  const items = [];
  for (const p of productos) {
    // Las guardadas primero (la portada no cambia al agregar), luego las nuevas en el orden en que se eligieron.
    const subidas: string[] = [];
    for (const uri of p.fotosNuevas) subidas.push(await subirFotoProducto(negocioId, uri));
    items.push({
      id: p.id,
      nombre: p.nombre.trim(),
      precio: parsearPrecio(p.precio) as number | null,
      seccion: p.seccion.trim() || null,
      descripcion: p.descripcion.trim() || null,
      fotos: [...p.fotos, ...subidas],
      estrella: p.estrella,
    });
  }
  await guardarMenu(negocioId, items);
  return items;
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
        // El horario va después de que el negocio EXISTE (los turnos cuelgan de su id); si falla, el negocio ya está guardado y se avisa como cualquier paso posterior.
        if (e.turnos !== undefined) await guardarHorario(id, e.turnos);
        // El menú también cuelga del id; mismo trato: si falla, el negocio ya está guardado y se completa desde su pantalla.
        if (e.productos !== undefined) await guardarProductos(id, e.productos);
        // 3. Lo quitado se borra al FINAL: si algo anterior falló, las fotos viejas siguen siendo las de la fila.
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

export interface EntradaMenu {
  productos: ProductoEditable[];
  /** Rutas de foto de productos tal como se CARGARON: sirven para saber cuáles ya no se usan. */
  fotosAnteriores: string[];
}

/**
 * Guarda el menú de un negocio: sube las fotos NUEVAS de productos, manda la lista entera en una sola llamada y, al final,
 * borra de Storage las fotos que ya nadie usa (las de productos quitados y las reemplazadas). Si la subida o la llamada
 * fallan, no se borra nada: las fotos viejas siguen siendo las del menú guardado.
 */
export function useGuardarMenu(negocioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ productos, fotosAnteriores }: EntradaMenu): Promise<void> => {
      if (!negocioId) throw new Error('sin negocio');
      const items = await guardarProductos(negocioId, productos);
      const usadas = new Set(items.flatMap((i) => i.fotos));
      await borrarFotos(fotosAnteriores.filter((f) => !usadas.has(f)));
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: claveUno(negocioId) });
      void cliente.invalidateQueries({ queryKey: ['negocio', negocioId] });
    },
  });
}
