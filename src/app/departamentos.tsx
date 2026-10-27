import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { EsqueletoTarjetasWeb } from '@/components/web/EsqueletoWeb';
import { BotonWeb } from '@/components/web/BotonWeb';
import { BuscadorWeb } from '@/components/web/BuscadorWeb';
import { PildoraBusquedaWeb } from '@/components/web/PildoraBusquedaWeb';
import { ChipsTiposWeb } from '@/components/web/ChipsTiposWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Spacing, Texto } from '@/constants/theme';
import { usePublicacionesPublicas } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { FILTROS_VACIOS, aFiltroPublicaciones, hayFiltros, resumenBusqueda, type FiltrosWeb } from '@/lib/filtrosWeb';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';
import { deParametros } from '@/lib/rutasWeb';

// `/departamentos` · la página de los lugares. Se ve SIN cuenta, con datos reducidos (migración 0090): zona y no dirección, sin teléfono. La búsqueda puede venir en la URL (`?tipo=cuarto&zona=Lerma`),
// así que un enlace abre la búsqueda ya hecha.

const RESULTADOS = 20;

export default function Departamentos() {
  const { ancho } = useTamanoPantalla();
  const { escritorio, telefono, columnas, anchoTarjeta } = medidasWeb(ancho);
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  const [filtros, setFiltros] = useState<FiltrosWeb>(() => deParametros(params));
  // El buscador solo filtra al pulsar «Buscar»; los chips filtran al instante.
  const [aplicados, setAplicados] = useState<FiltrosWeb>(() => deParametros(params));
  // «Ver más lugares» vale solo mientras no cambie la búsqueda: cualquier cambio (incluido volver a una anterior) regresa a las dos filas.
  const [verTodos, setVerTodos] = useState(false);
  // En el teléfono el buscador es una píldora que despliega los campos.
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const aplicar = (f: FiltrosWeb) => {
    setAplicados(f);
    setVerTodos(false);
  };
  const resumen = resumenBusqueda(aplicados);

  const lugares = usePublicacionesPublicas(aFiltroPublicaciones(aplicados, RESULTADOS));
  const filtrando = hayFiltros(aplicados);
  // Dos filas al principio (mínimo seis): una columna de veinte tarjetas en un teléfono es una página interminable.
  const inicial = Math.max(6, columnas * 2);
  const visibles = verTodos ? lugares.publicaciones : lugares.publicaciones.slice(0, inicial);

  return (
    <PaginaWeb activa="depas" titulo="Departamentos y cuartos">
      <View style={estilos.cabecera}>
        <ThemedText accessibilityRole="header" style={escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto}>Departamentos y cuartos</ThemedText>
        {/* En el teléfono el subtítulo sobra: gasta espacio antes del contenido. */}
        {telefono ? null : <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Cuartos, departamentos y casas compartidas cerca de tu universidad.</ThemedText>}
      </View>

      <View style={estilos.filtros}>
        {telefono ? (
          <>
            <PildoraBusquedaWeb titulo={resumen.titulo} subtitulo={resumen.subtitulo} expandida={buscadorAbierto} onPress={() => setBuscadorAbierto(!buscadorAbierto)} />
            {buscadorAbierto ? (
              <BuscadorWeb
                compacto
                filtros={filtros}
                onCambiar={setFiltros}
                onBuscar={() => {
                  aplicar(filtros);
                  setBuscadorAbierto(false);
                }}
              />
            ) : null}
          </>
        ) : (
          <View style={estilos.buscadorAncho}>
            <BuscadorWeb compacto={!escritorio} filtros={filtros} onCambiar={setFiltros} onBuscar={() => aplicar(filtros)} />
          </View>
        )}
        <ChipsTiposWeb
          alinear={telefono ? 'deslizar' : 'inicio'}
          filtros={filtros}
          onCambiar={(f) => {
            setFiltros(f);
            aplicar(f);
          }}
        />
      </View>

      <View style={estilos.resultados}>
        {lugares.fallo ? (
          <ErrorDeCarga etiqueta="No pudimos cargar los lugares" onReintentar={lugares.reintentar} />
        ) : lugares.cargando ? (
          <EsqueletoTarjetasWeb cuantas={inicial} ancho={anchoTarjeta} />
        ) : lugares.publicaciones.length === 0 ? (
          filtrando ? (
            <View style={estilos.vacio}>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">No hay lugares con esos filtros. Prueba con menos.</ThemedText>
              <BotonWeb
                variante="contorno"
                onPress={() => {
                  setFiltros(FILTROS_VACIOS);
                  aplicar(FILTROS_VACIOS);
                }}
              >
                Quitar filtros
              </BotonWeb>
            </View>
          ) : (
            <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay lugares publicados.</ThemedText>
          )
        ) : (
          <>
            <View style={estilos.cuadricula}>
              {visibles.map((p, i) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} compacta={telefono} paso={i % columnas} />)}
            </View>
            {!verTodos && lugares.publicaciones.length > inicial ? (
              <View style={estilos.masLugares}>
                <BotonWeb variante="contorno" onPress={() => setVerTodos(true)}>Ver más lugares</BotonWeb>
              </View>
            ) : null}
          </>
        )}
      </View>
    </PaginaWeb>
  );
}

const estilos = StyleSheet.create({
  cabecera: { gap: Spacing.two },
  filtros: { gap: Spacing.three, alignItems: 'stretch' },
  buscadorAncho: { alignItems: 'flex-start' },
  resultados: { gap: Spacing.three },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
  masLugares: { alignItems: 'center', marginTop: Spacing.two },
});
