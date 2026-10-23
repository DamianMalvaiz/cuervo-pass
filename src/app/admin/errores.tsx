import { Redirect } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useBorrarError, useErroresAdmin, useEsAdmin } from '@/hooks/queries/useAdmin';
import { useTheme } from '@/hooks/use-theme';
import { ErrorAdmin, MENSAJE_ERROR_ADMIN } from '@/lib/admin';
import { toast } from '@/lib/toast';
import type { ErrorRegistrado } from '@/services/admin.service';

const cuando = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

function TarjetaError({ e }: { e: ErrorRegistrado }) {
  const theme = useTheme();
  const borrar = useBorrarError();

  const yaLoVi = () =>
    Alert.alert('Ya lo vi', 'Se quita de la lista. Si vuelve a pasar, aparecerá de nuevo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ya lo vi',
        onPress: () =>
          borrar.mutate(e.id, {
            onError: (err) => toast.error(MENSAJE_ERROR_ADMIN[err instanceof ErrorAdmin ? err.tipo : 'desconocido']),
          }),
      },
    ]);

  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <ThemedText type="etiqueta" style={{ color: e.nivel === 'error' ? theme.error : theme.textSecondary }}>
        {e.nivel === 'error' ? 'ERROR' : 'AVISO'}
      </ThemedText>
      <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{e.mensaje}</ThemedText>
      {e.detalle ? <ThemedText type="small" themeColor="textSecondary">{e.detalle}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {`${e.conteo} ${e.conteo === 1 ? 'vez' : 'veces'} · v${e.version_app} · ${e.plataforma}`}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {`Primera ${cuando(e.primera_vez)} · última ${cuando(e.ultima_vez)}`}
      </ThemedText>
      <Sello onPress={yaLoVi} cargando={borrar.isPending} variante="contorno" accessibilityLabel={`Ya lo vi: ${e.mensaje}`}>
        Ya lo vi
      </Sello>
    </View>
  );
}

/**
 * Los errores que registra la app (migración 0068), agrupados: un problema, cuántas veces, en qué versión. No lleva quién: el servidor no lo guarda.
 */
export default function AdminErroresScreen() {
  const { admin, cargando: cargandoRol, sinSesion } = useEsAdmin();
  const lista = useErroresAdmin(admin);

  if (sinSesion) return <Redirect href={{ pathname: '/(auth)/login', params: { volverA: '/admin/errores' } }} />;
  if (cargandoRol || (admin && lista.cargando)) {
    return (
      <ThemedView style={estilos.pantalla}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando…</ThemedText>
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
  if (lista.fallo || !lista.datos) {
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="No se pudo cargar" mensaje={MENSAJE_ERROR_ADMIN[lista.error?.tipo ?? 'desconocido']} icono="cloud-offline-outline" tono="alerta" />
        <Sello onPress={lista.reintentar} icono="refresh" accessibilityLabel="Reintentar">Reintentar</Sello>
      </ThemedView>
    );
  }
  if (lista.datos.length === 0) {
    return (
      <ThemedView style={estilos.pantalla}>
        <BloqueEstado etiqueta="Todo en orden" mensaje="Sin errores en la última semana." icono="checkmark-done-outline" />
      </ThemedView>
    );
  }
  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.lista} showsVerticalScrollIndicator={false}>
        {lista.datos.map((e) => (
          <TarjetaError key={e.id} e={e} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  lista: { gap: Spacing.three, paddingBottom: Spacing.six },
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.three, gap: Spacing.two },
});
