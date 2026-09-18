import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { TarjetaPublicacion } from '@/components/TarjetaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import {
  cambiarEstadoPublicacion,
  contarContactosRecibidos,
  listarMisPublicaciones,
  reintentarGeocodingPendiente,
} from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';

// Documento maestro v5 · §25 y §27.
export default function PublicacionesScreen() {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [contactos, setContactos] = useState<Map<string, number>>(new Map());
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!miId) return;
    setCargando(true);
    try {
      const [mias, recibidos] = await Promise.all([
        listarMisPublicaciones(miId),
        contarContactosRecibidos(),
      ]);
      setPublicaciones(mias);
      setContactos(recibidos);

      // §27: v3 prometía un reintento del geocoding "en segundo plano" y no
      // había nada que lo hiciera. Aquí sí: al abrir esta pantalla, las
      // publicaciones que se guardaron sin coordenadas se reintentan una vez.
      const resueltas = await reintentarGeocodingPendiente(mias);
      if (resueltas > 0) {
        setPublicaciones(await listarMisPublicaciones(miId));
      }
    } catch (e) {
      console.warn('No se pudieron cargar tus publicaciones:', e);
    } finally {
      setCargando(false);
    }
  }, [miId]);

  // Recarga cada vez que la pestaña vuelve a estar en foco (ej. tras publicar o editar).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const urlsFirmadas = useFotosFirmadas(publicaciones.map((p) => p.fotos?.[0]));

  const onCambiarEstado = (publicacion: Publicacion) => {
    const activar = !publicacion.activa;
    Alert.alert(
      activar ? 'Reactivar publicación' : 'Desactivar publicación',
      activar
        ? '¿Volver a mostrarla a otros usuarios?'
        : '¿Seguro que quieres desactivarla? Dejará de verse para otros usuarios (puedes reactivarla después).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: activar ? 'Reactivar' : 'Desactivar',
          style: activar ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await cambiarEstadoPublicacion(publicacion.id, activar);
            } catch (e) {
              // AUD-26: el límite de 15 activas por cuenta se aplica al
              // reactivar igual que al crear.
              Alert.alert(
                'No se pudo cambiar el estado',
                e instanceof Error && e.message.includes('límite')
                  ? 'Ya tienes 15 publicaciones activas. Desactiva alguna primero.'
                  : 'Intenta de nuevo en un momento.'
              );
            }
            cargar();
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Mis publicaciones</ThemedText>
      <Pressable
        onPress={() => router.push('/publicacion/nueva')}
        style={styles.nuevaBoton}
        accessibilityRole="button"
        accessibilityLabel="Nueva publicación"
      >
        <ThemedText style={styles.nuevaBotonTexto}>+ Nueva publicación</ThemedText>
      </Pressable>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const recibidos = contactos.get(item.id) ?? 0;
            return (
              <View style={styles.fila}>
                <View style={{ flex: 1 }}>
                  <TarjetaPublicacion
                    titulo={item.titulo}
                    precio={item.precio_renta}
                    direccion={item.direccion}
                    fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
                    onPress={() => router.push(`/publicacion/${item.id}`)}
                  />
                  <View style={styles.etiquetas}>
                    {!item.activa && (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Inactiva
                      </ThemedText>
                    )}
                    {/* AUD-16: el dueño se entera de por qué desapareció su
                        publicación, en vez de descubrirlo por su cuenta. */}
                    {item.oculta_por_reportes && (
                      <ThemedText type="small" style={{ color: AppColors.destructiveRed }}>
                        Oculta por reportes
                      </ThemedText>
                    )}
                    {item.pendiente_geocoding && (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Sin ubicación en el mapa — se reintenta al abrir esta pantalla
                      </ThemedText>
                    )}
                    {/* AUD-11: esta métrica ya no se infla sola con cada toque
                        repetido; `contactos` tiene índice único por par. */}
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {recibidos === 1 ? '1 persona pidió tu contacto' : `${recibidos} personas pidieron tu contacto`}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.acciones}>
                  <Pressable
                    onPress={() => router.push(`/publicacion/editar/${item.id}`)}
                    style={styles.accionBoton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${item.titulo}`}
                  >
                    <ThemedText style={styles.editarTexto}>Editar</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => onCambiarEstado(item)}
                    style={styles.accionBoton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={item.activa ? `Desactivar ${item.titulo}` : `Reactivar ${item.titulo}`}
                  >
                    <ThemedText style={item.activa ? styles.desactivarTexto : styles.reactivarTexto}>
                      {item.activa ? 'Desactivar' : 'Reactivar'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<ThemedText type="small">Aún no tienes publicaciones — crea la primera.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  nuevaBoton: { marginVertical: Spacing.three, padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
  nuevaBotonTexto: { color: AppColors.primary, fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  etiquetas: { marginLeft: Spacing.two, gap: Spacing.half },
  acciones: { alignItems: 'flex-end', gap: Spacing.half },
  accionBoton: { padding: Spacing.three, minHeight: 44, justifyContent: 'center' },
  editarTexto: { color: AppColors.primary },
  desactivarTexto: { color: AppColors.destructiveRed },
  reactivarTexto: { color: AppColors.successGreen },
});
