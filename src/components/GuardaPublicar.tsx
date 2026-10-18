import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Sello } from '@/components/ficha/Sello';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { puedePublicar } from '@/lib/funciones';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Guarda de «Publicar» · Cuervo 360. Solo con una función de vendedor APROBADA.
 *
 * La pestaña se oculta, pero una ruta oculta sigue siendo alcanzable por un enlace directo o por
 * una fila de otra pantalla, así que la propia pantalla se guarda. Los cuatro estados son
 * distintos (END-11): comprobando, falló la lectura, falta la función, y puede. En los tres
 * primeros NO se muestra el contenido: ante la duda se cierra el paso, no se abre.
 *
 * Es una guarda de INTERFAZ. La regla que de verdad impide publicar tiene que vivir en la base
 * (invariante 6), y llega con la verificación de vendedor.
 */
export function GuardaPublicar({ children }: { children: ReactNode }) {
  const miId = useAuthStore((s) => s.session?.user.id);
  const margenSuperior = useMargenSuperior();
  const { roles, cargando, fallo, reintentar } = useMisRoles(miId);

  // Comprobando: ni el contenido ni una afirmación de que falte la función.
  if (cargando) return <ThemedView style={estilos.pantalla} />;

  if (fallo) {
    return (
      <ThemedView style={[estilos.pantalla, { paddingTop: margenSuperior }]}>
        <BloqueEstado
          tono="alerta"
          icono="cloud-offline-outline"
          etiqueta="No pudimos comprobar tu función"
          mensaje="Revisa tu conexión e intenta de nuevo."
        />
        <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </ThemedView>
    );
  }

  if (!puedePublicar(roles)) {
    return (
      <ThemedView style={[estilos.pantalla, { paddingTop: margenSuperior }]}>
        <BloqueEstado
          icono="lock-closed-outline"
          etiqueta="Función requerida"
          mensaje="Para publicar necesitas la función de arrendador o comerciante aprobada. Agrégala en Mi perfil; quedará sin verificar hasta que se revise."
        />
        <Sello onPress={() => router.push('/(tabs)/perfil')} accessibilityLabel="Ir a Mis funciones">
          Ir a Mis funciones
        </Sello>
      </ThemedView>
    );
  }

  return <>{children}</>;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, padding: Spacing.three, gap: Spacing.three },
});
