import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { usePerfilVendedor } from '@/hooks/use-perfil-vendedor';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { tituloDeLoPropio, type PasoVerificacion } from '@/lib/panelVendedor';
import { describirSuscripcion } from '@/lib/planes';

import { EncabezadoPerfil } from './EncabezadoPerfil';
import { TarjetaIdentidad } from './TarjetaIdentidad';

/**
 * El perfil de un vendedor (0083): su tarjeta con el estado de la verificación y una lista corta que lleva a lo suyo. Nada de la ficha de búsqueda
 * de un estudiante (presupuesto, mascotas, ruido): un negocio no la necesita y verla sería pedirle datos que no le corresponden.
 */

/** La insignia dice el estado REAL de la verificación; sin funciones de vendedor no hay insignia (no se inventa una). */
export function insigniaDe(paso: PasoVerificacion | null): string | undefined {
  if (!paso) return undefined;
  // «Heredada» (0043) NO pasó por una revisión: una insignia que no se ganó, rotulada como ganada, es el defecto que la 0026 evitó con el correo.
  if (paso.tipo === 'listo' && paso.heredada) return 'Función heredada, sin revisión';
  return { empezar: 'Sin verificar', reenviar: 'Verificación rechazada', esperar: 'Identidad en revisión', listo: 'Identidad verificada' }[paso.tipo];
}

export const descripcionDe = (paso: PasoVerificacion | null): string => {
  if (!paso) return '';
  if (paso.tipo === 'listo' && paso.heredada) return 'Heredada: no pasó por una revisión.';
  return {
    empezar: 'Falta enviar tu INE y tus fotos.',
    reenviar: 'No pasó: revisa el motivo y vuelve a enviarla.',
    esperar: 'En revisión. Te avisamos al terminar.',
    listo: 'Verificada.',
  }[paso.tipo];
};

export function PerfilVendedor() {
  const margenSuperior = useMargenSuperior();
  const { anchoContenido, clase } = useTamanoPantalla();
  const { miId, perfil, errorPerfil, cargarPerfil, roles, falloRoles, reintentarRoles, paso, rolDeVerificacion, suscripcion, aEstudiante, cambiando } = usePerfilVendedor();

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, { paddingTop: margenSuperior }, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <EncabezadoPerfil />
          {!perfil && errorPerfil ? (
            // Falló la lectura y no hay nada que enseñar: se dice, no se pinta «Sin nombre». Con un perfil ya cargado se sigue viendo el perfil.
            <ErrorDeCarga etiqueta="No pudimos cargar tu perfil" onReintentar={() => miId && void cargarPerfil(miId)} />
          ) : (
            <TarjetaIdentidad insignia={falloRoles ? undefined : insigniaDe(paso)} />
          )}

          {falloRoles ? (
            // No se sabe en qué paso va: ni «Sin verificar» ni filas que suponen una función.
            <ErrorDeCarga etiqueta="No pudimos comprobar tu verificación" onReintentar={reintentarRoles} />
          ) : (
            <GrupoAjustes>
              <FilaAjuste
                icono="storefront-outline"
                etiqueta={tituloDeLoPropio(roles)}
                descripcion="Datos, fotos y lo que publicas."
                onPress={() => router.push('/(tabs)/publicar')}
              />
              <FilaAjuste
                icono="shield-checkmark-outline"
                etiqueta="Verificación de identidad"
                descripcion={descripcionDe(paso)}
                onPress={() => router.push({ pathname: '/verificacion/[rol]', params: { rol: rolDeVerificacion } })}
              />
              <FilaAjuste
                icono="card-outline"
                etiqueta="Mi plan y pagos"
                descripcion={suscripcion ? describirSuscripcion(suscripcion) : 'Consultando…'}
                onPress={() => router.push('/pagos')}
              />
              <FilaAjuste
                icono="eye-outline"
                etiqueta="Cómo me ven"
                descripcion="Lo que ve otra persona cuando entra a tu ficha."
                onPress={miId ? () => router.push({ pathname: '/perfil/[usuarioId]', params: { usuarioId: miId } }) : undefined}
              />
            </GrupoAjustes>
          )}

          <GrupoAjustes>
            <FilaAjuste
              icono="search-outline"
              etiqueta="Activar mi perfil de estudiante"
              descripcion="¿También buscas depa o roomie? Tu cuenta es la misma."
              onPress={cambiando ? undefined : aEstudiante}
            />
          </GrupoAjustes>
          <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
            Cambiar de perfil no borra nada de lo que tienes.
          </ThemedText>
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
  nota: { paddingHorizontal: Spacing.one },
});
