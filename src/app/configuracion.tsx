import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';

import { GrupoMiPlan } from '@/components/GrupoMiPlan';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { eliminarMiCuenta, exportarMisDatos } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Configuración · Cuervo 360.
 *
 * Lo que antes iba al fondo de Mi perfil (privacidad, derechos sobre tus datos, salir y eliminar la cuenta)
 * vive ahora en su propia pantalla, a la que se llega con el engranaje de Perfil. Es la forma de la propuesta
 * visual del 17/10/2026: grupos con título en frase normal, tarjetas redondeadas y un dato corto a la derecha.
 *
 * Los manejadores son los mismos de siempre (§29, derechos ARCO); lo único que cambió es dónde viven.
 */
export default function ConfiguracionScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const { perfil } = usePerfilStore();
  const [exportando, setExportando] = useState(false);

  // ACCESO (§29). Se comparte como texto en vez de escribir un archivo: la app no tiene todavía una dependencia
  // de sistema de archivos, y el volumen de datos de un usuario cabe de sobra.
  const onDescargarMisDatos = async () => {
    setExportando(true);
    try {
      const datos = await exportarMisDatos();
      await Share.share({
        title: 'Mis datos en Cuervo 360',
        message: JSON.stringify(datos, null, 2),
      });
    } catch (e) {
      Alert.alert('No se pudieron exportar tus datos', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  };

  // CANCELACIÓN (§29). Irreversible y en cascada: por eso se confirma y se dice exactamente qué desaparece.
  const onEliminarCuenta = () => {
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borran tu perfil, tus publicaciones, tus fotos y tus mensajes. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarMiCuenta();
              router.replace('/(auth)/login');
            } catch (e) {
              Alert.alert('No se pudo eliminar la cuenta', e instanceof Error ? e.message : 'Intenta de nuevo.');
            }
          },
        },
      ]
    );
  };

  const onCerrarSesion = async () => {
    await cerrarSesion();
    router.replace('/(auth)/login');
  };

  const ia = perfil?.consiente_analisis_ia ? 'Activadas' : 'Desactivadas';

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <GrupoMiPlan />

          <GrupoAjustes titulo="Privacidad">
            <FilaAjuste
              icono="sparkles-outline"
              etiqueta="Sugerencias con IA"
              descripcion="Usar tu descripción para ordenar mejor lo que ves."
              detalle={ia}
              onPress={() => router.push('/perfil/preferencias')}
            />
            <FilaAjuste
              icono="document-text-outline"
              etiqueta="Aviso de privacidad"
              descripcion="Qué datos guardamos, para qué, y cómo pedir que los borremos."
              onPress={() => router.push('/aviso-privacidad')}
            />
            <FilaAjuste
              icono="download-outline"
              etiqueta="Descargar mis datos"
              descripcion={
                exportando ? 'Preparando el archivo…' : 'Una copia en JSON de todo lo que guardamos sobre ti.'
              }
              onPress={exportando ? undefined : onDescargarMisDatos}
            />
          </GrupoAjustes>

          <GrupoAjustes titulo="Sesión">
            <FilaAjuste
              icono="log-out-outline"
              etiqueta="Cerrar sesión"
              descripcion="Tus datos y tus publicaciones se quedan como están."
              onPress={onCerrarSesion}
            />
          </GrupoAjustes>

          {/* Lo irreversible se ve irreversible, y lo rutinario es un renglón más. */}
          <View style={[estilos.zonaRiesgo, { borderColor: theme.error, backgroundColor: theme.backgroundElement }]}>
            <View style={estilos.filaRiesgo}>
              <Ionicons name="warning-outline" size={18} color={theme.error} />
              <ThemedText type="smallBold" style={{ color: theme.error }}>
                Eliminar la cuenta
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={estilos.textoRiesgo}>
              Se borran tu perfil, tus publicaciones, tus fotografías y tus mensajes. Es irreversible y no
              conservamos copia.
            </ThemedText>
            <Pulsable
              onPress={onEliminarCuenta}
              style={[estilos.botonPeligro, { backgroundColor: theme.error }]}
              accessibilityRole="button"
              accessibilityLabel="Eliminar mi cuenta"
            >
              <ThemedText style={[estilos.textoPeligro, { color: theme.errorTexto }]}>Eliminar mi cuenta</ThemedText>
            </Pulsable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  zonaRiesgo: {
    borderWidth: Filete.fino,
    borderRadius: Radios.tarjeta,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  filaRiesgo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  textoRiesgo: { lineHeight: 20 },
  botonPeligro: {
    minHeight: 48,
    borderRadius: Radios.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  textoPeligro: Texto.sello,
});
