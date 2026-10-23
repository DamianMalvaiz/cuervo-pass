import { Redirect, router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useEsAdmin, useModoDemo, useResumenAdmin } from '@/hooks/queries/useAdmin';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN } from '@/lib/admin';
import { toast } from '@/lib/toast';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Panel de administración · inicio. Solo se muestra a un admin APROBADO, pero eso es comodidad: el 403 de la Edge Function es lo que
 * de verdad decide. Si el servidor dice que no, se dice, aunque la pantalla creyera que sí.
 */
export default function AdminInicioScreen() {
  const { admin, cargando: cargandoRoles, sinSesion } = useEsAdmin();
  const resumen = useResumenAdmin(admin);
  const modoDemo = useModoDemo();

  if (sinSesion) return <Redirect href={{ pathname: '/(auth)/login', params: { volverA: '/admin' } }} />;

  if (cargandoRoles) {
    return (
      <ThemedView style={estilos.pantalla}>
        <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }

  if (!admin) {
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="Sin acceso" mensaje="No tienes acceso al panel de administración." icono="lock-closed-outline" />
      </ThemedView>
    );
  }

  if (resumen.cargando) {
    return (
      <ThemedView style={estilos.pantalla}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando…</ThemedText>
      </ThemedView>
    );
  }

  // Un fallo NUNCA se pinta como cifras en cero.
  if (resumen.fallo || !resumen.datos) {
    const tipo = resumen.error?.tipo ?? 'desconocido';
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="No se pudo cargar" mensaje={MENSAJE_ERROR_ADMIN[tipo]} icono="cloud-offline-outline" tono="alerta" />
        <Sello onPress={resumen.reintentar} icono="refresh" accessibilityLabel="Reintentar">Reintentar</Sello>
      </ThemedView>
    );
  }

  const r = resumen.datos;

  const cambiarModoDemo = (activar: boolean) => {
    Alert.alert(
      activar ? 'Encender el modo de demostración' : 'Apagar el modo de demostración',
      activar
        ? 'Los pagos de TODAS las cuentas serán simulados: no se procesa ninguna tarjeta. Enciéndelo solo durante una demostración.'
        : 'Los pagos simulados dejarán de funcionar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: activar ? 'Encender' : 'Apagar',
          onPress: () =>
            modoDemo.mutate(activar, {
              onError: (e) => toast.error(MENSAJE_ERROR_ADMIN[e instanceof ErrorAdmin ? e.tipo : 'desconocido']),
            }),
        },
      ],
    );
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.desplazable} showsVerticalScrollIndicator={false}>
        <ThemedText type="subtitle">Panel de administración</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {plural(r.cuentas, 'cuenta', 'cuentas')} · {plural(r.negocios_activos, 'negocio activo', 'negocios activos')}
        </ThemedText>

        <GrupoAjustes titulo="Para revisar">
          <FilaAjuste
            icono="shield-checkmark-outline"
            etiqueta="Verificaciones"
            descripcion="Documentos de quienes quieren vender. Aprobar o rechazar."
            detalle={plural(r.verificaciones_pendientes, 'pendiente', 'pendientes')}
            onPress={() => router.push('/admin/verificaciones')}
          />
          <FilaAjuste
            icono="flag-outline"
            etiqueta="Moderación"
            descripcion={`${plural(r.resenas_reportadas, 'reseña reportada', 'reseñas reportadas')} · ${plural(r.resenas_ocultas, 'oculta', 'ocultas')} · ${plural(r.negocios_ocultos, 'negocio oculto', 'negocios ocultos')}`}
            onPress={() => router.push('/admin/moderacion')}
          />
        </GrupoAjustes>

        <GrupoAjustes titulo="Salud de la app">
          <FilaAjuste
            icono="bug-outline"
            etiqueta="Errores de la app"
            descripcion="Lo que se rompe en los teléfonos, agrupado, sin datos de quién."
            onPress={() => router.push('/admin/errores')}
          />
        </GrupoAjustes>

        <GrupoAjustes titulo="Demostración">
          <FilaAjuste
            icono="play-circle-outline"
            etiqueta="Modo de demostración"
            descripcion="Enciende los pagos simulados. Apagado es lo normal."
            valor={r.modo_demo}
            onCambiar={cambiarModoDemo}
          />
        </GrupoAjustes>
        <View />
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  desplazable: { gap: Spacing.three, paddingBottom: Spacing.six },
});
