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
import { pasoDeVerificacion } from '@/lib/panelVendedor';
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
    // Tiene una función de vendedor pero la verificación no está hecha: se dice en qué paso va y se le lleva a él. Sin verificar NO se publica.
    const paso = pasoDeVerificacion(roles);
    if (paso && paso.tipo !== 'listo') {
      const alVerificar = () => router.push({ pathname: '/verificacion/[rol]', params: { rol: paso.rol } });
      return (
        <ThemedView style={[estilos.pantalla, { paddingTop: margenSuperior }]}>
          {paso.tipo === 'esperar' ? (
            <BloqueEstado
              icono="time-outline"
              etiqueta="Tu verificación está en revisión"
              mensaje="Cuando termine la revisión podrás publicar. Mientras tanto, lo tuyo no aparece para los estudiantes."
            />
          ) : (
            <>
              <BloqueEstado
                icono="shield-checkmark-outline"
                etiqueta={paso.tipo === 'reenviar' ? 'Tu verificación no pasó' : 'Verifica tu identidad para publicar'}
                mensaje={
                  paso.tipo === 'reenviar'
                    ? 'Revisa el motivo y vuelve a enviarla. Sin verificar no se puede publicar.'
                    : 'Necesitamos tu INE y unas fotos. Solo las ve el equipo que verifica. Sin verificar no se puede publicar.'
                }
              />
              <Sello
                onPress={alVerificar}
                accessibilityLabel={paso.tipo === 'reenviar' ? 'Volver a enviar mi verificación' : 'Verificar mi identidad'}
              >
                {paso.tipo === 'reenviar' ? 'Volver a enviar' : 'Verificar mi identidad'}
              </Sello>
            </>
          )}
        </ThemedView>
      );
    }
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
