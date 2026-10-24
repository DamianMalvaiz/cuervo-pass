import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FileteHoja } from '@/components/ficha/CampoFicha';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { pasoDeVerificacion, tituloDeLoPropio, type PasoVerificacion } from '@/lib/panelVendedor';
import { describirSuscripcion } from '@/lib/planes';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

import { EncabezadoPerfil } from './EncabezadoPerfil';
import { TarjetaIdentidad } from './TarjetaIdentidad';

/**
 * El perfil de un vendedor (0083): su tarjeta con el estado de la verificación y una lista corta que lleva a lo suyo. Nada de la ficha de búsqueda
 * de un estudiante (presupuesto, mascotas, ruido): un negocio no la necesita y verla sería pedirle datos que no le corresponden.
 */

/** La insignia dice el estado REAL de la verificación; sin funciones de vendedor no hay insignia (no se inventa una). */
function insigniaDe(paso: PasoVerificacion | null): string | undefined {
  if (!paso) return undefined;
  // «Heredada» (0043) NO pasó por una revisión: una insignia que no se ganó, rotulada como ganada, es el defecto que la 0026 evitó con el correo.
  if (paso.tipo === 'listo' && paso.heredada) return 'Función heredada, sin revisión';
  return { empezar: 'Sin verificar', reenviar: 'Verificación rechazada', esperar: 'Identidad en revisión', listo: 'Identidad verificada' }[paso.tipo];
}

const descripcionDe = (paso: PasoVerificacion | null): string => {
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
  const theme = useTheme();
  const margenSuperior = useMargenSuperior();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { perfil } = usePerfilStore();
  const { roles } = useMisRoles(miId);
  const { cambiar } = usePerfilActivo(miId);
  const [cambiando, setCambiando] = useState(false);

  const paso = pasoDeVerificacion(roles);
  const primerRol = (roles.find((r) => r.rol === 'arrendador' || r.rol === 'comerciante')?.rol ?? 'arrendador') as 'arrendador' | 'comerciante';
  const rolDeVerificacion = paso?.rol ?? primerRol;
  const { suscripcion } = useMiSuscripcion(miId, primerRol);

  const aEstudiante = async () => {
    if (cambiando) return;
    setCambiando(true);
    try {
      await cambiar('estudiante');
      // Un vendedor no hizo el cuestionario de búsqueda: sin universidad, primero se llena.
      router.replace(perfil?.universidad ? '/(tabs)/inicio' : '/perfil/preferencias');
    } catch {
      toast.error('No pudimos cambiar de perfil. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCambiando(false);
    }
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, { paddingTop: margenSuperior }, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <EncabezadoPerfil />
          <TarjetaIdentidad insignia={insigniaDe(paso)} />

          <View style={[estilos.lista, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <FilaAjuste
              icono="storefront-outline"
              etiqueta={tituloDeLoPropio(roles)}
              descripcion="Datos, fotos y lo que publicas."
              onPress={() => router.push('/(tabs)/publicar')}
            />
            <FileteHoja />
            <FilaAjuste
              icono="shield-checkmark-outline"
              etiqueta="Verificación de identidad"
              descripcion={descripcionDe(paso)}
              onPress={() => router.push({ pathname: '/verificacion/[rol]', params: { rol: rolDeVerificacion } })}
            />
            <FileteHoja />
            <FilaAjuste
              icono="card-outline"
              etiqueta="Mi plan y pagos"
              descripcion={suscripcion ? describirSuscripcion(suscripcion) : 'Consultando…'}
              onPress={() => router.push('/pagos')}
            />
            <FileteHoja />
            <FilaAjuste
              icono="eye-outline"
              etiqueta="Cómo me ven"
              descripcion="Lo que ve otra persona cuando entra a tu ficha."
              onPress={miId ? () => router.push({ pathname: '/perfil/[usuarioId]', params: { usuarioId: miId } }) : undefined}
            />
          </View>

          <View style={[estilos.lista, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <FilaAjuste
              icono="search-outline"
              etiqueta="Activar mi perfil de estudiante"
              descripcion="¿También buscas depa o roomie? Tu cuenta es la misma."
              onPress={cambiando ? undefined : aEstudiante}
            />
          </View>
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
  lista: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  nota: { paddingHorizontal: Spacing.one },
});
