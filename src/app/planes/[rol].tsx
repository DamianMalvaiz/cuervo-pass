import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useContratarPlan, useMiSuscripcion, usePlanes } from '@/hooks/queries/usePlanes';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { describirSuscripcion, fechaLarga, incluyeDe, precioDe } from '@/lib/planes';
import { toast } from '@/lib/toast';
import { esRolVendedor, type RolVendedor } from '@/lib/verificacion';
import { useAuthStore } from '@/store/useAuthStore';
import type { PlanDePago } from '@/types/database.types';

/**
 * Planes y suscripciones · Cuervo 360 (migración 0053).
 *
 * Dice en qué plan está esta cuenta (prueba gratis, plan vigente o sin plan), qué incluye cada plan y permite contratarlo. Los
 * pagos son de DEMOSTRACIÓN y la pantalla lo dice siempre: no se cobra nada. Tres estados en cada lectura (END-11): cargando,
 * falló y vacío se pintan distinto.
 */
export default function PlanesScreen() {
  const theme = useTheme();
  const { rol: rolParam } = useLocalSearchParams<{ rol: string }>();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);

  const rolValido = esRolVendedor(rolParam);
  const rol = (rolValido ? rolParam : 'comerciante') as RolVendedor;
  const { suscripcion, cargando: cargandoSus, fallo: falloSus, reintentar: reintentarSus } = useMiSuscripcion(miId, rol);
  const { planes, cargando: cargandoPlanes, fallo: falloPlanes, reintentar: reintentarPlanes } = usePlanes(rol);
  const contratar = useContratarPlan(miId);

  const envoltura = (hijos: React.ReactNode) => (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>{hijos}</View>
      </ScrollView>
    </ThemedView>
  );

  if (!rolValido) return envoltura(<ThemedText themeColor="textSecondary">Esta pantalla no existe.</ThemedText>);

  if (cargandoSus || cargandoPlanes) {
    return envoltura(
      <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando…</ThemedText>
    );
  }

  if (falloSus || falloPlanes) {
    return envoltura(
      <>
        <ThemedText type="small" themeColor="textSecondary">
          No pudimos cargar tus planes. Revisa tu conexión e intenta de nuevo.
        </ThemedText>
        <Sello
          onPress={() => {
            reintentarSus();
            reintentarPlanes();
          }}
          icono="refresh"
          accessibilityLabel="Reintentar"
        >
          Reintentar
        </Sello>
      </>
    );
  }

  const titulo = rol === 'comerciante' ? 'Planes de comerciante' : 'Planes de arrendador';

  // Sin la función aprobada no hay plan que mostrar ni que contratar.
  if (!suscripcion) {
    return envoltura(
      <>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Primero agrega esta función y verifica tu identidad desde tu perfil, en «Tus funciones».
        </ThemedText>
      </>
    );
  }

  const pedir = (plan: PlanDePago) => {
    if (contratar.isPending) return;
    Alert.alert(
      `Contratar el plan ${plan.nombre}`,
      `Es un pago de DEMOSTRACIÓN: no se cobra nada. El plan queda vigente 30 días y cuesta ${precioDe(plan.precio_centavos)} al mes en la versión real.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Contratar',
          onPress: () =>
            contratar.mutate(
              { planId: plan.id, rol },
              {
                onSuccess: (hasta) => toast.exito(`Plan ${plan.nombre} activo hasta el ${fechaLarga(hasta)}`),
                onError: (err) =>
                  toast.error(
                    esCodigo(err, CP.DEMO_APAGADO)
                      ? 'Los pagos de demostración no están activos por ahora.'
                      : esCodigo(err, CP.PLAN_NO_DISPONIBLE)
                        ? 'Ese plan no está disponible para tu cuenta. Verifica tu identidad primero.'
                        : 'No pudimos contratar el plan. Revisa tu conexión e intenta de nuevo.'
                  ),
              }
            ),
        },
      ]
    );
  };

  return envoltura(
    <>
      <ThemedText type="subtitle">{titulo}</ThemedText>

      <View style={[estilos.aviso, { borderColor: theme.filete, backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name="information-circle-outline" size={20} color={theme.text} />
        <ThemedText type="small" style={estilos.crece}>
          Pagos de demostración: no se cobra nada. Sirven para probar cómo funcionan los planes.
        </ThemedText>
      </View>

      <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">Tu plan actual</ThemedText>
        <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{suscripcion.plan_nombre}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{describirSuscripcion(suscripcion)}</ThemedText>
        {incluyeDe(suscripcion, rol).map((f) => (
          <View key={f} style={estilos.fila}>
            <Ionicons name="checkmark-circle-outline" size={16} color={theme.bosque} />
            <ThemedText type="small">{f}</ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="subtitle">Elige un plan</ThemedText>
      {planes.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">Por ahora no hay planes de pago para esta función.</ThemedText>
      ) : (
        planes.map((p) => {
          const esElActual = suscripcion.estado === 'vigente' && suscripcion.plan_id === p.id;
          return (
            <View key={p.id} style={[estilos.tarjeta, { borderColor: esElActual ? theme.bosque : theme.filete, backgroundColor: theme.backgroundElement }]}>
              <View style={estilos.cabeceraPlan}>
                <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{p.nombre}</ThemedText>
                {esElActual ? (
                  <View style={[estilos.insignia, { backgroundColor: theme.lima }]}>
                    <ThemedText type="smallBold" style={{ color: theme.limaTexto }}>Tu plan</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText type="subtitle">{`${precioDe(p.precio_centavos)} al mes`}</ThemedText>
              {incluyeDe(p, rol).map((f) => (
                <View key={f} style={estilos.fila}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={theme.bosque} />
                  <ThemedText type="small">{f}</ThemedText>
                </View>
              ))}
              <Sello
                variante={esElActual ? 'contorno' : undefined}
                onPress={() => pedir(p)}
                cargando={contratar.isPending}
                accessibilityLabel={esElActual ? `Renovar el plan ${p.nombre}` : `Contratar el plan ${p.nombre}`}
              >
                {esElActual ? 'Renovar 30 días' : 'Contratar'}
              </Sello>
            </View>
          );
        })
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  crece: { flex: 1 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  tarjeta: { padding: Spacing.three, gap: Spacing.two, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cabeceraPlan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insignia: { borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.half },
});
