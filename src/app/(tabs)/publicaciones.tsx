import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { TarjetaPublicacion } from '@/components/TarjetaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { desactivarPublicacion, listarMisPublicaciones } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';

export default function PublicacionesScreen() {
  const session = useAuthStore((s) => s.session);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!session?.user.id) return;
    setCargando(true);
    try {
      setPublicaciones(await listarMisPublicaciones(session.user.id));
    } finally {
      setCargando(false);
    }
  }, [session?.user.id]);

  // Recarga cada vez que la pestaña vuelve a estar en foco (ej. tras publicar una nueva).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const onDesactivar = (publicacion: Publicacion) => {
    Alert.alert('Desactivar publicación', '¿Seguro que quieres desactivarla? Dejará de verse para otros usuarios.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desactivar',
        style: 'destructive',
        onPress: async () => {
          await desactivarPublicacion(publicacion.id);
          cargar();
        },
      },
    ]);
  };

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Mis publicaciones</ThemedText>
      <Pressable onPress={() => router.push('/publicacion/nueva')} style={styles.nuevaBoton}>
        <ThemedText style={styles.nuevaBotonTexto}>+ Nueva publicación</ThemedText>
      </Pressable>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.fila}>
              <View style={{ flex: 1 }}>
                <TarjetaPublicacion
                  precio={item.precio_renta}
                  direccion={item.direccion}
                  fotoUrl={item.fotos?.[0]}
                  onPress={() => router.push(`/publicacion/${item.id}`)}
                />
                {!item.activa && <ThemedText style={styles.inactivaEtiqueta}>Inactiva</ThemedText>}
              </View>
              {item.activa && (
                <Pressable onPress={() => onDesactivar(item)} style={styles.desactivarBoton}>
                  <ThemedText style={styles.desactivarTexto}>Desactivar</ThemedText>
                </Pressable>
              )}
            </View>
          )}
          ListEmptyComponent={<ThemedText type="small">Aún no tienes publicaciones — crea la primera.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  nuevaBoton: { marginVertical: Spacing.three },
  nuevaBotonTexto: { color: '#208AEF', fontWeight: '600' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  inactivaEtiqueta: { color: '#60646C', marginLeft: Spacing.two },
  desactivarBoton: { padding: Spacing.two },
  desactivarTexto: { color: '#d92d20' },
});
