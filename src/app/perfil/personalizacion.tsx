import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';

import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAsegurarMiPerfil } from '@/hooks/use-asegurar-perfil';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { construirTextoPerfil } from '@/lib/perfilTexto';
import { avisoVector, campoVector, resolverPerfilVector } from '@/lib/perfilVector';
import { aviso } from '@/lib/registro';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import { EnMarcoWeb } from '@/components/web/EnMarcoWeb';
import { TituloPaginaWeb } from '@/components/web/TituloPaginaWeb';
import { medidasWeb } from '@/lib/medidasWeb';

/**
 * «Personalización»: el consentimiento a que se use tu descripción para ordenar lo que ves (antes «Sugerencias con IA», una fila de Privacidad que llevaba
 * a todo el formulario de preferencias). Las condiciones de cómo se ordena viven en los Términos; aquí está el interruptor y lo que significa.
 *
 * No es un booleano suelto, y por eso reutiliza la lógica de `lib/perfilVector` en vez de reinventarla:
 *  · APAGAR retira el consentimiento Y borra el vector: si no, un texto que la persona dijo que no quiere analizado seguiría ordenándolo todo.
 *  · ENCENDER recalcula el vector con el texto de la ficha.
 *  · Si el servicio de análisis falla al recalcular, NO se borra el vector anterior («no pudimos» no es «bórralo») y se dice que quedó atrás.
 */
export default function PersonalizacionScreen() {
  return (
    <EnMarcoWeb>
      <PersonalizacionScreenPantalla />
    </EnMarcoWeb>
  );
}

function PersonalizacionScreenPantalla() {
  useAsegurarMiPerfil();
  const theme = useTheme();
  const { anchoContenido, clase, ancho } = useTamanoPantalla();
  // En la web ancha, dos columnas a todo el ancho del sitio (como Mi perfil), no la columna de teléfono.
  const ancha = Platform.OS === 'web' && medidasWeb(ancho).escritorio;
  const session = useAuthStore((s) => s.session);
  const { perfil, actualizarPerfil } = usePerfilStore();
  // Lo que se pinta mientras se guarda; vuelve al valor real si el guardado falla.
  const [pendiente, setPendiente] = useState<boolean | null>(null);
  const enCurso = useRef(false);

  const activa = pendiente ?? Boolean(perfil?.consiente_analisis_ia);

  const cambiar = async (consiente: boolean) => {
    if (!session?.user.id || enCurso.current) return;
    enCurso.current = true;
    setPendiente(consiente);
    try {
      const teniaVector = Boolean(perfil?.perfil_vector);
      const resultado = await resolverPerfilVector(
        consiente,
        construirTextoPerfil({
          universidad: perfil?.universidad,
          presupuestoMin: perfil?.presupuesto_min,
          presupuestoMax: perfil?.presupuesto_max,
          mascotas: Boolean(perfil?.mascotas),
          fuma: Boolean(perfil?.fuma),
          nivelRuido: perfil?.nivel_ruido,
          textoLibre: perfil?.perfil_texto ?? undefined,
        })
      );
      await actualizarPerfil(session.user.id, { consiente_analisis_ia: consiente, ...campoVector(resultado) });
      const salvedad = avisoVector(resultado, teniaVector);
      if (salvedad) toast.info(`${salvedad.titulo}. ${salvedad.cuerpo}`);
    } catch (e) {
      aviso('No se pudo guardar el consentimiento de personalización', undefined, e);
      toast.error('No pudimos guardar el cambio. Revisa tu conexión e intenta de nuevo.');
    } finally {
      enCurso.current = false;
      setPendiente(null);
    }
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio, ancha && estilos.anchoWeb]} showsVerticalScrollIndicator={false}>
        <View style={[estilos.columna, ancha ? estilos.rejilla : { maxWidth: anchoContenido }]}>
          <TituloPaginaWeb>Personalización</TituloPaginaWeb>
          <View style={ancha ? estilos.mitad : estilos.apilada}>
          <ThemedText type="small" themeColor="textSecondary">
            Cómo ordenamos lo que ves, y qué parte de tu perfil usamos para hacerlo.
          </ThemedText>

          <GrupoAjustes>
            <FilaAjuste
              icono="sparkles-outline"
              etiqueta="Usar mi descripción"
              descripcion="Ordena mejor los roomies y los depas que ves."
              valor={activa}
              onCambiar={cambiar}
            />
          </GrupoAjustes>

          </View>

          <View style={ancha ? estilos.mitad : estilos.apilada}>
          <ThemedText type="etiqueta" themeColor="textSecondary">QUÉ USAMOS</ThemedText>
          <View style={estilos.lista}>
            <View style={estilos.fila}>
              <Ionicons name="checkmark" size={18} color={theme.acento} />
              <ThemedText type="small" style={estilos.crece}>El texto libre que escribes sobre ti.</ThemedText>
            </View>
            <View style={estilos.fila}>
              <Ionicons name="checkmark" size={18} color={theme.acento} />
              <ThemedText type="small" style={estilos.crece}>
                Un proveedor externo de IA (Anthropic) puede leer ese texto para entender tus preferencias. Con él calculamos un perfil numérico que se borra si apagas esto.
              </ThemedText>
            </View>
          </View>

          <ThemedText type="etiqueta" themeColor="textSecondary">QUÉ NO USAMOS</ThemedText>
          <View style={estilos.lista}>
            <View style={estilos.fila}>
              <Ionicons name="close" size={18} color={theme.error} />
              <ThemedText type="small" style={estilos.crece}>Tu INE, tus fotos ni tus mensajes.</ThemedText>
            </View>
            <View style={estilos.fila}>
              <Ionicons name="close" size={18} color={theme.error} />
              <ThemedText type="small" style={estilos.crece}>Nada de esto se usa para publicidad.</ThemedText>
            </View>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            Si la apagas, la app sigue funcionando: ordena con tus filtros (presupuesto, distancia y universidad).
          </ThemedText>

          <Pulsable
            onPress={() => router.push('/aviso-privacidad')}
            accessibilityRole="link"
            accessibilityLabel="Leer el aviso de privacidad"
            style={estilos.enlace}
          >
            <ThemedText type="small" themeColor="acento">Leer el aviso de privacidad</ThemedText>
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
  columna: { width: '100%', gap: Spacing.three },
  apilada: { gap: Spacing.three },
  anchoWeb: { paddingHorizontal: Spacing.five },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  mitad: { flexBasis: 440, flexGrow: 1, flexShrink: 1, maxWidth: '100%', gap: Spacing.three },
  lista: { gap: Spacing.two },
  fila: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  crece: { flex: 1 },
  enlace: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
