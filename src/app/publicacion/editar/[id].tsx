import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { FormularioPublicacion } from '@/components/FormularioPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { actualizarPublicacion, obtenerPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';

export default function EditarPublicacionScreen() {
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
      <ThemedText type="title">Editar publicación</ThemedText>
      <FormularioPublicacion
        textoBoton="Guardar cambios"
        valoresIniciales={{
          direccion: publicacion.direccion,
          precioRenta: String(publicacion.precio_renta),
          descripcion: publicacion.descripcion ?? '',
          whatsapp: publicacion.whatsapp,
        }}
        fotosIniciales={publicacion.fotos ?? []}
        onGuardar={async (datos) => {
          if (!session?.user.id) return;
          await actualizarPublicacion(publicacion.id, {
            usuarioId: session.user.id,
            direccion: datos.direccion,
            precioRenta: Number(datos.precioRenta),
            descripcion: datos.descripcion,
            whatsapp: datos.whatsapp,
            fotos: datos.fotos,
          });
          router.replace(`/publicacion/${publicacion.id}`);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
});
