import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { PieFijo } from '@/components/ficha/PieFijo';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AltoFotoTarjeta, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useNegocio } from '@/hooks/queries/useServicios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/**
 * Un producto de un negocio · Cuervo 360 (maqueta B del 24/10/2026).
 *
 * Sus fotos se deslizan (hasta 5; la primera es la portada), con «1 de N» encima; debajo, la categoría, el nombre, el precio grande y la descripción, y de qué
 * negocio es. Llega con el id del producto y el del negocio (`?negocio=`): el producto sale de los productos que ya trae la ficha del negocio. Cuatro estados,
 * distintos (END-11): cargando, falló, ya no existe y lo que se enseña. Sin precio dice «Consultar precio»; nunca se inventa uno ni un cero.
 */
export default function ProductoScreen() {
  const theme = useTheme();
  const { id, negocio: negocioId } = useLocalSearchParams<{ id: string; negocio: string }>();
  const { anchoLista } = useTamanoPantalla();
  const { negocio, items, cargando, fallo, reintentar } = useNegocio(negocioId);
  const [foja, setFoja] = useState(0);

  const producto = items.find((i) => i.id === id);
  // Una fila de antes de la 0085 solo trae `foto`: su portada única es su única foto.
  const fotos = producto ? (producto.fotos?.length ? producto.fotos : producto.foto ? [producto.foto] : []) : [];
  const { urls } = useFotosFirmadas(fotos);

  if (cargando) {
    return (
      <ThemedView style={estilos.pantalla}>
        <View style={estilos.margen}>
          <ListaEsqueleto variante="hoja" filas={1} conFoto etiquetas={['PRECIO']} />
        </View>
      </ThemedView>
    );
  }

  if (fallo) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.error} />
        <ThemedText type="small" themeColor="textSecondary" style={estilos.textoCentrado}>
          No pudimos cargar este producto. Revisa tu conexión e intenta de nuevo.
        </ThemedText>
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </ThemedView>
    );
  }

  if (!negocio || !producto) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="pricetag-outline" size={28} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={estilos.textoCentrado}>
          Este producto ya no está disponible.
        </ThemedText>
      </ThemedView>
    );
  }

  const hayMapa = negocio.latitud != null && negocio.longitud != null;
  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => setFoja(Math.round(e.nativeEvent.contentOffset.x / anchoLista));
  const comoLlegar = async () => {
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${negocio.latitud},${negocio.longitud}`);
    } catch {
      // Sin app de mapas no hay nada más que intentar; el negocio sigue a un toque.
    }
  };

  return (
    <View style={estilos.pantalla}>
      <ScrollView style={estilos.pantalla} contentContainerStyle={[estilos.hoja, { maxWidth: anchoLista }]} showsVerticalScrollIndicator={false}>
        {fotos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={alDesplazar}
              accessibilityLabel={`${fotos.length} fotografías del producto`}
            >
              {fotos.map((ruta) => {
                const url = urls.get(ruta);
                return url ? (
                  <Image key={ruta} source={{ uri: url }} style={[estilos.foto, { width: anchoLista }]} contentFit="cover" transition={160} />
                ) : (
                  <View key={ruta} style={[estilos.foto, estilos.sinFoto, { width: anchoLista, backgroundColor: theme.backgroundSelected }]} />
                );
              })}
            </ScrollView>
            {fotos.length > 1 ? (
              // «1 de 3» en una pastilla oscura sobre la foto: dice en cuál va y cuántas faltan.
              <View style={[estilos.foja, { backgroundColor: theme.text }]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {foja + 1} de {fotos.length}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[estilos.foto, estilos.sinFoto, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="image-outline" size={32} color={theme.textSecondary} />
          </View>
        )}

        <View style={[estilos.cuerpo, { backgroundColor: theme.background }]}>
          {producto.seccion || producto.estrella ? (
            <View style={estilos.etiquetas}>
              {producto.seccion ? (
                <View style={[estilos.etiqueta, { borderColor: theme.filete }]}>
                  <ThemedText type="small" style={Texto.pesoFuerte}>{producto.seccion}</ThemedText>
                </View>
              ) : null}
              {producto.estrella ? (
                <View style={[estilos.etiqueta, { backgroundColor: theme.lima, borderColor: theme.lima }]}>
                  <Ionicons name="star" size={14} color={theme.limaTexto} />
                  <ThemedText type="small" style={[Texto.pesoFuerte, { color: theme.limaTexto }]}>Destacado</ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <ThemedText type="title">{producto.nombre}</ThemedText>
          {producto.precio != null ? (
            <ThemedText style={Texto.tituloHoja}>{`$${formateadorPrecio.format(producto.precio)}`}</ThemedText>
          ) : (
            <ThemedText themeColor="textSecondary" style={Texto.pesoFuerte}>Consultar precio</ThemedText>
          )}
          {producto.descripcion ? <ThemedText style={estilos.descripcion}>{producto.descripcion}</ThemedText> : null}

          <Pulsable
            onPress={() => router.push({ pathname: '/negocio/[id]', params: { id: negocio.id } })}
            accessibilityRole="button"
            accessibilityLabel="Ver el negocio"
            style={[estilos.negocio, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
          >
            <Ionicons name="storefront-outline" size={22} color={theme.bosque} />
            <View style={estilos.textosNegocio}>
              <ThemedText style={Texto.pesoFuerte} numberOfLines={1}>{negocio.nombre}</ThemedText>
              {negocio.abierto_ahora != null ? (
                <ThemedText type="small" themeColor="textSecondary">{negocio.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora'}</ThemedText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pulsable>
        </View>
      </ScrollView>
      {hayMapa ? (
        <PieFijo>
          <Sello icono="map-outline" onPress={comoLlegar} accessibilityLabel="Cómo llegar">
            Cómo llegar
          </Sello>
        </PieFijo>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  margen: { padding: Spacing.three },
  hoja: { width: '100%', alignSelf: 'center', paddingBottom: Spacing.five },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  textoCentrado: { textAlign: 'center', lineHeight: 22 },
  foto: { width: '100%', height: AltoFotoTarjeta * 1.4 },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  foja: { position: 'absolute', right: Spacing.three, bottom: Spacing.five, borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  // La hoja sube sobre la foto con las esquinas de arriba redondeadas, como la ficha de un depa y la del negocio.
  cuerpo: {
    padding: Spacing.three,
    gap: Spacing.three,
    marginTop: -Spacing.four,
    borderTopLeftRadius: Radios.hojaInferior,
    borderTopRightRadius: Radios.hojaInferior,
  },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, borderWidth: Filete.fino, borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  descripcion: { lineHeight: 24 },
  negocio: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  textosNegocio: { flex: 1 },
});
