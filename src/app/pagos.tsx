import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useMisPagos, useMiSuscripcion, usePlanes } from '@/hooks/queries/usePlanes';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { DIAS_DE_PRUEBA, describirSuscripcion, diasRestantes, fechaLarga, precioDe, type MiSuscripcion } from '@/lib/planes';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Mi plan y pagos · Cuervo 360 (migraciones 0053 y 0084).
 *
 * Por cada función que tiene la cuenta: su plan con las mismas palabras de siempre, la prueba gratis (días que quedan y una barra) y el acceso a empezarla
 * o a ver otros planes. Debajo, el historial de pagos. «Falló» y «no tienes pagos» se pintan distinto (END-11). Esto NO es una factura: la facturación
 * fiscal está en el roadmap.
 *
 * No promete lo que la base no hace: al terminar la prueba, si no se elige un plan, lo suyo deja de mostrarse; NO hay un aviso previo que prometer.
 */

type Rol = 'comerciante' | 'arrendador';

function TarjetaPlan({ rol, titulo, s }: { rol: Rol; titulo: string; s: MiSuscripcion }) {
  const theme = useTheme();
  const aVer = () => router.push({ pathname: '/planes/[rol]', params: { rol } });
  const empezable = s.estado === 'gratis' && s.prueba_disponible;
  const dias = diasRestantes(s.hasta);

  return (
    <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
      <View style={estilos.cabecera}>
        <ThemedText type="smallBold" themeColor="textSecondary">{titulo}</ThemedText>
        {s.estado === 'prueba' ? (
          <View style={[estilos.insignia, { backgroundColor: theme.lima }]}>
            <ThemedText type="smallBold" style={{ color: theme.limaTexto }}>Prueba gratis</ThemedText>
          </View>
        ) : null}
      </View>

      {empezable ? (
        <>
          <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>Todavía no empiezas tu prueba gratis</ThemedText>
          <Sello onPress={aVer} accessibilityLabel="Empezar prueba gratis">Empezar prueba gratis</Sello>
        </>
      ) : (
        <>
          <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{s.plan_nombre}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{describirSuscripcion(s)}</ThemedText>
          {s.estado === 'prueba' ? (
            <>
              <View
                accessible
                accessibilityLabel={`Prueba gratis: quedan ${dias} de ${DIAS_DE_PRUEBA} días`}
                style={[estilos.barra, { backgroundColor: theme.filete }]}
              >
                <View style={[estilos.relleno, { backgroundColor: theme.acento, width: `${Math.min(100, Math.round((dias / DIAS_DE_PRUEBA) * 100))}%` }]} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Cuando termine, si no eliges un plan, lo tuyo deja de mostrarse.
              </ThemedText>
            </>
          ) : null}
          <Pulsable
            onPress={aVer}
            accessibilityRole="button"
            accessibilityLabel={`Ver otros planes de ${rol}`}
            style={estilos.enlace}
          >
            <ThemedText type="small" themeColor="acento" style={Texto.pesoFuerte}>Ver otros planes</ThemedText>
          </Pulsable>
        </>
      )}
    </View>
  );
}

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
  const planes = [
    { rol: 'comerciante' as const, titulo: 'Comerciante', s: comerciante.suscripcion },
    { rol: 'arrendador' as const, titulo: 'Arrendador', s: arrendador.suscripcion },
  ];

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <ThemedText style={Texto.tituloHoja}>Mi plan y pagos</ThemedText>

          {comerciante.fallo || arrendador.fallo ? (
            // Sin leer el plan no se omite la tarjeta en silencio (parecería que no hay plan): se dice y se puede reintentar.
            <ErrorDeCarga
              etiqueta="No pudimos cargar tu plan"
              onReintentar={() => {
                if (comerciante.fallo) comerciante.reintentar();
                if (arrendador.fallo) arrendador.reintentar();
              }}
            />
          ) : null}
          {planes.map(({ rol, titulo, s }) => (s ? <TarjetaPlan key={rol} rol={rol} titulo={titulo} s={s} /> : null))}

          <ThemedText type="etiqueta" themeColor="textSecondary">HISTORIAL DE PAGOS</ThemedText>

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
            <View style={[estilos.vacio, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="card-outline" size={28} color={theme.textSecondary} />
              <ThemedText style={Texto.pesoFuerte}>Todavía no tienes pagos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.centrado}>
                Cuando pagues un plan, aquí verás cada cobro.
              </ThemedText>
            </View>
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
                {/* Los registros de cuando existía el pago de demostración se conservan, pero ya no se rotulan así. */}
                <ThemedText type="small" themeColor="textSecondary">
                  {p.origen === 'mercadopago' ? 'Mercado Pago' : 'Activado sin cobro'}
                </ThemedText>
              </View>
            ))
          )}

          <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
            Esto no es una factura.
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
  tarjeta: { padding: Spacing.three, gap: Spacing.two, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insignia: { borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.half },
  barra: { height: 8, borderRadius: Radios.full, overflow: 'hidden' },
  relleno: { height: 8, borderRadius: Radios.full },
  enlace: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  vacio: { alignItems: 'center', gap: Spacing.one, padding: Spacing.four, borderWidth: Filete.fino, borderRadius: Radios.hoja },
  centrado: { textAlign: 'center' },
  nota: { lineHeight: 20 },
});
