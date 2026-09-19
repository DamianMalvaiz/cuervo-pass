import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { FormularioPublicacion } from '@/components/FormularioPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { crearPublicacion } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

export default function NuevaPublicacionScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const session = useAuthStore((s) => s.session);

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, clase === 'amplia' && styles.centradoAmplio]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.columna, { maxWidth: anchoContenido }]}>
            <View style={styles.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                ALTA DE PUBLICACIÓN
              </ThemedText>
              <ThemedText type="title">Nueva publicación</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.explicacion}>
                La dirección se convierte en coordenadas para calcular distancias, y el título y la descripción alimentan la afinidad semántica.
              </ThemedText>
              <View style={[styles.filete, { backgroundColor: theme.text }]} />
            </View>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  membrete: { gap: Spacing.one, paddingTop: Spacing.two },
  explicacion: { lineHeight: 20 },
  filete: { height: Filete.grueso, marginTop: Spacing.two },
});
