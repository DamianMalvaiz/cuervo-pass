import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  FormularioPublicacion,
  type ControlPublicacion,
} from '@/components/FormularioPublicacion';
import { PieFijo } from '@/components/ficha/PieFijo';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Spacing } from '@/constants/theme';
import { useDesplazador } from '@/hooks/use-desplazador';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { crearPublicacion } from '@/services/publicaciones.service';
import { sello } from '@/lib/tacto';
import { toast } from '@/lib/toast';
import { GuardaPublicar } from '@/components/GuardaPublicar';
import { useAuthStore } from '@/store/useAuthStore';

function NuevaPublicacion() {
  const formulario = useRef<ControlPublicacion>(null);
  const [guardando, setGuardando] = useState(false);
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  // Scroll al primer error: el ScrollView es de ESTA pantalla y el formulario no
  // puede moverlo. Con un pie fijo y un formulario largo, un error puede quedar a
  // varias pantallas de donde se tocó el botón.
  const { registrarScroll, onScroll, desplazador } = useDesplazador();
  const session = useAuthStore((s) => s.session);

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={registrarScroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
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
              ref={formulario}
              botonEnPie
              onEstadoEnvio={setGuardando}
              desplazador={desplazador}
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
              // Después del insert y antes de navegar: la publicación ya
              // existe, con su id. Es lo mismo que el sello del contacto —algo
              // quedó registrado— y por eso es la misma vibración.
              sello();
              // La vibración confirma al tacto; el aviso, a la vista y al lector
              // de pantalla. Sigue en pantalla ya en la ficha: el host es del
              // layout raíz.
              toast.exito('Publicación creada');
              router.replace(`/publicacion/${publicacion.id}`);
            }}
          />
          </View>
        </ScrollView>

        {/* Dieciséis campos: el botón al final obligaba a deslizar hasta abajo
            para confirmar, y mientras editabas un campo de en medio no había
            ninguna pista de que existiera una acción pendiente. */}
        <PieFijo>
          <Sello
            onPress={() => formulario.current?.enviar()}
            cargando={guardando}
            accessibilityLabel="Publicar"
          >
            Publicar
          </Sello>
        </PieFijo>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** Crear una publicación exige una función de vendedor aprobada (ver GuardaPublicar). */
export default function NuevaPublicacionScreen() {
  return (
    <GuardaPublicar>
      <NuevaPublicacion />
    </GuardaPublicar>
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
