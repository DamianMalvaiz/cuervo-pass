import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { FormularioPublicacion } from '@/components/FormularioPublicacion';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { crearPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

export default function NuevaPublicacionScreen() {
  const session = useAuthStore((s) => s.session);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Nueva publicación</ThemedText>
      <FormularioPublicacion
        textoBoton="Publicar"
        onGuardar={async (datos) => {
          if (!session?.user.id) return;
          const publicacion = await crearPublicacion({
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
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
});
