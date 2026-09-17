import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { TarjetaPublicacion } from '@/components/TarjetaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cambiarEstadoPublicacion, listarMisPublicaciones } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';

export default function PublicacionesScreen() {
  const theme = useTheme();
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

  // Recarga cada vez que la pestaña vuelve a estar en foco (ej. tras publicar o editar).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

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
            await cambiarEstadoPublicacion(publicacion.id, activar);
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
          renderItem={({ item }) => (
            <View style={styles.fila}>
              <View style={{ flex: 1 }}>
                <TarjetaPublicacion
                  precio={item.precio_renta}
                  direccion={item.direccion}
                  fotoUrl={item.fotos?.[0]}
                  onPress={() => router.push(`/publicacion/${item.id}`)}
                />
                {!item.activa && (
                  <ThemedText style={[styles.inactivaEtiqueta, { color: theme.textSecondary }]}>Inactiva</ThemedText>
                )}
              </View>
              <View style={styles.acciones}>
                <Pressable
                  onPress={() => router.push(`/publicacion/editar/${item.id}`)}
                  style={styles.accionBoton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar publicación en ${item.direccion}`}
                >
                  <ThemedText style={styles.editarTexto}>Editar</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => onCambiarEstado(item)}
                  style={styles.accionBoton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.activa ? `Desactivar publicación en ${item.direccion}` : `Reactivar publicación en ${item.direccion}`
                  }
                >
                  <ThemedText style={item.activa ? styles.desactivarTexto : styles.reactivarTexto}>
                    {item.activa ? 'Desactivar' : 'Reactivar'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
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
  inactivaEtiqueta: { marginLeft: Spacing.two },
  acciones: { alignItems: 'flex-end', gap: Spacing.half },
  accionBoton: { padding: Spacing.three, minHeight: 44, justifyContent: 'center' },
  editarTexto: { color: AppColors.primary },
  desactivarTexto: { color: AppColors.destructiveRed },
  reactivarTexto: { color: AppColors.successGreen },
});
