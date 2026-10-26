import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BotonWeb } from '@/components/web/BotonWeb';
import type { SeccionWeb } from '@/components/web/BarraWeb';
import { ChipsTiposWeb } from '@/components/web/ChipsTiposWeb';
import { ComoFuncionaWeb } from '@/components/web/ComoFuncionaWeb';
import { ConfianzaWeb } from '@/components/web/ConfianzaWeb';
import { HeroWeb } from '@/components/web/HeroWeb';
import { MosaicoNegociosWeb } from '@/components/web/MosaicoNegociosWeb';
import { PieWeb } from '@/components/web/PieWeb';
import { RoomiesWeb } from '@/components/web/RoomiesWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas, useNegociosPublicos, usePublicacionesPublicas } from '@/hooks/queries/useExplorar';
import { useDesplazador } from '@/hooks/use-desplazador';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { FILTROS_VACIOS, aFiltroPublicaciones, hayFiltros, type FiltrosWeb } from '@/lib/filtrosWeb';

// Portada pública de la web · tramo 1. Se explora SIN cuenta, con datos reducidos (migración 0090): zona y no dirección, ubicación redondeada, sin teléfono.
// Primero se enseña lo que hay; la cuenta se pide solo para lo que la necesita (guardar, escribir, ver perfiles de roomies).

const ANCHO_MAXIMO = 1200;
const RESULTADOS = 12;
const HUECO = Spacing.three + Spacing.one;

export default function Explorar() {
  const { ancho } = useTamanoPantalla();
  const escritorio = ancho >= 1000;
  const columnas = ancho >= 1000 ? 4 : ancho >= 700 ? 3 : ancho >= 480 ? 2 : 1;
  const margen = ancho >= 700 ? Spacing.five : Spacing.three;
  const interior = Math.min(ancho, ANCHO_MAXIMO) - margen * 2;
  const anchoTarjeta = Math.floor((interior - HUECO * (columnas - 1)) / columnas);

  const { registrarScroll, onScroll, desplazador } = useDesplazador();
  const [nodoDepas, setNodoDepas] = useState<View | null>(null);
  const [nodoServicios, setNodoServicios] = useState<View | null>(null);
  const [nodoRoomies, setNodoRoomies] = useState<View | null>(null);
  const [filtros, setFiltros] = useState<FiltrosWeb>(FILTROS_VACIOS);
  // El buscador solo filtra al pulsar «Buscar»; los chips filtran al instante.
  const [aplicados, setAplicados] = useState<FiltrosWeb>(FILTROS_VACIOS);
  // «Ver más lugares» vale para ESTA búsqueda: con otros filtros se vuelve a las dos filas.
  const firmaBusqueda = JSON.stringify(aplicados);
  const [expandida, setExpandida] = useState<string | null>(null);

  const lugares = usePublicacionesPublicas(aFiltroPublicaciones(aplicados, RESULTADOS));
  const recientes = usePublicacionesPublicas({ limite: 3 });
  const negocios = useNegociosPublicos({ limite: 8 });

  // Las tres fotos del collage del hero: una por cada lugar más reciente (siempre tres llamadas, para no cambiar el orden de los hooks).
  const [a, b, c] = [0, 1, 2].map((i) => recientes.publicaciones[i]);
  const fa = useFotosPublicas('publicacion', a?.id, a?.num_fotos ?? 0).fotos[0];
  const fb = useFotosPublicas('publicacion', b?.id, b?.num_fotos ?? 0).fotos[0];
  const fc = useFotosPublicas('publicacion', c?.id, c?.num_fotos ?? 0).fotos[0];

  const irA = (s: SeccionWeb) => {
    const nodo = s === 'depas' ? nodoDepas : s === 'servicios' ? nodoServicios : nodoRoomies;
    if (nodo) desplazador.alNodo(nodo);
  };
  const cambiarChips = (f: FiltrosWeb) => {
    setFiltros(f);
    setAplicados(f);
  };
  const buscar = () => {
    setAplicados(filtros);
    irA('depas');
  };
  const quitarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
  };

  const filtrando = hayFiltros(aplicados);
  // Dos filas al principio (mínimo seis): una columna de doce tarjetas en un teléfono son siete pantallas antes de llegar al resto de la página.
  const inicial = Math.max(6, columnas * 2);
  const verTodos = expandida === firmaBusqueda;
  const visibles = verTodos ? lugares.publicaciones : lugares.publicaciones.slice(0, inicial);
  const tituloSeccion = escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto;

  return (
    <ThemedView style={estilos.raiz}>
      <ScrollView ref={registrarScroll} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={estilos.scroll}>
        <View style={[estilos.contenido, { paddingHorizontal: margen >= Spacing.five ? Spacing.three : Spacing.two }]}>
          <HeroWeb escritorio={escritorio} filtros={filtros} onCambiar={setFiltros} onBuscar={buscar} onIrASeccion={irA} fotos={[fa, fb, fc]} />

          <ChipsTiposWeb filtros={filtros} onCambiar={cambiarChips} />

          <View ref={setNodoDepas} style={estilos.seccion}>
            <ThemedText accessibilityRole="header" style={tituloSeccion}>Departamentos y cuartos</ThemedText>
            {lugares.fallo ? (
              <ErrorDeCarga etiqueta="No pudimos cargar los lugares" onReintentar={lugares.reintentar} />
            ) : lugares.cargando ? (
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
            ) : lugares.publicaciones.length === 0 ? (
              filtrando ? (
                <View style={estilos.vacio}>
                  <ThemedText style={Texto.cuerpo} themeColor="textSecondary">No hay lugares con esos filtros. Prueba con menos.</ThemedText>
                  <BotonWeb variante="contorno" onPress={quitarFiltros}>Quitar filtros</BotonWeb>
                </View>
              ) : (
                <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay lugares publicados.</ThemedText>
              )
            ) : (
              <>
                <View style={estilos.cuadricula}>
                  {visibles.map((p) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} />)}
                </View>
                {!verTodos && lugares.publicaciones.length > inicial ? (
                  <View style={estilos.masLugares}>
                    <BotonWeb variante="contorno" onPress={() => setExpandida(firmaBusqueda)}>Ver más lugares</BotonWeb>
                  </View>
                ) : null}
              </>
            )}
          </View>

          <View ref={setNodoServicios} style={estilos.seccion}>
            <ThemedText accessibilityRole="header" style={tituloSeccion}>Negocios cerca</ThemedText>
            {negocios.fallo ? (
              <ErrorDeCarga etiqueta="No pudimos cargar los negocios" onReintentar={negocios.reintentar} />
            ) : negocios.cargando ? (
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
            ) : negocios.negocios.length === 0 ? (
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay negocios publicados.</ThemedText>
            ) : (
              <MosaicoNegociosWeb negocios={negocios.negocios} escritorio={escritorio} ancho={anchoTarjeta} />
            )}
          </View>

          <View ref={setNodoRoomies}>
            <RoomiesWeb escritorio={escritorio} />
          </View>

          <View style={estilos.seccion}>
            <ComoFuncionaWeb escritorio={escritorio} foto={fa} titulo={a?.titulo_publico} />
          </View>

          <ConfianzaWeb escritorio={escritorio} />

          <PieWeb />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  scroll: { paddingTop: Spacing.three },
  contenido: { width: '100%', maxWidth: ANCHO_MAXIMO, alignSelf: 'center', gap: Spacing.five },
  seccion: { gap: Spacing.three + Spacing.one, paddingHorizontal: Spacing.two },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
  masLugares: { alignItems: 'center', marginTop: Spacing.two },
});
