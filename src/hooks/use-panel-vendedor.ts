import { useConversaciones } from '@/hooks/queries/useChat';
import { useConteoFavoritos } from '@/hooks/queries/useFavoritos';
import { useConteoFavoritosDeMisNegocios } from '@/hooks/queries/useFavoritosNegocios';
import { useMiNegocio, useMisNegocios, useMisProductosConteo } from '@/hooks/queries/useMisNegocios';
import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { useMisPublicaciones } from '@/hooks/queries/usePublicaciones';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { funcionesDeVendedor, puedePublicar, tieneFuncionAprobada } from '@/lib/funciones';
import { MAX_ESTRELLAS, seccionesDe } from '@/lib/menu';
import { pasoDeVerificacion } from '@/lib/panelVendedor';
import { useAuthStore } from '@/store/useAuthStore';

type Vendedor = 'arrendador' | 'comerciante';

/**
 * Los datos del panel del vendedor (0083), compartidos por la pantalla de la app y la de la web: dos formas de pintar los MISMOS números. Una cifra que no llegó (cargando o falló) es `null`, nunca 0: un cero parecería un hecho (END-11).
 * NO hay «vistas»: la base no las mide y no se inventan.
 */
export function usePanelVendedor() {
  const miId = useAuthStore((s) => s.session?.user.id);

  const { roles, fallo: falloRoles, reintentar: reintentarRoles } = useMisRoles(miId);
  const conv = useConversaciones(miId);
  const pubs = useMisPublicaciones(miId);
  const negocios = useMisNegocios(miId);
  const funciones = funcionesDeVendedor(roles);
  const ofreceProductos = funciones.includes('comerciante');
  const ofrecePublicaciones = funciones.includes('arrendador');
  const productos = useMisProductosConteo(miId);
  const paso = pasoDeVerificacion(roles);
  // Sin la verificación hecha no se publica nada: la fila se ve bloqueada, con su motivo.
  const publica = puedePublicar(roles);
  const rolPlan: Vendedor = (roles.find((r) => r.rol === 'arrendador' || r.rol === 'comerciante')?.rol as Vendedor | undefined) ?? 'arrendador';
  const { suscripcion } = useMiSuscripcion(miId, rolPlan);

  // «—» si no llegó (cargando o falló): nunca un 0 que parezca un hecho.
  const sinLeer = conv.cargando || conv.fallo ? null : conv.conversaciones.reduce((n, c) => n + c.noLeidos, 0);
  const publicacionesActivas = pubs.cargando || pubs.fallo ? null : pubs.datos.filter((p) => p.activa).length;
  const totalProductos = productos.cargando || productos.fallo ? null : productos.total;

  // Cuántas personas guardaron lo mío: mis publicaciones (0045) + mis negocios (0088). Sin saber alguna de las dos, «—»; sin nada publicado son 0 de verdad.
  const favPubs = useConteoFavoritos(pubs.datos.map((p) => p.id));
  const favNegocios = useConteoFavoritosDeMisNegocios(negocios.negocios.map((n) => n.id));
  const favoritos =
    pubs.cargando || pubs.fallo || negocios.cargando || negocios.fallo || favPubs.cargando || favPubs.fallo || favNegocios.cargando || favNegocios.fallo
      ? null
      : [...favPubs.conteos.values(), ...favNegocios.conteos.values()].reduce((n, v) => n + v, 0);

  // Mi tienda: el primer negocio y lo que tiene dentro. Solo con la función de comerciante APROBADA (sin verificar no se publica).
  const esTienda = tieneFuncionAprobada(roles, 'comerciante');
  const primerNegocio = negocios.negocios[0] as { id: string; nombre: string } | undefined;
  const tienda = useMiNegocio(primerNegocio?.id);
  const productosDeTienda = tienda.items;
  const categorias = seccionesDe(productosDeTienda.map((i) => ({ seccion: i.seccion ?? '' })));
  const estrellas = productosDeTienda.filter((i) => i.estrella).length;

  // Solo un plan vigente o en prueba destaca: lo que el plan dice (`destaca`) sin un plan activo no promete nada.
  const destaca = Boolean(suscripcion?.destaca) && (suscripcion?.estado === 'vigente' || suscripcion?.estado === 'prueba');


  return {
    roles, falloRoles, reintentarRoles, paso, publica, rolPlan, suscripcion, destaca,
    ofreceProductos, ofrecePublicaciones, totalProductos, publicacionesActivas, sinLeer, favoritos,
    esTienda, negocios, primerNegocio, tienda, productosDeTienda, categorias, estrellas, maxEstrellas: MAX_ESTRELLAS,
  };
}
