import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { FilaLugarCercano } from '@/components/FilaLugarCercano';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EsqueletoFilasWeb, EsqueletoTarjetasWeb } from '@/components/web/EsqueletoWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useCercania } from '@/hooks/use-cercania';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { RADIOS_KM, textoDeCercania } from '@/lib/cerca';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';

/**
 * `/cerca`: los lugares publicados cerca de una universidad, del más cercano al más lejano. El punto es la universidad de la cuenta (si la tiene y entró) o, si no, la primera de la lista de Cuervo 360, y la página dice cuál es:
 * nunca se inventa un punto. Las coordenadas públicas están redondeadas (~1 km): la distancia es aproximada y el tiempo, en línea recta. Cuatro estados distintos (END-11): cargando, FALLÓ, nada en ese radio y la lista.
 */
export function CercaWeb() {
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const { telefono, columnas, anchoTarjeta } = medidasWeb(ancho);
  const [radio, setRadio] = useState<number>(3);
  const { punto, lista, cargando, fallo, reintentar, posiblementeMas } = useCercania(radio);
  // La misma pantalla en la app: sin el marco de la web, con filas (foto a la izquierda) en vez de la rejilla de tarjetas.
  const web = Platform.OS === 'web';

  let cuerpo;
  if (fallo) cuerpo = <ErrorDeCarga etiqueta="No pudimos cargar los lugares cercanos" onReintentar={reintentar} />;
  else if (cargando) cuerpo = web ? <EsqueletoTarjetasWeb cuantas={columnas} ancho={anchoTarjeta} /> : <EsqueletoFilasWeb filas={3} />;
  else if (lista.length === 0) {
    cuerpo = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{`No hay lugares publicados a menos de ${radio} km. Prueba con un radio mayor.`}</ThemedText>;
  } else {
    cuerpo = (
      <>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">
          {`${lista.length} ${lista.length === 1 ? 'lugar' : 'lugares'} a menos de ${radio} km, del más cercano al más lejano.`}
          {posiblementeMas ? ' Hay más lugares en la zona de los que se pueden ordenar aquí: baja el radio para ver los más cercanos con seguridad.' : ''}
        </ThemedText>
        {web ? (
          <View style={estilos.cuadricula}>
            {lista.map(({ item, km }, i) => <TarjetaPublicacionWeb key={item.id} p={item} ancho={anchoTarjeta} compacta={telefono} paso={i % columnas} razon={textoDeCercania(km)} iconoRazon="location-outline" />)}
          </View>
        ) : (
          <View style={estilos.filas}>
            {lista.map(({ item, km }) => <FilaLugarCercano key={item.id} p={item} km={km} />)}
          </View>
        )}
      </>
    );
  }

  const intro = (
    <ThemedText style={Texto.cuerpo} themeColor="textSecondary">
      {`Distancia a ${punto.nombre}. Es aproximada (las ubicaciones públicas se redondean) y los tiempos son estimaciones en línea recta, sin calles ni tráfico.`}
    </ThemedText>
  );
  const radios = (
        <View style={estilos.fila} accessibilityRole="radiogroup" accessibilityLabel="Radio de búsqueda">
          {RADIOS_KM.map((r) => {
            const activo = r === radio;
            return (
              <Pulsable
                key={r}
                onPress={() => setRadio(r)}
                accessibilityRole="radio"
                accessibilityLabel={`A menos de ${r} km`}
                accessibilityState={{ checked: activo }}
                aria-checked={activo}
                style={[estilos.chip, { borderColor: activo ? theme.sello : theme.filete, backgroundColor: activo ? theme.sello : theme.backgroundElement }]}
              >
                <ThemedText style={[Texto.pequenoFuerte, { color: activo ? theme.selloTexto : theme.text }]}>{`${r} km`}</ThemedText>
              </Pulsable>
            );
          })}
        </View>
  );

  if (!web) {
    return (
      <ThemedView style={estilos.pantalla}>
        <ScrollView contentContainerStyle={estilos.desplazable} showsVerticalScrollIndicator={false}>
          {intro}
          {radios}
          {cuerpo}
        </ScrollView>
      </ThemedView>
    );
  }
  return (
    <PaginaWeb activa="depas" titulo="Cerca de tu universidad">
      <View style={estilos.cuerpo}>
        <ThemedText accessibilityRole="header" style={Texto.seccionWebCompacto}>Cerca de tu universidad</ThemedText>
        {intro}
        {radios}
        {cuerpo}
      </View>
    </PaginaWeb>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  filas: { gap: Spacing.two },
  cuerpo: { gap: Spacing.three },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
});
