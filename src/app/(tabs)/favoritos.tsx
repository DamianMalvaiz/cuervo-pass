import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { FilaPublicacion } from '@/components/FilaPublicacion';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useMisFavoritos } from '@/hooks/queries/useFavoritos';
import { calcularDistanciaKm } from '@/lib/distancia';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Favoritos · Cuervo 360. Las publicaciones que esta cuenta guardó.
 *
 * Cuatro estados, y los cuatro distintos (END-11): cargando, falló la lectura, nada guardado, y
 * lista. Que falle la lectura NO dice «no guardaste nada». Las guardadas que ya no son visibles
 * (el dueño la desactivó, o se ocultó por reportes) se DICEN: la fila del favorito se conserva y
 * si el dueño la reactiva, vuelve a aparecer.
 */
export default function FavoritosScreen() {
  const { anchoLista } = useTamanoPantalla();
  const margenSuperior = useMargenSuperior();
  const miId = useAuthStore((s) => s.session?.user.id);
  const perfil = usePerfilStore((s) => s.perfil);
  const { publicaciones, noDisponibles, cargando, fallo, reintentar } = useMisFavoritos(miId);
  const { urls: urlsFirmadas } = useFotosFirmadas(publicaciones.map((p) => p.fotos?.[0]));

  // La distancia sale de la universidad de esta cuenta, si la tiene; si no, la fila dice «—» en vez
  // de inventarla.
  const distanciaDe = (lat: number | null, lon: number | null) =>
    perfil?.latitud_universidad != null && perfil?.longitud_universidad != null && lat != null && lon != null
      ? calcularDistanciaKm(perfil.latitud_universidad, perfil.longitud_universidad, lat, lon)
      : null;

  const textoNoDisponibles =
    noDisponibles === 1
      ? '1 publicación guardada ya no está disponible.'
      : `${noDisponibles} publicaciones guardadas ya no están disponibles.`;

  return (
    <ThemedView style={estilos.pantalla}>
      <FlatList
        data={publicaciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[estilos.lista, { paddingTop: margenSuperior, maxWidth: anchoLista }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={estilos.encabezado}>
            <Encabezado
              titulo="Favoritos"
            />
            {noDisponibles > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {textoNoDisponibles}
              </ThemedText>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FilaPublicacion
            publicacionId={item.id}
            titulo={item.titulo}
            tipo={item.tipo}
            precio={item.precio_renta}
            fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
            distanciaKm={distanciaDe(item.latitud, item.longitud)}
            onPress={() => router.push({ pathname: '/publicacion/[id]', params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={null}
        ListEmptyComponent={
          cargando ? (
            <ListaEsqueleto variante="hoja" filas={3} etiquetas={['RENTA MENSUAL', 'DISTANCIA']} />
          ) : fallo ? (
            <View style={estilos.estado}>
              <BloqueEstado
                tono="alerta"
                icono="cloud-offline-outline"
                etiqueta="No pudimos cargar tus favoritos"
                mensaje="Revisa tu conexión e intenta de nuevo."
              />
              <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">
                Reintentar
              </Sello>
            </View>
          ) : noDisponibles > 0 ? null : (
            <BloqueEstado
              icono="heart-outline"
              etiqueta="Sin resultados"
              mensaje="Aún no guardas ninguna publicación. Toca el corazón en una ficha para volver a ella más tarde."
            />
          )
        }
      />
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', alignSelf: 'center' },
  encabezado: { gap: Spacing.two },
  estado: { gap: Spacing.three },
});
