import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { FilaPublicacion } from '@/components/FilaPublicacion';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { TarjetaNegocio } from '@/components/TarjetaNegocio';
import { FavoritosWeb } from '@/components/web/FavoritosWeb';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useMisFavoritos } from '@/hooks/queries/useFavoritos';
import { useMisNegociosFavoritos } from '@/hooks/queries/useFavoritosNegocios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useMiniaturas } from '@/hooks/use-miniaturas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { ANCHOS } from '@/lib/miniaturas';
import { toque } from '@/lib/tacto';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

type Segmento = 'publicaciones' | 'negocios';
const SEGMENTOS: { valor: Segmento; etiqueta: string }[] = [
  { valor: 'publicaciones', etiqueta: 'Publicaciones' },
  { valor: 'negocios', etiqueta: 'Negocios' },
];

/**
 * Favoritos · Cuervo 360. Lo que esta cuenta guardó: publicaciones y (desde la 0073) negocios, en dos segmentos.
 *
 * Cuatro estados en cada uno, y los cuatro distintos (END-11): cargando, falló la lectura, nada guardado, y lista. Que falle la lectura NO dice «no guardaste
 * nada». Lo guardado que ya no es visible (el dueño lo desactivó, o se ocultó por reportes) se DICE: la fila del favorito se conserva y si vuelve a ser
 * visible, vuelve a aparecer.
 */
/** En la web, su propia página (rejilla de tarjetas); en la app, la lista de siempre. */
export default function FavoritosScreen() {
  return Platform.OS === 'web' ? <FavoritosWeb /> : <FavoritosApp />;
}

function FavoritosApp() {
  const margenSuperior = useMargenSuperior();
  const { anchoLista } = useTamanoPantalla();
  const [segmento, setSegmento] = useState<Segmento>('publicaciones');

  return (
    <ThemedView style={estilos.pantalla}>
      <View style={[estilos.cabecera, { paddingTop: margenSuperior, maxWidth: anchoLista }]}>
        <Encabezado titulo="Favoritos" />
        <Segmentos valor={segmento} onCambiar={setSegmento} />
      </View>
      {segmento === 'publicaciones' ? <ListaPublicaciones /> : <ListaNegocios />}
    </ThemedView>
  );
}

function Segmentos({ valor, onCambiar }: { valor: Segmento; onCambiar: (s: Segmento) => void }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={estilos.segmentos}>
      {SEGMENTOS.map((s) => {
        const activo = s.valor === valor;
        return (
          <Pulsable
            key={s.valor}
            accessibilityRole="tab"
            accessibilityLabel={s.etiqueta}
            accessibilityState={{ selected: activo }}
            onPress={() => {
              if (activo) return;
              toque();
              onCambiar(s.valor);
            }}
            style={[
              estilos.segmento,
              { borderColor: activo ? theme.text : theme.border, backgroundColor: activo ? theme.backgroundSelected : 'transparent' },
            ]}
          >
            <ThemedText style={activo ? Texto.pesoFuerte : undefined}>{s.etiqueta}</ThemedText>
          </Pulsable>
        );
      })}
    </View>
  );
}

function ListaPublicaciones() {
  const { anchoLista } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const perfil = usePerfilStore((s) => s.perfil);
  const { publicaciones, noDisponibles, cargando, fallo, reintentar } = useMisFavoritos(miId);
  const { urls: urlsFirmadas } = useFotosFirmadas(publicaciones.map((p) => p.fotos?.[0]));
  const miniaturas = useMiniaturas(publicaciones.map((p) => p.fotos?.[0]), ANCHOS.ancha);

  // La distancia sale de la universidad de esta cuenta, si la tiene; si no, la fila dice «—» en vez de inventarla.
  const distanciaDe = (lat: number | null, lon: number | null) =>
    perfil?.latitud_universidad != null && perfil?.longitud_universidad != null && lat != null && lon != null
      ? calcularDistanciaKm(perfil.latitud_universidad, perfil.longitud_universidad, lat, lon)
      : null;

  return (
    <FlatList
      data={publicaciones}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[estilos.lista, { maxWidth: anchoLista }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        noDisponibles > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {noDisponibles === 1 ? '1 publicación guardada ya no está disponible.' : `${noDisponibles} publicaciones guardadas ya no están disponibles.`}
          </ThemedText>
        ) : null
      }
      renderItem={({ item }) => (
        <FilaPublicacion
          publicacionId={item.id}
          titulo={item.titulo}
          tipo={item.tipo}
          precio={item.precio_renta}
          fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
          fotoMini={miniaturas(item.fotos?.[0])}
          distanciaKm={distanciaDe(item.latitud, item.longitud)}
          onPress={() => router.push({ pathname: '/publicacion/[id]', params: { id: item.id } })}
        />
      )}
      ItemSeparatorComponent={null}
      ListEmptyComponent={
        cargando ? (
          <ListaEsqueleto variante="hoja" filas={3} etiquetas={['RENTA MENSUAL', 'DISTANCIA']} />
        ) : fallo ? (
          <Fallo etiqueta="No pudimos cargar tus favoritos" onReintentar={reintentar} />
        ) : noDisponibles > 0 ? null : (
          <BloqueEstado icono="heart-outline" etiqueta="Sin resultados" mensaje="Aún no guardas ninguna publicación. Toca el corazón en una ficha para volver a ella más tarde." />
        )
      }
    />
  );
}

function ListaNegocios() {
  const { anchoLista } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { negocios, noDisponibles, cargando, fallo, reintentar } = useMisNegociosFavoritos(miId);
  const { urls } = useFotosFirmadas(negocios.map((n) => n.fotos[0]));
  const mini = useMiniaturas(negocios.map((n) => n.fotos[0]), ANCHOS.fila);

  return (
    <FlatList
      data={negocios}
      keyExtractor={(n) => n.id}
      contentContainerStyle={[estilos.lista, { maxWidth: anchoLista }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        noDisponibles > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {noDisponibles === 1 ? '1 negocio guardado ya no está disponible.' : `${noDisponibles} negocios guardados ya no están disponibles.`}
          </ThemedText>
        ) : null
      }
      renderItem={({ item }) => (
        <TarjetaNegocio
          negocio={item}
          fotoUrl={item.fotos[0] ? urls.get(item.fotos[0]) : null}
          fotoMini={mini(item.fotos[0])}
          onPress={() => router.push({ pathname: '/negocio/[id]', params: { id: item.id } })}
        />
      )}
      ListEmptyComponent={
        cargando ? (
          <ListaEsqueleto variante="renglon" filas={3} />
        ) : fallo ? (
          <Fallo etiqueta="No pudimos cargar tus negocios guardados" onReintentar={reintentar} />
        ) : noDisponibles > 0 ? null : (
          <BloqueEstado icono="heart-outline" etiqueta="Sin resultados" mensaje="Aún no guardas ningún negocio. Toca el corazón en un negocio de Servicios para volver a él más tarde." />
        )
      }
    />
  );
}

function Fallo({ etiqueta, onReintentar }: { etiqueta: string; onReintentar: () => void }) {
  return (
    <View style={estilos.estado}>
      <BloqueEstado tono="alerta" icono="cloud-offline-outline" etiqueta={etiqueta} mensaje="Revisa tu conexión e intenta de nuevo." />
      <Sello variante="contorno" icono="refresh" onPress={onReintentar} accessibilityLabel="Reintentar">
        Reintentar
      </Sello>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: { width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.three },
  segmentos: { flexDirection: 'row', gap: Spacing.two },
  segmento: { flex: 1, minHeight: 44, borderWidth: Filete.fino, borderRadius: Radios.control, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', alignSelf: 'center' },
  estado: { gap: Spacing.three },
});
