import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GrupoMiPlan } from '@/components/GrupoMiPlan';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { irAlLogin } from '@/lib/navegacion';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Configuración · Cuervo 360 (diseño D1 del 24/10/2026).
 *
 * Tres grupos con título en frase normal —Cuenta, Privacidad y datos, Sesión— y «Mi plan» arriba. Cambió respecto a la versión del 17/10:
 *  · «Eliminar mi cuenta» dejó de ser un bloque rojo dentro de esta pantalla (el elemento MÁS grande de ella) y es una fila sobria que lleva a su propia
 *    pantalla, donde se dice qué se pierde y se pide la contraseña (§29, CANCELACIÓN).
 *  · «Sugerencias con IA» pasó a «Personalización», con su propia pantalla; las condiciones de cómo se ordena lo que ves viven en los Términos.
 *  · «Descargar mis datos» se fue: un JSON compartido a ciegas no le sirve a nadie. El derecho de ACCESO sigue vigente y se ejerce con el correo del aviso
 *    de privacidad (§29).
 *  · Nueva: «Cambiar contraseña», dentro de la app (antes solo existía «Olvidé mi contraseña»).
 */
export default function ConfiguracionScreen() {
  const { anchoContenido, clase } = useTamanoPantalla();
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const { perfil } = usePerfilStore();

  const onCerrarSesion = async () => {
    await cerrarSesion();
    irAlLogin();
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <GrupoMiPlan />

          <GrupoAjustes titulo="Cuenta">
            <FilaAjuste
              icono="lock-closed-outline"
              etiqueta="Cambiar contraseña"
              descripcion="Usa una que no uses en otro sitio."
              onPress={() => router.push('/cambiar-contrasena')}
            />
          </GrupoAjustes>

          <GrupoAjustes titulo="Privacidad y datos">
            <FilaAjuste
              icono="document-text-outline"
              etiqueta="Aviso de privacidad"
              descripcion="Qué datos guardamos, para qué, y cómo ejercer tus derechos."
              onPress={() => router.push('/aviso-privacidad')}
            />
            <FilaAjuste
              icono="reader-outline"
              etiqueta="Términos y condiciones"
              descripcion="Las reglas de Cuervo 360."
              onPress={() => router.push('/terminos')}
            />
            <FilaAjuste
              icono="sparkles-outline"
              etiqueta="Personalización"
              descripcion="Usar tu descripción para ordenar lo que ves."
              detalle={perfil?.consiente_analisis_ia ? 'Activada' : 'Desactivada'}
              onPress={() => router.push('/perfil/personalizacion')}
            />
          </GrupoAjustes>

          <GrupoAjustes titulo="Sesión">
            <FilaAjuste icono="log-out-outline" etiqueta="Cerrar sesión" descripcion="Tus datos y tus publicaciones se quedan como están." onPress={onCerrarSesion} />
            <FilaAjuste
              icono="trash-outline"
              etiqueta="Eliminar mi cuenta"
              descripcion="Se borra todo y no se puede deshacer."
              destructiva
              onPress={() => router.push('/eliminar-cuenta')}
            />
          </GrupoAjustes>
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
});
