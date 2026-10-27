import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { EsqueletoTarjetasWeb } from '@/components/web/EsqueletoWeb';
import { BotonWeb } from '@/components/web/BotonWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { TarjetaNegocioWeb } from '@/components/web/TarjetaNegocioWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { useMisNegociosFavoritosIds } from '@/hooks/queries/useFavoritosNegocios';
import { useNegociosPorIds, usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';
import { RutasWeb } from '@/lib/rutasWeb';
import { useAuthStore } from '@/store/useAuthStore';

type Segmento = 'publicaciones' | 'negocios';

/**
 * Favoritos en la web: lo que la cuenta guardó, en la misma rejilla de tarjetas que `/departamentos` y `/servicios`. Dos pestañas (lugares y negocios) con su cuenta, y cuatro estados distintos en cada una
 * (END-11): cargando, FALLÓ la lectura (nunca «no guardaste nada»), nada guardado y lista. Lo guardado que ya no es visible se DICE: la fila del favorito se conserva y, si vuelve a ser visible, vuelve a salir.
 */
export function FavoritosWeb() {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { ancho } = useTamanoPantalla();
  const { telefono, anchoTarjeta, columnas } = medidasWeb(ancho);
  const [segmento, setSegmento] = useState<Segmento>('publicaciones');

  const guardadasPub = useMisFavoritosIds(miId);
  const guardadasNeg = useMisNegociosFavoritosIds(miId);
  const idsPub = [...guardadasPub.ids].sort();
  const idsNeg = [...guardadasNeg.ids].sort();
  const viviendas = usePublicacionesPorIds(idsPub);
  const negocios = useNegociosPorIds(idsNeg);

  const esViviendas = segmento === 'publicaciones';
  const guardadas = esViviendas ? guardadasPub : guardadasNeg;
  const lista = esViviendas ? viviendas : negocios;
  const total = esViviendas ? viviendas.publicaciones.length : negocios.negocios.length;
  const noDisponibles = Math.max(0, guardadas.ids.size - total);

  const opciones: { valor: Segmento; nombre: string; n: number }[] = [
    { valor: 'publicaciones', nombre: 'Publicaciones', n: guardadasPub.ids.size },
    { valor: 'negocios', nombre: 'Negocios', n: guardadasNeg.ids.size },
  ];

  let cuerpo;
  if (guardadas.fallo || lista.fallo) {
    cuerpo = <ErrorDeCarga etiqueta="No pudimos cargar tus favoritos" onReintentar={lista.reintentar} />;
  } else if (guardadas.cargando || lista.cargando) {
    cuerpo = <EsqueletoTarjetasWeb cuantas={columnas} ancho={anchoTarjeta} />;
  } else if (guardadas.ids.size === 0) {
    cuerpo = (
      <View style={estilos.vacio}>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">
          {esViviendas ? 'Aún no guardas ningún lugar. Toca el corazón en uno para volver a él más tarde.' : 'Aún no guardas ningún negocio. Toca el corazón en uno para volver a él más tarde.'}
        </ThemedText>
        <BotonWeb variante="contorno" onPress={() => router.push(esViviendas ? RutasWeb.departamentos : RutasWeb.servicios)} accessibilityLabel={esViviendas ? 'Explorar lugares' : 'Explorar negocios'}>
          {esViviendas ? 'Explorar lugares' : 'Explorar negocios'}
        </BotonWeb>
      </View>
    );
  } else {
    cuerpo = (
      <>
        {noDisponibles > 0 ? (
          <ThemedText style={Texto.pequeno} themeColor="textSecondary">
            {esViviendas
              ? noDisponibles === 1 ? '1 publicación guardada ya no está disponible.' : `${noDisponibles} publicaciones guardadas ya no están disponibles.`
              : noDisponibles === 1 ? '1 negocio guardado ya no está disponible.' : `${noDisponibles} negocios guardados ya no están disponibles.`}
          </ThemedText>
        ) : null}
        <View style={estilos.cuadricula}>
          {esViviendas
            ? viviendas.publicaciones.map((p, i) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} compacta={telefono} paso={i % columnas} />)
            : negocios.negocios.map((n, i) => <TarjetaNegocioWeb key={n.id} n={n} ancho={anchoTarjeta} paso={i % columnas} />)}
        </View>
      </>
    );
  }

  return (
    <PaginaSesionWeb titulo="Favoritos" subtitulo="Lo que guardaste, para decidir con calma.">
      <View style={estilos.fila} accessibilityRole="radiogroup" accessibilityLabel="Qué guardaste">
        {opciones.map((o) => {
          const activa = segmento === o.valor;
          return (
            <Pulsable
              key={o.valor}
              onPress={() => setSegmento(o.valor)}
              accessibilityRole="radio"
              accessibilityLabel={`${o.nombre} (${o.n})`}
              accessibilityState={{ checked: activa }}
              aria-checked={activa}
              style={[estilos.chip, { borderColor: activa ? theme.sello : theme.filete, backgroundColor: activa ? theme.sello : theme.backgroundElement }]}
            >
              <ThemedText style={[Texto.pequenoFuerte, { color: activa ? theme.selloTexto : theme.text }]}>{`${o.nombre} (${o.n})`}</ThemedText>
            </Pulsable>
          );
        })}
      </View>
      <View style={estilos.resultados}>{cuerpo}</View>
    </PaginaSesionWeb>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
  resultados: { gap: Spacing.three },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
});
