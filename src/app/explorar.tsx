import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BotonWeb } from '@/components/web/BotonWeb';
import type { SeccionWeb } from '@/components/web/BarraWeb';
import { ChipsTiposWeb } from '@/components/web/ChipsTiposWeb';
import { HeroWeb } from '@/components/web/HeroWeb';
import { PieWeb } from '@/components/web/PieWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas, useNegociosPublicos, usePublicacionesPublicas } from '@/hooks/queries/useExplorar';
import { useDesplazador } from '@/hooks/use-desplazador';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { FILTROS_VACIOS, aFiltroPublicaciones, hayFiltros, type FiltrosWeb } from '@/lib/filtrosWeb';
import { zonaCorta } from '@/lib/zona';
import type { NegocioExplorar } from '@/services/explorar.service';

// Portada pública de la web · tramo 1. Se explora SIN cuenta, con datos reducidos (migración 0090): zona y no dirección, ubicación redondeada, sin teléfono.
// Primero se enseña lo que hay; la cuenta se pide solo para lo que la necesita (guardar, escribir, ver perfiles de roomies).

const ANCHO_MAXIMO = 1200;
const RESULTADOS = 12;
const HUECO = Spacing.three + Spacing.one;

function TarjetaNegocio({ n, ancho }: { n: NegocioExplorar; ancho: number }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('negocio', n.id, n.num_fotos);
  const zona = zonaCorta(n.zona);
  const estado = n.abierto_ahora === null ? null : n.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora';
  return (
    <Pulsable
      onPress={() => router.push(`/explorar/negocio/${n.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${n.nombre}${estado ? `, ${estado}` : ''}`}
      style={[estilos.tarjetaNegocio, { width: ancho }]}
    >
      <View style={[estilos.fotoNegocio, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={n.nombre} />
      </View>
      <ThemedText style={Texto.pequenoFuerte} numberOfLines={1}>{n.nombre}</ThemedText>
      {zona ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{zona}</ThemedText> : null}
      {estado ? <ThemedText style={Texto.pequeno}>{estado}</ThemedText> : null}
    </Pulsable>
  );
}

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
  const [filtros, setFiltros] = useState<FiltrosWeb>(FILTROS_VACIOS);
  // El buscador solo filtra al pulsar «Buscar»; los chips filtran al instante.
  const [aplicados, setAplicados] = useState<FiltrosWeb>(FILTROS_VACIOS);

  const lugares = usePublicacionesPublicas(aFiltroPublicaciones(aplicados, RESULTADOS));
  const recientes = usePublicacionesPublicas({ limite: 3 });
  const negocios = useNegociosPublicos({ limite: 8 });

  // Las tres fotos del collage del hero: una por cada lugar más reciente (siempre tres llamadas, para no cambiar el orden de los hooks).
  const [a, b, c] = [0, 1, 2].map((i) => recientes.publicaciones[i]);
  const fa = useFotosPublicas('publicacion', a?.id, a?.num_fotos ?? 0).fotos[0];
  const fb = useFotosPublicas('publicacion', b?.id, b?.num_fotos ?? 0).fotos[0];
  const fc = useFotosPublicas('publicacion', c?.id, c?.num_fotos ?? 0).fotos[0];

  const irA = (s: SeccionWeb) => {
    // Los perfiles de roomies solo se ven con cuenta: la pestaña lleva a entrar.
    if (s === 'roomies') return router.push('/(auth)/login');
    const nodo = s === 'depas' ? nodoDepas : nodoServicios;
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
              <View style={estilos.cuadricula}>
                {lugares.publicaciones.map((p) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} />)}
              </View>
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
              <View style={estilos.cuadricula}>
                {negocios.negocios.map((n) => <TarjetaNegocio key={n.id} n={n} ancho={anchoTarjeta} />)}
              </View>
            )}
          </View>

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
  tarjetaNegocio: { gap: Spacing.one },
  fotoNegocio: { aspectRatio: 4 / 3, borderRadius: Radios.tarjeta, overflow: 'hidden', marginBottom: Spacing.one },
  imagen: { width: '100%', height: '100%' },
});
