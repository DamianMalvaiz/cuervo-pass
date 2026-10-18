import { ScrollView, StyleSheet, View } from 'react-native';

import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useMisPagos, useMiSuscripcion, usePlanes } from '@/hooks/queries/usePlanes';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { describirSuscripcion, fechaLarga, precioDe } from '@/lib/planes';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Pagos y facturación · Cuervo 360 (migración 0053).
 *
 * El estado de cada suscripción y el historial de pagos. Los pagos de hoy son de DEMOSTRACIÓN y cada renglón lo dice
 * («Simulado»). Esto NO es una factura: la facturación fiscal está en el roadmap. «Falló» y «no tienes pagos» se pintan
 * distinto (END-11).
 */
export default function PagosScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { pagos, cargando, fallo, reintentar } = useMisPagos(miId);
  const comerciante = useMiSuscripcion(miId, 'comerciante');
  const arrendador = useMiSuscripcion(miId, 'arrendador');
  const planesC = usePlanes('comerciante');
  const planesA = usePlanes('arrendador');

  // El nombre de cada plan, para no mostrar «comerciante_destacado» a una persona.
  const nombres = new Map([...planesC.planes, ...planesA.planes].map((p) => [p.id, p.nombre]));
  const suscripciones = [
    { titulo: 'Comerciante', s: comerciante.suscripcion },
    { titulo: 'Arrendador', s: arrendador.suscripcion },
  ].filter((x) => x.s);

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <ThemedText type="subtitle">Pagos y facturación</ThemedText>

          {suscripciones.map(({ titulo, s }) => (
            <View key={titulo} style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">{titulo}</ThemedText>
              <ThemedText type="small">{s ? describirSuscripcion(s) : ''}</ThemedText>
            </View>
          ))}

          <ThemedText type="subtitle">Historial de pagos</ThemedText>

          {cargando ? (
            <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">Cargando tus pagos…</ThemedText>
          ) : fallo ? (
            <View style={estilos.columna}>
              <ThemedText type="small" themeColor="textSecondary">
                No pudimos cargar tus pagos. Revisa tu conexión e intenta de nuevo.
              </ThemedText>
              <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">Reintentar</Sello>
            </View>
          ) : pagos.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">Todavía no has hecho pagos.</ThemedText>
          ) : (
            pagos.map((p) => (
              <View key={p.id} style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
                <View style={estilos.cabecera}>
                  <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{nombres.get(p.plan_id) ?? 'Plan'}</ThemedText>
                  <ThemedText style={Texto.pesoFuerte}>{precioDe(p.monto_centavos)}</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {fechaLarga(p.creado_en)} · cubre hasta el {fechaLarga(p.periodo_fin)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {p.origen === 'simulado' ? 'Simulado (demostración)' : 'Mercado Pago'}
                </ThemedText>
              </View>
            ))
          )}

          <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
            Los pagos con tarjeta real y la facturación fiscal llegarán más adelante. Lo que ves aquí no es una factura.
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
  tarjeta: { padding: Spacing.three, gap: Spacing.one, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nota: { lineHeight: 20 },
});
