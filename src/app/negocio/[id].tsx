import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { BotonFavoritoNegocio } from '@/components/BotonFavoritoNegocio';
import { Estrellas } from '@/components/ficha/Estrellas';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Pastilla } from '@/components/ficha/Pastilla';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { SeccionResenas } from '@/components/SeccionResenas';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AltoFotoTarjeta, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useMisNegocios } from '@/hooks/queries/useMisNegocios';
import { useNegocio } from '@/hooks/queries/useServicios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { resumenDeTurnos } from '@/lib/horario';
import { agruparPorSeccion } from '@/lib/menu';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** Claves de las pestañas: «Todo» y los productos sin categoría («Otros»). No chocan con el nombre de una categoría escrita a mano. */
const TODO = '\u0000todo';
const SIN_CATEGORIA = '\u0000otros';

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
  const { negocio, items, turnos, cargando, fallo, reintentar } = useNegocio(id);
  const miId = useAuthStore((s) => s.session?.user.id);
  // ¿Es MI negocio? La vista pública no trae al dueño, así que se compara con la lista de los míos.
  const { negocios: misNegocios } = useMisNegocios(miId);
  const [foja, setFoja] = useState(0);
  const [categoria, setCategoria] = useState(TODO);
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
  const esDueno = misNegocios.some((n) => n.id === negocio.id);
  const grupos = agruparPorSeccion(items.map((i) => ({ ...i, seccion: i.seccion ?? '' })));
  // Con dos o más categorías, pestañas que se deslizan; «Todo» agrupa. Si la elegida ya no existe (el menú cambió), se vuelve a «Todo».
  const claveDe = (g: { seccion: string | null }) => g.seccion ?? SIN_CATEGORIA;
  const conPestanas = grupos.length >= 2;
  const activa = conPestanas && grupos.some((g) => claveDe(g) === categoria) ? categoria : TODO;
  const visibles = activa === TODO ? grupos : grupos.filter((g) => claveDe(g) === activa);
  // Divide por el ancho ACOTADO con el que se pintan las fotos (como en la ficha de un depa).
  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => setFoja(Math.round(e.nativeEvent.contentOffset.x / anchoLista));
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
          <View style={estilos.filaTitulo}>
            <ThemedText type="title" style={estilos.tituloFlex}>{negocio.nombre}</ThemedText>
            <BotonFavoritoNegocio negocioId={negocio.id} />
          </View>
          <View style={estilos.fila}>
            <Estrellas calificacion={negocio.calificacion} numResenas={negocio.num_resenas ?? 0} compacta />
            {negocio.origen === 'sembrado' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Negocio de ejemplo
              </ThemedText>
            ) : null}
          </View>
        </View>

        {negocio.descripcion ? <ThemedText style={estilos.descripcion}>{negocio.descripcion}</ThemedText> : null}

        <View style={estilos.pastillas}>
          {negocio.abierto_ahora != null ? (
            <Pastilla icono="time-outline" texto={negocio.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora'} atenuada={!negocio.abierto_ahora} />
          ) : null}
          {turnos.length === 0 && negocio.horario ? <Pastilla icono="time-outline" texto={negocio.horario} /> : null}
          <Pastilla icono="location-outline" texto={negocio.direccion} />
        </View>

        {turnos.length > 0 ? (
          <View style={estilos.menu} accessibilityLabel="Horario">
            <ThemedText type="smallBold" themeColor="textSecondary">Horario</ThemedText>
            {resumenDeTurnos(turnos).split('; ').map((linea) => (
              <ThemedText key={linea} type="small">{linea}</ThemedText>
            ))}
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={estilos.menu}>
            <ThemedText type="subtitle">Menú y precios</ThemedText>
            {conPestanas ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.pestanas}>
                {[{ clave: TODO, nombre: 'Todo' }, ...grupos.map((g) => ({ clave: claveDe(g), nombre: g.seccion ?? 'Otros' }))].map((c) => {
                  const elegida = c.clave === activa;
                  return (
                    <Pulsable
                      key={c.clave}
                      onPress={() => setCategoria(c.clave)}
                      accessibilityRole="button"
                      accessibilityLabel={`Categoría ${c.nombre}`}
                      accessibilityState={{ selected: elegida }}
                      style={[
                        estilos.pestana,
                        { backgroundColor: elegida ? theme.text : theme.backgroundElement, borderColor: elegida ? theme.text : theme.filete },
                      ]}
                    >
                      <ThemedText type="small" style={[Texto.pesoFuerte, elegida && { color: theme.background }]}>{c.nombre}</ThemedText>
                    </Pulsable>
                  );
                })}
              </ScrollView>
            ) : null}
            {visibles.map((g) => (
              <View key={g.seccion ?? 'sin-seccion'} style={estilos.menu}>
                {activa === TODO ? <ThemedText type="smallBold" themeColor="textSecondary">{g.seccion ?? 'Otros'}</ThemedText> : null}
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

        <SeccionResenas
          objetivo={{ negocioId: negocio.id }}
          esDueno={esDueno}
          calificacion={negocio.calificacion}
          numResenas={negocio.num_resenas ?? 0}
        />

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
  filaTitulo: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  tituloFlex: { flex: 1 },
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
  pestanas: { gap: Spacing.two },
  pestana: { minHeight: 44, paddingHorizontal: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.full, justifyContent: 'center' },
  tarjetaMenu: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, paddingHorizontal: Spacing.three },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 52, paddingVertical: Spacing.two },
  miniatura: { width: 56, height: 56, borderRadius: Radios.control },
  foja: { position: 'absolute', right: Spacing.three, bottom: Spacing.five, borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  nombreItem: { flex: 1 },
});
