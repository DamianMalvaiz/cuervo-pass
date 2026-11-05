import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EsqueletoFilasWeb, EsqueletoTarjetasWeb } from '@/components/web/EsqueletoWeb';
import { FavoritosWeb } from '@/components/web/FavoritosWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useBorrarBusqueda, useBusquedasGuardadas } from '@/hooks/queries/useBusquedasGuardadas';
import { usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { useMisNegociosFavoritosIds } from '@/hooks/queries/useFavoritosNegocios';
import { useComparar } from '@/hooks/use-comparar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { useVistos } from '@/hooks/use-vistos';
import { vaciarComparar } from '@/lib/comparar';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';
import { aParametros, deParametros, RutasWeb } from '@/lib/rutasWeb';
import { toast } from '@/lib/toast';
import { borrarVistos } from '@/lib/vistos';
import { useAuthStore } from '@/store/useAuthStore';

type Pestana = 'favoritos' | 'vistos' | 'busquedas' | 'comparar';

/**
 * «Guardados» (la página de Favoritos de la web): todo lo que una persona deja para decidir con calma, en cuatro pestañas. Favoritos (lo guardado en la cuenta), Vistos (lo que abrió en este navegador), Búsquedas (las guardadas en la cuenta, 0093)
 * y Comparar (hasta tres lugares puestos lado a lado). Cada pestaña dice su cuenta cuando se sabe; si no se sabe (cargando o falló), no pinta número: nunca un 0 que parezca un hecho.
 */
export function GuardadosWeb() {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const [pestana, setPestana] = useState<Pestana>('favoritos');
  const guardadasPub = useMisFavoritosIds(miId);
  const guardadasNeg = useMisNegociosFavoritosIds(miId);
  const vistos = useVistos();
  const { ids: comparados } = useComparar();
  const busquedas = useBusquedasGuardadas(miId);

  const favoritos = [guardadasPub, guardadasNeg].some((g) => g.cargando || g.fallo) ? null : guardadasPub.ids.size + guardadasNeg.ids.size;
  const opciones: { valor: Pestana; nombre: string; n: number | null; icono: keyof typeof Ionicons.glyphMap }[] = [
    { valor: 'favoritos', nombre: 'Favoritos', n: favoritos, icono: 'heart-outline' },
    { valor: 'vistos', nombre: 'Vistos', n: vistos.length, icono: 'time-outline' },
    { valor: 'busquedas', nombre: 'Búsquedas', n: busquedas.cargando || busquedas.fallo ? null : busquedas.busquedas.length, icono: 'bookmark-outline' },
    { valor: 'comparar', nombre: 'Comparar', n: comparados.length, icono: 'git-compare-outline' },
  ];

  return (
    <PaginaSesionWeb titulo="Guardados" subtitulo="Lo que guardaste, lo que viste y tus búsquedas, para decidir con calma.">
      <View style={estilos.fila} accessibilityRole="tablist" accessibilityLabel="Qué quieres ver">
        {opciones.map((o) => {
          const activa = pestana === o.valor;
          const etiqueta = o.n === null ? o.nombre : `${o.nombre} (${o.n})`;
          return (
            <Pulsable
              key={o.valor}
              onPress={() => setPestana(o.valor)}
              accessibilityRole="tab"
              accessibilityLabel={etiqueta}
              accessibilityState={{ selected: activa }}
              aria-selected={activa}
              style={[estilos.pestana, { borderColor: activa ? theme.text : theme.filete, backgroundColor: activa ? theme.text : theme.backgroundElement }]}
            >
              <Ionicons name={o.icono} size={18} color={activa ? theme.background : theme.bosque} />
              <ThemedText style={[Texto.pequenoFuerte, { color: activa ? theme.background : theme.text }]}>{etiqueta}</ThemedText>
            </Pulsable>
          );
        })}
      </View>
      {pestana === 'favoritos' ? <FavoritosWeb /> : null}
      {pestana === 'vistos' ? <PestanaVistos /> : null}
      {pestana === 'busquedas' ? <PestanaBusquedas /> : null}
      {pestana === 'comparar' ? <PestanaComparar /> : null}
    </PaginaSesionWeb>
  );
}

function useMedidas() {
  const { ancho } = useTamanoPantalla();
  return medidasWeb(ancho);
}

function Vacio({ texto, boton, alBoton }: { texto: string; boton: string; alBoton: () => void }) {
  return (
    <View style={estilos.vacio}>
      <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{texto}</ThemedText>
      <BotonWeb variante="contorno" onPress={alBoton} accessibilityLabel={boton}>{boton}</BotonWeb>
    </View>
  );
}

/** Los lugares de una lista de ids, en ese orden; los que ya no son visibles no salen (y se cuentan aparte para decirlo). */
function Lugares({ ids }: { ids: string[] }) {
  const { telefono, anchoTarjeta } = useMedidas();
  const { publicaciones } = usePublicacionesPorIds(ids);
  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  const lista = ids.map((id) => porId.get(id)).filter((p) => p !== undefined);
  return (
    <>
      {lista.length < ids.length ? (
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">
          {ids.length - lista.length === 1 ? '1 lugar de esta lista ya no está disponible.' : `${ids.length - lista.length} lugares de esta lista ya no están disponibles.`}
        </ThemedText>
      ) : null}
      <View style={estilos.cuadricula}>
        {lista.map((p, i) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} compacta={telefono} paso={i} />)}
      </View>
    </>
  );
}

function PestanaVistos() {
  const { columnas, anchoTarjeta } = useMedidas();
  const ids = useVistos();
  const { cargando, fallo, reintentar } = usePublicacionesPorIds(ids);
  if (ids.length === 0) {
    return <Vacio texto="Todavía no has abierto ningún lugar. Los que veas aparecerán aquí; se guardan solo en este navegador." boton="Explorar lugares" alBoton={() => router.push(RutasWeb.departamentos)} />;
  }
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar lo que viste" onReintentar={reintentar} />;
  if (cargando) return <EsqueletoTarjetasWeb cuantas={columnas} ancho={anchoTarjeta} />;
  return (
    <View style={estilos.cuerpo}>
      <View style={estilos.acciones}>
        <BotonWeb compacto variante="contorno" onPress={borrarVistos} accessibilityLabel="Borrar el historial de vistos">Borrar historial</BotonWeb>
      </View>
      <Lugares ids={ids} />
    </View>
  );
}

function PestanaBusquedas() {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { busquedas, cargando, fallo, reintentar } = useBusquedasGuardadas(miId);
  const borrar = useBorrarBusqueda(miId);
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar tus búsquedas guardadas" onReintentar={reintentar} />;
  if (cargando) return <EsqueletoFilasWeb filas={3} />;
  if (busquedas.length === 0) {
    return <Vacio texto="Aún no guardas ninguna búsqueda. En Departamentos, pon tus filtros y toca «Guardar esta búsqueda»." boton="Ir a Departamentos" alBoton={() => router.push(RutasWeb.departamentos)} />;
  }
  return (
    <View style={estilos.cuerpo}>
      {busquedas.map((b) => (
        <View key={b.id} style={[estilos.busqueda, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="bookmark-outline" size={22} color={theme.bosque} />
          <ThemedText style={[Texto.cuerpo, estilos.busquedaNombre]} numberOfLines={2}>{b.nombre}</ThemedText>
          <BotonWeb compacto onPress={() => router.push({ pathname: RutasWeb.departamentos, params: aParametros(deParametros(b.filtros)) })} accessibilityLabel={`Buscar de nuevo: ${b.nombre}`}>Buscar</BotonWeb>
          <Pulsable
            onPress={() => borrar.mutate(b.id, { onError: () => toast.error('No pudimos borrar la búsqueda. Revisa tu conexión e intenta de nuevo.') })}
            accessibilityRole="button"
            accessibilityLabel={`Borrar la búsqueda guardada: ${b.nombre}`}
            style={estilos.borrar}
          >
            <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
          </Pulsable>
        </View>
      ))}
    </View>
  );
}

function PestanaComparar() {
  const { columnas, anchoTarjeta } = useMedidas();
  const { ids } = useComparar();
  const { cargando, fallo, reintentar } = usePublicacionesPorIds(ids);
  if (ids.length === 0) {
    return <Vacio texto="Aún no eliges nada para comparar. En la ficha de un lugar toca «Comparar» (hasta 3)." boton="Explorar lugares" alBoton={() => router.push(RutasWeb.departamentos)} />;
  }
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar lo que quieres comparar" onReintentar={reintentar} />;
  if (cargando) return <EsqueletoTarjetasWeb cuantas={Math.min(ids.length, columnas)} ancho={anchoTarjeta} />;
  return (
    <View style={estilos.cuerpo}>
      <View style={estilos.acciones}>
        {ids.length >= 2 ? <BotonWeb compacto onPress={() => router.push(RutasWeb.comparar as never)} accessibilityLabel="Comparar lado a lado">Comparar lado a lado</BotonWeb> : <ThemedText style={Texto.pequeno} themeColor="textSecondary">Agrega al menos un lugar más para compararlos.</ThemedText>}
        <BotonWeb compacto variante="contorno" onPress={vaciarComparar} accessibilityLabel="Vaciar la lista de comparar">Vaciar</BotonWeb>
      </View>
      <Lugares ids={ids} />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pestana: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino },
  cuerpo: { gap: Spacing.three },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
  busqueda: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radios.tarjeta, borderWidth: Filete.fino, maxWidth: 760 },
  busquedaNombre: { flex: 1, minWidth: 0 },
  borrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
