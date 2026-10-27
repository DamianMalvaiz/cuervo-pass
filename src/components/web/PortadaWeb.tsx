import { router } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BotonWeb } from '@/components/web/BotonWeb';
import { ChipsTiposWeb } from '@/components/web/ChipsTiposWeb';
import { ComoFuncionaWeb } from '@/components/web/ComoFuncionaWeb';
import { ConfianzaWeb } from '@/components/web/ConfianzaWeb';
import { HeroWeb } from '@/components/web/HeroWeb';
import { MosaicoNegociosWeb } from '@/components/web/MosaicoNegociosWeb';
import { PieWeb } from '@/components/web/PieWeb';
import { RoomiesWeb } from '@/components/web/RoomiesWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { AnchoMaximoWeb, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas, useNegociosPublicos, usePublicacionesPublicas } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { FILTROS_VACIOS, type FiltrosWeb } from '@/lib/filtrosWeb';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';
import { RutasWeb, aParametros } from '@/lib/rutasWeb';

/**
 * La portada de inicio (`/`): una vitrina. El hero con el buscador y, debajo, un adelanto de cada sección (lugares, negocios, roomies, cómo funciona, confianza). Cada sección tiene su propia página:
 * el buscador y los chips abren `/departamentos` ya filtrado y cada «Ver todos» lleva a `/departamentos`, `/servicios` o `/roomies`. Se ve SIN cuenta, con datos reducidos.
 */
export function PortadaWeb() {
  const { ancho } = useTamanoPantalla();
  const { escritorio, columnas, relleno, anchoTarjeta, anchoMosaico } = medidasWeb(ancho);
  const [filtros, setFiltros] = useState<FiltrosWeb>(FILTROS_VACIOS);

  const lugares = usePublicacionesPublicas({ limite: 5 });
  const negocios = useNegociosPublicos({ limite: 5 });

  // Las tres fotos del collage del hero: una por cada lugar más reciente (siempre tres llamadas, para no cambiar el orden de los hooks).
  const [a, b, c] = [0, 1, 2].map((i) => lugares.publicaciones[i]);
  const fa = useFotosPublicas('publicacion', a?.id, a?.num_fotos ?? 0).fotos[0];
  const fb = useFotosPublicas('publicacion', b?.id, b?.num_fotos ?? 0).fotos[0];
  const fc = useFotosPublicas('publicacion', c?.id, c?.num_fotos ?? 0).fotos[0];

  const abrirBusqueda = (f: FiltrosWeb) => router.push({ pathname: RutasWeb.departamentos, params: aParametros(f) });
  // Una fila de lugares (en tres columnas, justo tres; en pantallas angostas, cuatro) y un mosaico de negocios de cinco celdas (cuatro si no cabe el mosaico).
  const cuantosLugares = columnas === 3 ? 3 : Math.max(4, columnas);
  const tituloSeccion = escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto;

  return (
    <ThemedView style={estilos.raiz}>
      <Head>
        <title>Cuervo 360 · Departamentos, roomies y servicios cerca de tu universidad</title>
      </Head>
      <ScrollView>
        <HeroWeb escritorio={escritorio} filtros={filtros} onCambiar={setFiltros} onBuscar={() => abrirBusqueda(filtros)} fotos={[fa, fb, fc]} />

        <View style={[estilos.contenido, { paddingHorizontal: relleno }]}>
          <ChipsTiposWeb filtros={FILTROS_VACIOS} onCambiar={abrirBusqueda} />

          <View style={estilos.seccion}>
            <View style={estilos.cabecera}>
              <ThemedText accessibilityRole="header" style={tituloSeccion}>Departamentos y cuartos</ThemedText>
              <BotonWeb compacto variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Ver todos los lugares">Ver todos</BotonWeb>
            </View>
            {lugares.fallo ? (
              <ErrorDeCarga etiqueta="No pudimos cargar los lugares" onReintentar={lugares.reintentar} />
            ) : lugares.cargando ? (
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
            ) : lugares.publicaciones.length === 0 ? (
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay lugares publicados.</ThemedText>
            ) : (
              <View style={estilos.cuadricula}>
                {lugares.publicaciones.slice(0, cuantosLugares).map((p) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} />)}
              </View>
            )}
          </View>

          <View style={estilos.seccion}>
            <View style={estilos.cabecera}>
              <ThemedText accessibilityRole="header" style={tituloSeccion}>Negocios cerca</ThemedText>
              <BotonWeb compacto variante="contorno" onPress={() => router.push(RutasWeb.servicios)} accessibilityLabel="Ver todos los negocios">Ver todos</BotonWeb>
            </View>
            {negocios.fallo ? (
              <ErrorDeCarga etiqueta="No pudimos cargar los negocios" onReintentar={negocios.reintentar} />
            ) : negocios.cargando ? (
              <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
            ) : negocios.negocios.length === 0 ? (
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay negocios publicados.</ThemedText>
            ) : (
              <MosaicoNegociosWeb negocios={negocios.negocios.slice(0, escritorio ? 5 : 4)} escritorio={escritorio} ancho={anchoMosaico} />
            )}
          </View>

          <RoomiesWeb escritorio={escritorio} textoBoton="Ver roomies" alBoton={() => router.push(RutasWeb.roomies)} />

          <ComoFuncionaWeb escritorio={escritorio} foto={fa} titulo={a?.titulo_publico} />

          <ConfianzaWeb escritorio={escritorio} />
        </View>
        <PieWeb />
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  contenido: { width: '100%', maxWidth: AnchoMaximoWeb, alignSelf: 'center', gap: Spacing.five, paddingBottom: Spacing.six },
  seccion: { gap: Spacing.three + Spacing.one },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
});
