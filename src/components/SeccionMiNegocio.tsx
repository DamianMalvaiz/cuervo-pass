import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Sello } from '@/components/ficha/Sello';
import { TarjetaNegocio } from '@/components/TarjetaNegocio';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMisNegocios } from '@/hooks/queries/useMisNegocios';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * «Mi negocio» en la pestaña Publicar · Cuervo 360 (migración 0052). Para un comerciante aprobado: sus negocios, cada uno
 * con su estado (pausado, oculto por reportes) y el acceso a crear otro. Tres estados y no dos (END-11): cargando, falló y
 * «no tienes ninguno» se dicen distinto.
 */
export function SeccionMiNegocio() {
  const miId = useAuthStore((s) => s.session?.user.id);
  const { negocios, cargando, fallo, reintentar } = useMisNegocios(miId);
  const { urls } = useFotosFirmadas(negocios.map((n) => n.fotos[0]));

  return (
    <View style={estilos.seccion}>
      <ThemedText type="subtitle">Mi negocio</ThemedText>

      {cargando ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">
          Cargando tus negocios…
        </ThemedText>
      ) : fallo ? (
        <View style={estilos.seccion}>
          <ThemedText type="small" themeColor="textSecondary">
            No pudimos cargar tus negocios. Revisa tu conexión e intenta de nuevo.
          </ThemedText>
          <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">
            Reintentar
          </Sello>
        </View>
      ) : negocios.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Todavía no has publicado un negocio. Aparecerá en Servicios, con su menú y sus fotos.
        </ThemedText>
      ) : (
        negocios.map((n) => (
          <View key={n.id} style={estilos.negocio}>
            <TarjetaNegocio
              negocio={n}
              fotoUrl={n.fotos[0] ? urls.get(n.fotos[0]) : null}
              onPress={() => router.push({ pathname: '/negocio/editar/[id]', params: { id: n.id } })}
            />
            {!n.activo ? (
              <ThemedText type="small" themeColor="textSecondary">
                Pausado: no aparece en Servicios
              </ThemedText>
            ) : null}
            {n.oculto_por_reportes ? (
              <ThemedText type="small" themeColor="error">
                Oculto por reportes
              </ThemedText>
            ) : null}
          </View>
        ))
      )}

      <Sello variante="contorno" icono="add" onPress={() => router.push('/negocio/nuevo')} accessibilityLabel="Publicar un negocio nuevo">
        Nuevo negocio
      </Sello>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Spacing.two },
  negocio: { gap: Spacing.one },
});
