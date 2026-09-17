import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { BotonWhatsApp } from '@/components/BotonWhatsApp';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { obtenerPublicacion, registrarMatch, reportarPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type { Publicacion } from '@/types/database.types';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export default function DetallePublicacionScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const { perfil, cargarPerfil } = usePerfilStore();
  const [publicacion, setPublicacion] = useState<Publicacion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    obtenerPublicacion(id)
      .then(setPublicacion)
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  const onContactar = async () => {
    if (session?.user.id && publicacion) {
      // score en 0 porque aquí no viene del motor de sugerencias (sección 14);
      // cuando el usuario contacta desde "Sugerencias" (Semana 5+) sí se pasa el score real.
      await registrarMatch(session.user.id, publicacion.id, 0).catch(() => {});
    }
  };

  const onReportar = () => {
    if (!session?.user.id || !publicacion) return;
    const usuarioId = session.user.id;
    const publicacionId = publicacion.id;
    const enviar = async (motivo: string) => {
      try {
        await reportarPublicacion(usuarioId, publicacionId, motivo);
        Alert.alert('Gracias', 'Reportamos esta publicación para revisión.');
      } catch {
        Alert.alert('No se pudo enviar el reporte', 'Intenta de nuevo en un momento.');
      }
    };
    Alert.alert('Reportar publicación', '¿Por qué la reportas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Contenido sospechoso', onPress: () => enviar('contenido sospechoso') },
      { text: 'Información falsa', onPress: () => enviar('información falsa') },
    ]);
  };

  if (cargando) {
    return (
      <ThemedView style={styles.centrado}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!publicacion) {
    return (
      <ThemedView style={styles.centrado}>
        <ThemedText>No se encontró esta publicación.</ThemedText>
      </ThemedView>
    );
  }

  const tieneUbicacion = publicacion.latitud != null && publicacion.longitud != null;
  const distanciaKm =
    tieneUbicacion && perfil?.latitud_universidad != null && perfil?.longitud_universidad != null
      ? calcularDistanciaKm(
          perfil.latitud_universidad,
          perfil.longitud_universidad,
          publicacion.latitud as number,
          publicacion.longitud as number
        )
      : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {publicacion.fotos && publicacion.fotos.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carrusel}
          accessibilityLabel={`${publicacion.fotos.length} fotos de la publicación`}
        >
          {publicacion.fotos.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.foto} />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.foto, styles.fotoAncha, { backgroundColor: theme.backgroundSelected }]} />
      )}

      <ThemedText type="title" style={styles.precio}>
        {`$${formateadorPrecio.format(publicacion.precio_renta)}/mes`}
      </ThemedText>
      <ThemedText type="smallBold">{publicacion.direccion}</ThemedText>
      {distanciaKm !== null && (
        <ThemedText type="small" style={styles.distancia}>
          {distanciaKm.toFixed(1)} km de tu universidad
        </ThemedText>
      )}
      {publicacion.descripcion && <ThemedText style={styles.descripcion}>{publicacion.descripcion}</ThemedText>}

      {tieneUbicacion && (
        <MapView
          style={styles.mapa}
          initialRegion={{
            latitude: publicacion.latitud as number,
            longitude: publicacion.longitud as number,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          zoomEnabled
          scrollEnabled
          rotateEnabled
          zoomControlEnabled
        >
          <Marker
            coordinate={{ latitude: publicacion.latitud as number, longitude: publicacion.longitud as number }}
            title={publicacion.direccion}
          />
        </MapView>
      )}

      <View style={{ marginTop: Spacing.three }}>
        <BotonWhatsApp
          numero={publicacion.whatsapp}
          mensaje={`Hola, vi tu publicación en Cuervo Pass (${publicacion.direccion})`}
          onContactar={onContactar}
        />
      </View>

      <Pressable
        onPress={onReportar}
        style={styles.reportarBoton}
        accessibilityRole="button"
        accessibilityLabel="Reportar publicación"
      >
        <ThemedText style={styles.reportarTexto}>Reportar publicación</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  carrusel: { borderRadius: Spacing.two },
  foto: { width: 340, height: 220, borderRadius: Spacing.two, marginRight: Spacing.two },
  fotoAncha: { width: '100%' },
  precio: { fontSize: 28, lineHeight: 34, marginTop: Spacing.three },
  distancia: { marginTop: Spacing.half },
  descripcion: { marginTop: Spacing.two },
  mapa: { height: 240, borderRadius: Spacing.two, marginTop: Spacing.three, overflow: 'hidden' },
  reportarBoton: { marginTop: Spacing.four, padding: Spacing.three, minHeight: 44, justifyContent: 'center' },
  reportarTexto: { color: AppColors.destructiveRed, textAlign: 'center' },
});
