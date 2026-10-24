import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useCrearPago, useIniciarPrueba, useMiSuscripcion, useMiUltimaOrden, usePlanes, useRefrescarTrasPago } from '@/hooks/queries/usePlanes';
import { useAlVolverAPrimerPlano } from '@/hooks/use-al-volver';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { ErrorPago, describirOrden, mensajeDeErrorPago, textoConfirmarPago } from '@/lib/pagoMp';
import { describirSuscripcion, fechaLarga, incluyeDe, precioDe, textoDePrueba } from '@/lib/planes';
import { toast } from '@/lib/toast';
import { esRolVendedor, type RolVendedor } from '@/lib/verificacion';
import { useAuthStore } from '@/store/useAuthStore';
import type { PlanDePago } from '@/types/database.types';

/**
 * Planes y suscripciones · Cuervo 360 (migraciones 0053 y 0084).
 *
 * Tres vistas, según lo que la base dice de esta cuenta (END-11: cargando, falló y vacío se pintan distinto):
 *  · sin la función → «Primero crea tu perfil de vendedor».
 *  · prueba disponible (no la ha usado ni ha pagado) → «Empieza gratis»: UNA tarjeta y UN botón, «Empezar prueba gratis». Sin alertas y sin la palabra
 *    «demostración»; es gratis y no compromete nada.
 *  · lo demás → los planes de pago, que se pagan con Mercado Pago (abre su página; el plan se activa cuando llega el aviso del pago, fuera de la app).
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
  const iniciar = useIniciarPrueba(miId);
  const crear = useCrearPago();
  const { orden, fallo: falloOrden, refrescar: refrescarOrden } = useMiUltimaOrden(miId, rol);
  const refrescarTodo = useRefrescarTrasPago(miId, rol);

  // El pago se confirma FUERA de la app: al volver de Mercado Pago hay que pedir otra vez el plan, los pagos y la orden.
  useAlVolverAPrimerPlano(refrescarTodo);

  // Y si la orden pasa de «esperando» a «pagada» mientras la pantalla está abierta, el plan cambió. Solo en la transición: una orden que ya estaba
  // pagada al abrir no es una novedad.
  const estadoPrevio = useRef<string | undefined>(undefined);
  useEffect(() => {
    const ahora = orden?.estado;
    if (ahora === 'pagada' && (estadoPrevio.current === 'creada' || estadoPrevio.current === 'pendiente')) refrescarTodo();
    estadoPrevio.current = ahora;
  }, [orden?.estado, refrescarTodo]);

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

  // Sin la función no hay plan que mostrar ni que contratar.
  if (!suscripcion) {
    return envoltura(
      <>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Primero crea tu perfil de vendedor. Verificar tu identidad viene después, y puedes empezar tu prueba gratis antes.
        </ThemedText>
        <Sello onPress={() => router.push('/perfil/crear-vendedor')} accessibilityLabel="Crear mi perfil de vendedor">
          Crear mi perfil de vendedor
        </Sello>
      </>
    );
  }

  // Es GRATIS y no compromete nada: sin alerta de confirmación. El fallo se dice por su código (END-27) y ninguno se cuenta como éxito.
  const empezarPrueba = () => {
    if (iniciar.isPending) return;
    iniciar.mutate(rol, {
      onSuccess: (hasta) => toast.exito(`Prueba gratis activa hasta el ${fechaLarga(hasta)}`),
      onError: (err) =>
        toast.error(
          esCodigo(err, CP.PRUEBA_YA_USADA)
            ? 'Ya usaste tu prueba gratis.'
            : esCodigo(err, CP.SIN_ESA_FUNCION)
              ? 'Primero crea tu perfil de vendedor.'
              : 'No pudimos empezar tu prueba. Revisa tu conexión e intenta de nuevo.'
        ),
    });
  };

  const pagar = (plan: PlanDePago) => {
    if (crear.isPending) return;
    Alert.alert(`Pagar el plan ${plan.nombre} con Mercado Pago`, textoConfirmarPago(precioDe(plan.precio_centavos)), [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Continuar',
        onPress: () =>
          crear.mutate(
            { planId: plan.id },
            {
              onSuccess: ({ url }) => {
                // `crearPago` ya comprobó que es una URL de Mercado Pago. Si el sistema no puede abrirla, se dice como fallo.
                Linking.openURL(url).catch(() => toast.error('No pudimos abrir Mercado Pago. Inténtalo de nuevo.'));
                toast.info('Termina el pago en Mercado Pago y vuelve aquí: se confirma en unos segundos.');
                refrescarOrden();
              },
              onError: (err) => toast.error(mensajeDeErrorPago(err instanceof ErrorPago ? err.tipo : 'desconocido')),
            }
          ),
      },
    ]);
  };

  const textoOrden = orden ? describirOrden(orden.estado, orden.creada_en) : null;
  const ocupado = crear.isPending || iniciar.isPending;

  // La prueba gratis, si está disponible: UNA tarjeta y UN botón. Es la del plan de prueba de ESTA función (no siempre el «Básico»: la del arrendador es «Plus»).
  if (suscripcion.estado === 'gratis' && suscripcion.prueba_disponible) {
    const plan = planes.find((p) => p.es_prueba) ?? planes[0];
    return envoltura(
      <>
        <ThemedText style={Texto.tituloHoja}>Empieza gratis</ThemedText>
        {plan ? <ThemedText themeColor="textSecondary">{textoDePrueba(plan.nombre)}</ThemedText> : null}
        {plan ? (
          <View style={[estilos.tarjeta, { borderColor: theme.text, borderWidth: Filete.grueso, backgroundColor: theme.backgroundElement }]}>
            <View style={estilos.cabeceraPlan}>
              <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{`Plan ${plan.nombre}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{`Después, ${precioDe(plan.precio_centavos)} al mes`}</ThemedText>
            </View>
            {incluyeDe(plan, rol).map((f) => (
              <View key={f} style={estilos.fila}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.bosque} />
                <ThemedText>{f}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        <Sello onPress={empezarPrueba} cargando={iniciar.isPending} accessibilityLabel="Empezar prueba gratis">
          Empezar prueba gratis
        </Sello>
      </>
    );
  }

  return envoltura(
    <>
      <ThemedText type="subtitle">{titulo}</ThemedText>

      {falloOrden ? (
        <ThemedText type="small" themeColor="textSecondary">
          No pudimos comprobar si tienes un pago pendiente. Revisa tu conexión e intenta de nuevo.
        </ThemedText>
      ) : null}
      {textoOrden ? (
        <View style={[estilos.aviso, { borderColor: theme.filete, backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="time-outline" size={20} color={theme.text} />
          <ThemedText type="small" style={estilos.crece}>{textoOrden}</ThemedText>
          <Sello variante="contorno" onPress={refrescarTodo} accessibilityLabel="Actualizar el estado del pago">Actualizar</Sello>
        </View>
      ) : null}

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
                onPress={() => pagar(p)}
                cargando={crear.isPending}
                deshabilitado={ocupado}
                accessibilityLabel={`${esElActual ? 'Renovar' : 'Pagar'} el plan ${p.nombre} con Mercado Pago`}
              >
                {esElActual ? 'Renovar 30 días con Mercado Pago' : 'Pagar con Mercado Pago'}
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
