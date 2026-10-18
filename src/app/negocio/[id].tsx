import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Pastilla } from '@/components/ficha/Pastilla';
import { Sello } from '@/components/ficha/Sello';
import { signosDePrecio } from '@/components/TarjetaNegocio';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AltoFotoTarjeta, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useNegocio } from '@/hooks/queries/useServicios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { agruparPorSeccion } from '@/lib/menu';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/**
 * La ficha de un negocio · Cuervo 360 (propuesta visual del 17/10/2026).
 *
 * Tres estados y no dos (END-11): cargando, falló y «no existe o no es visible» se pintan distinto. El menú dice
 * «Consultar precio» cuando no hay uno y nunca inventa un precio. Un negocio de ejemplo se rotula. «Cómo llegar»
 * solo existe si el negocio tiene coordenadas. No hay reseñas ni calificaciones: serían datos fabricados.
 */
export default function NegocioScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { anchoLista } = useTamanoPantalla();
  const { negocio, items, cargando, fallo, reintentar } = useNegocio(id);
  const [foja, setFoja] = useState(0);
  // Una sola firma EN LOTE para la galería y las fotos de los productos.
  const { urls } = useFotosFirmadas([...(negocio?.fotos ?? []), ...items.map((i) => i.foto)]);

  if (cargando) {
    return (
      <ThemedView style={estilos.pantalla}>
        <View style={estilos.margen}>
          <ListaEsqueleto variante="hoja" filas={1} conFoto etiquetas={['MENÚ', 'HORARIO']} />
        </View>
      </ThemedView>
    );
  }

  if (fallo) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.error} />
        <ThemedText type="small" themeColor="textSecondary" style={estilos.textoCentrado}>
          No pudimos cargar este negocio. Revisa tu conexión e intenta de nuevo.
        </ThemedText>
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </ThemedView>
    );
  }

  if (!negocio) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="storefront-outline" size={28} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={estilos.textoCentrado}>
          Este negocio ya no está disponible.
        </ThemedText>
      </ThemedView>
    );
  }

  const fotos = negocio.fotos;
  const grupos = agruparPorSeccion(items.map((i) => ({ ...i, seccion: i.seccion ?? '' })));
  // Divide por el ancho ACOTADO con el que se pintan las fotos (como en la ficha de un depa).
  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => setFoja(Math.round(e.nativeEvent.contentOffset.x / anchoLista));
  const precio = signosDePrecio(negocio.rango_precio);
  const hayMapa = negocio.latitud != null && negocio.longitud != null;

  const comoLlegar = async () => {
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${negocio.latitud},${negocio.longitud}`);
    } catch {
      // Sin app de mapas no hay nada más que intentar; la dirección sigue a la vista.
    }
  };

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={[estilos.hoja, { maxWidth: anchoLista }]}
      showsVerticalScrollIndicator={false}
    >
      {fotos.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={alDesplazar}
            accessibilityLabel={`${fotos.length} fotografías del negocio`}
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
            // «1 de 12» en una pastilla oscura sobre la foto: dice en cuál vas y cuántas faltan.
            <View style={[estilos.foja, { backgroundColor: theme.text }]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {foja + 1} de {fotos.length}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="storefront-outline" size={32} color={theme.textSecondary} />
        </View>
      )}

      <View style={[estilos.cuerpo, { backgroundColor: theme.background }]}>
        <View style={estilos.encabezado}>
          <ThemedText type="title">{negocio.nombre}</ThemedText>
          <View style={estilos.fila}>
            {precio ? (
              <ThemedText type="small" style={Texto.pesoFuerte}>
                {precio}
              </ThemedText>
            ) : null}
            {negocio.origen === 'sembrado' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Negocio de ejemplo
              </ThemedText>
            ) : null}
          </View>
        </View>

        {negocio.descripcion ? <ThemedText style={estilos.descripcion}>{negocio.descripcion}</ThemedText> : null}

        <View style={estilos.pastillas}>
          {negocio.horario ? <Pastilla icono="time-outline" texto={negocio.horario} /> : null}
          <Pastilla icono="location-outline" texto={negocio.direccion} />
        </View>

        {items.length > 0 ? (
          <View style={estilos.menu}>
            <ThemedText type="subtitle">Menú y precios</ThemedText>
            {grupos.map((g) => (
              <View key={g.seccion ?? 'sin-seccion'} style={estilos.menu}>
                <ThemedText type="smallBold" themeColor="textSecondary">{g.seccion ?? 'Otros'}</ThemedText>
                <View style={[estilos.tarjetaMenu, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
                  {g.productos.map((it, i) => {
                    const miniatura = it.foto ? urls.get(it.foto) : null;
                    return (
                      <View
                        key={it.id}
                        style={[estilos.renglon, i > 0 && { borderTopWidth: Filete.fino, borderTopColor: theme.filete }]}
                      >
                        {miniatura ? <Image source={{ uri: miniatura }} style={estilos.miniatura} contentFit="cover" /> : null}
                        <View style={estilos.nombreItem}>
                          <ThemedText style={Texto.pesoFuerte}>{it.nombre}</ThemedText>
                          {it.descripcion ? (
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>{it.descripcion}</ThemedText>
                          ) : null}
                        </View>
                        {it.precio != null ? (
                          <ThemedText style={Texto.pesoFuerte}>{`$${formateadorPrecio.format(it.precio)}`}</ThemedText>
                        ) : (
                          <ThemedText type="small" themeColor="textSecondary">Consultar precio</ThemedText>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {hayMapa ? (
          <Sello variante="contorno" icono="map-outline" onPress={comoLlegar} accessibilityLabel="Cómo llegar">
            Cómo llegar
          </Sello>
        ) : null}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  margen: { padding: Spacing.three },
  hoja: { width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  textoCentrado: { textAlign: 'center', lineHeight: 22 },
  foto: { width: '100%', height: AltoFotoTarjeta * 1.2 },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  // La hoja de contenido sube sobre la foto con las esquinas de arriba redondeadas, como la ficha de un depa.
  cuerpo: {
    padding: Spacing.three,
    gap: Spacing.three,
    marginTop: -Spacing.four,
    borderTopLeftRadius: Radios.hojaInferior,
    borderTopRightRadius: Radios.hojaInferior,
  },
  encabezado: { gap: Spacing.one },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  descripcion: { lineHeight: 24 },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  menu: { gap: Spacing.two },
  tarjetaMenu: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, paddingHorizontal: Spacing.three },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 52, paddingVertical: Spacing.two },
  miniatura: { width: 56, height: 56, borderRadius: Radios.control },
  foja: { position: 'absolute', right: Spacing.three, bottom: Spacing.five, borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  nombreItem: { flex: 1 },
});
