import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormularioPublicacion } from '@/components/FormularioPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { crearPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

export default function NuevaPublicacionScreen() {
  const session = useAuthStore((s) => s.session);

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Nueva publicación</ThemedText>
          <FormularioPublicacion
            textoBoton="Publicar"
            onGuardar={async (datos) => {
              if (!session?.user.id) return;
              const publicacion = await crearPublicacion({
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
  container: { padding: Spacing.four, paddingBottom: Spacing.six },
});
