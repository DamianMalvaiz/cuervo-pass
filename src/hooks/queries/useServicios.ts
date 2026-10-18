// Servicios · Cuervo 360
//
// Tres lecturas: las categorías, la lista de negocios (con filtro de categoría y búsqueda, ambos en el SERVIDOR)
// y un negocio con su menú. Todas distinguen cargando, falló y vacío (END-11): «falló» no es «no hay negocios».

import { useQuery } from '@tanstack/react-query';

import { listarCategorias, listarNegocios, obtenerNegocio } from '@/services/servicios.service';

export function useCategoriasServicio() {
  const q = useQuery({ queryKey: ['categoriasServicio'], queryFn: listarCategorias });
  return { categorias: q.data ?? [], cargando: q.isPending, fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useNegocios({ categoriaId, texto, soloAbiertos }: { categoriaId?: string; texto?: string; soloAbiertos?: boolean }) {
  const buscado = texto?.trim() ?? '';
  const q = useQuery({
    queryKey: ['negocios', categoriaId ?? '', buscado, Boolean(soloAbiertos)],
    queryFn: () => listarNegocios({ categoriaId, texto: buscado, soloAbiertos }),
    // Mientras se teclea, la lista anterior se queda en pantalla en vez de parpadear a vacío.
    placeholderData: (previa) => previa,
  });
  return {
    negocios: q.data ?? [],
    cargando: q.isPending,
    fallo: q.isError,
    refrescando: q.isRefetching,
    reintentar: () => void q.refetch(),
  };
}

export function useNegocio(id: string | undefined) {
  const q = useQuery({
    queryKey: ['negocio', id ?? ''],
    queryFn: () => obtenerNegocio(id as string),
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
