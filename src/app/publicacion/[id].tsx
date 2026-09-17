import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

import { BotonWhatsApp } from '@/components/BotonWhatsApp';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { obtenerPublicacion, registrarMatch, reportarPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

// TODO (Semana 4): mapa pequeño con la ubicación (lat/lng vienen de Mapbox Geocoding).
export default function DetallePublicacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const [publicacion, setPublicacion] = useState<Publicacion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    obtenerPublicacion(id)
      .then(setPublicacion)
      .finally(() => setCargando(false));
  }, [id]);

  const onContactar = async () => {
    if (session?.user.id && publicacion) {
      // score en 0 porque aquí no viene del motor de sugerencias (sección 14);
      // cuando el usuario contacta desde "Sugerencias" (Semana 5+) sí se pasa el score real.
      await registrarMatch(session.user.id, publicacion.id, 0).catch(() => {});
    }
  };

  const onReportar = () => {
    if (!session?.user.id || !publicacion) return;
    Alert.alert('Reportar publicación', '¿Por qué la reportas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Contenido sospechoso',
        onPress: () => reportarPublicacion(session.user.id, publicacion.id, 'contenido sospechoso'),
      },
      {
        text: 'Información falsa',
        onPress: () => reportarPublicacion(session.user.id, publicacion.id, 'información falsa'),
      },
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {publicacion.fotos && publicacion.fotos.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.carrusel}>
          {publicacion.fotos.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.foto} />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.foto, styles.fotoVacia]} />
      )}

      <ThemedText type="title" style={styles.precio}>
        {`$${formateadorPrecio.format(publicacion.precio_renta)}/mes`}
      </ThemedText>
      <ThemedText type="smallBold">{publicacion.direccion}</ThemedText>
      {publicacion.descripcion && <ThemedText style={styles.descripcion}>{publicacion.descripcion}</ThemedText>}

      <View style={{ marginTop: Spacing.three }}>
        <BotonWhatsApp
          numero={publicacion.whatsapp}
          mensaje={`Hola, vi tu publicación en Cuervo Pass (${publicacion.direccion})`}
          onContactar={onContactar}
        />
      </View>

      <ThemedText style={styles.reportarTexto} onPress={onReportar}>
        Reportar publicación
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  carrusel: { borderRadius: Spacing.two },
  foto: { width: 340, height: 220, borderRadius: Spacing.two, marginRight: Spacing.two },
  fotoVacia: { width: '100%', height: 220, backgroundColor: '#E0E1E6' },
  precio: { fontSize: 28, lineHeight: 34, marginTop: Spacing.three },
  descripcion: { marginTop: Spacing.two },
  reportarTexto: { color: '#d92d20', textAlign: 'center', marginTop: Spacing.four },
});
