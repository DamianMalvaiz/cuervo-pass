import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { BotonVerContacto } from '@/components/BotonVerContacto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { ATRIBUCION_MAPA } from '@/lib/geocoding';
import {
  obtenerPublicacionPublica,
  reportarPublicacion,
  revelarContacto,
} from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type { PublicacionPublica } from '@/types/database.types';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

const ETIQUETA_TIPO: Record<string, string> = {
  depa: 'Departamento',
  cuarto: 'Cuarto',
  casa_compartida: 'Casa compartida',
};

export default function DetallePublicacionScreen() {
  const theme = useTheme();
  const { id, score } = useLocalSearchParams<{ id: string; score?: string }>();
  const session = useAuthStore((s) => s.session);
  const { perfil, cargarPerfil } = usePerfilStore();
  const [publicacion, setPublicacion] = useState<PublicacionPublica | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    obtenerPublicacionPublica(id)
      .then((p) => setPublicacion(p as PublicacionPublica | null))
      .catch((e) => console.warn('obtenerPublicacionPublica falló:', e))
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  const urlsFirmadas = useFotosFirmadas(publicacion?.fotos ?? []);

  const onReportar = () => {
    if (!session?.user.id || !publicacion) return;
    const usuarioId = session.user.id;
    const publicacionId = publicacion.id;
    const enviar = async (motivo: string) => {
      try {
        await reportarPublicacion(usuarioId, publicacionId, motivo);
        // El ocultamiento a los 3 reportes lo hace el trigger `al_reportar`
        // (migración 0012), y el dueño recibe una notificación. v3 prometía
        // esto y no había nada que lo hiciera.
        Alert.alert('Gracias', 'Reportamos esta publicación para revisión.');
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : '';
        Alert.alert(
          'No se pudo enviar el reporte',
          mensaje.includes('duplicate') || mensaje.includes('unique')
            ? 'Ya habías reportado esta publicación.'
            : 'Intenta de nuevo en un momento.'
        );
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
        <ThemedText style={styles.textoCentrado}>
          Esta publicación ya no está disponible. Pudo desactivarse o ocultarse tras varios reportes.
        </ThemedText>
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

  const atributos = [
    ETIQUETA_TIPO[publicacion.tipo] ?? publicacion.tipo,
    `${publicacion.recamaras} ${publicacion.recamaras === 1 ? 'recámara' : 'recámaras'}`,
    publicacion.amueblado ? 'Amueblado' : 'Sin amueblar',
    publicacion.permite_mascotas ? 'Acepta mascotas' : 'No acepta mascotas',
    ...(publicacion.servicios_incluidos ? ['Servicios incluidos'] : []),
  ];

  const scoreNumerico = score ? Number(score) : null;

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
          {publicacion.fotos.map((ruta) => {
            const url = urlsFirmadas.get(ruta);
            return url ? (
              <Image key={ruta} source={{ uri: url }} style={styles.foto} />
            ) : (
              <View key={ruta} style={[styles.foto, { backgroundColor: theme.backgroundSelected }]} />
            );
          })}
        </ScrollView>
      ) : (
        <View style={[styles.foto, styles.fotoAncha, { backgroundColor: theme.backgroundSelected }]} />
      )}

      <ThemedText type="title" style={styles.titulo}>
        {publicacion.titulo}
      </ThemedText>
      <ThemedText type="title" style={styles.precio}>
        {`$${formateadorPrecio.format(publicacion.precio_renta)}/mes`}
      </ThemedText>
      <ThemedText type="smallBold">{publicacion.direccion}</ThemedText>
      {distanciaKm !== null && (
        <ThemedText type="small" style={styles.distancia}>
          {distanciaKm.toFixed(1)} km de tu universidad
        </ThemedText>
      )}

      <View style={styles.atributos}>
        {atributos.map((a) => (
          <View key={a} style={[styles.pastilla, { borderColor: theme.border }]}>
            <ThemedText type="small">{a}</ThemedText>
          </View>
        ))}
      </View>

      {publicacion.descripcion && <ThemedText style={styles.descripcion}>{publicacion.descripcion}</ThemedText>}

      {tieneUbicacion && (
        <>
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
              title={publicacion.titulo}
            />
          </MapView>
          {/* Obligación de atribución de la licencia ODbL (§9, AUD-02). No es
              decorativa: es la condición bajo la que podemos guardar estas
              coordenadas en la base. */}
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {ATRIBUCION_MAPA}
          </ThemedText>
        </>
      )}

      <View style={{ marginTop: Spacing.three }}>
        <BotonVerContacto
          publicacionId={publicacion.id}
          titulo={publicacion.titulo}
          score={scoreNumerico != null && Number.isFinite(scoreNumerico) ? scoreNumerico : null}
          onRevelar={revelarContacto}
          onError={(mensaje) => Alert.alert('No se pudo abrir el contacto', mensaje)}
        />
      </View>

      {/* §28: esta app no verifica identidades. Decirlo es mejor ingeniería que
          fingir que el riesgo no existe. */}
      <ThemedText type="small" style={[styles.advertencia, { color: theme.textSecondary }]}>
        No adelantes dinero antes de visitar el lugar. Cuervo Pass no verifica la identidad de quien publica.
      </ThemedText>

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
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  textoCentrado: { textAlign: 'center', lineHeight: 22 },
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  carrusel: { borderRadius: Spacing.two },
  foto: { width: 340, height: 220, borderRadius: Spacing.two, marginRight: Spacing.two },
  fotoAncha: { width: '100%' },
  titulo: { fontSize: 22, lineHeight: 28, marginTop: Spacing.three },
  precio: { fontSize: 28, lineHeight: 34, marginTop: Spacing.one },
  distancia: { marginTop: Spacing.half },
  atributos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: Spacing.two },
  pastilla: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  descripcion: { marginTop: Spacing.two },
  mapa: { height: 240, borderRadius: Spacing.two, marginTop: Spacing.three, overflow: 'hidden' },
  advertencia: { marginTop: Spacing.two, lineHeight: 18 },
  reportarBoton: { marginTop: Spacing.three, padding: Spacing.three, minHeight: 44, justifyContent: 'center' },
  reportarTexto: { color: AppColors.destructiveRed, textAlign: 'center' },
});
