import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioPublicacion } from '@/components/FormularioPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { actualizarPublicacion, obtenerMiPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';

export default function EditarPublicacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const [publicacion, setPublicacion] = useState<Publicacion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    // `obtenerMiPublicacion` lee la TABLA, no la vista pública: la vista no trae
    // `whatsapp`, y aquí hace falta para poder editarlo. La policy
    // publicaciones_select_propias garantiza que solo funcione con las propias.
    obtenerMiPublicacion(id)
      .then(setPublicacion)
      .catch((e) => console.warn('obtenerMiPublicacion falló:', e))
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
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Editar publicación</ThemedText>
          <FormularioPublicacion
            textoBoton="Guardar cambios"
            valoresIniciales={{
              titulo: publicacion.titulo,
              tipo: publicacion.tipo,
              direccion: publicacion.direccion,
              precioRenta: String(publicacion.precio_renta),
              descripcion: publicacion.descripcion ?? '',
              permiteMascotas: publicacion.permite_mascotas,
              amueblado: publicacion.amueblado,
              serviciosIncluidos: publicacion.servicios_incluidos,
              recamaras: String(publicacion.recamaras),
              whatsapp: publicacion.whatsapp,
            }}
            fotosIniciales={publicacion.fotos ?? []}
            onGuardar={async (datos) => {
              if (!session?.user.id) return;
              await actualizarPublicacion(publicacion.id, {
                usuarioId: session.user.id,
                titulo: datos.titulo,
                tipo: datos.tipo,
                direccion: datos.direccion,
                precioRenta: Number(datos.precioRenta),
                descripcion: datos.descripcion,
                permiteMascotas: datos.permiteMascotas,
                amueblado: datos.amueblado,
                serviciosIncluidos: datos.serviciosIncluidos,
                recamaras: Number(datos.recamaras),
                whatsapp: datos.whatsapp,
                fotos: datos.fotos,
              });
              router.replace(`/publicacion/${publicacion.id}`);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
});
