import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CampanaAvisos } from '@/components/CampanaAvisos';
import { Encabezado } from '@/components/ficha/Encabezado';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useConversaciones } from '@/hooks/queries/useChat';
import { useMisNegocios } from '@/hooks/queries/useMisNegocios';
import { useMiSuscripcion } from '@/hooks/queries/usePlanes';
import { useMisPublicaciones } from '@/hooks/queries/usePublicaciones';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { pasoDeVerificacion, tituloDeLoPropio } from '@/lib/panelVendedor';
import { describirSuscripcion } from '@/lib/planes';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Mi panel · la primera vista de un vendedor (0083).
 *
 * Un negocio no tiene por qué abrir la app en «Depas» ni en «Roomies»: aquí ve lo suyo. UN paso de verificación (el que más urge), dos números, su
 * plan y lo que ofrece. Los números son los de verdad y un dato que no llegó se escribe «—», nunca 0: un cero parecería un hecho (END-11).
 */

type Vendedor = 'arrendador' | 'comerciante';

function Cifra({ etiqueta, valor, nota, accesible }: { etiqueta: string; valor: number | null; nota: string; accesible: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${accesible}: ${valor == null ? 'sin dato' : valor}`}
      style={[estilos.cifra, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText type="etiqueta" themeColor="textSecondary">{etiqueta}</ThemedText>
      <ThemedText style={Texto.titulo}>{valor == null ? '—' : String(valor)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{nota}</ThemedText>
    </View>
  );
}

export default function PanelScreen() {
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const margenSuperior = useMargenSuperior();
  const miId = useAuthStore((s) => s.session?.user.id);

  const { roles } = useMisRoles(miId);
  const conv = useConversaciones(miId);
  const pubs = useMisPublicaciones(miId);
  const negocios = useMisNegocios(miId);
  const paso = pasoDeVerificacion(roles);
  const rolPlan: Vendedor = (roles.find((r) => r.rol === 'arrendador' || r.rol === 'comerciante')?.rol as Vendedor | undefined) ?? 'arrendador';
  const { suscripcion } = useMiSuscripcion(miId, rolPlan);

  // «—» si no llegó (cargando o falló): nunca un 0 que parezca un hecho.
  const sinLeer = conv.cargando || conv.fallo ? null : conv.conversaciones.reduce((n, c) => n + c.noLeidos, 0);
  const activos =
    pubs.cargando || negocios.cargando || negocios.fallo
      ? null
      : pubs.datos.filter((p) => p.activa).length + negocios.negocios.filter((n) => (n as { activo?: boolean }).activo).length;

  const irAVerificar = (rol: Vendedor) => router.push({ pathname: '/verificacion/[rol]', params: { rol } });

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.lista, { paddingTop: margenSuperior, maxWidth: anchoLista }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado titulo="Mi panel" accion={<CampanaAvisos />} />

        {paso && paso.tipo !== 'listo' ? (
          <View style={[estilos.tarjeta, { borderColor: theme.tintedBorder, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="etiqueta" themeColor="textSecondary">VERIFICACIÓN</ThemedText>
            {paso.tipo === 'empezar' ? (
              <>
                <ThemedText type="subtitle">Verifica tu identidad para publicar</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Necesitamos tu INE y unas fotos. Solo las ve el equipo que verifica.
                </ThemedText>
                <Sello onPress={() => irAVerificar(paso.rol)} accessibilityLabel="Empezar verificación">Empezar verificación</Sello>
              </>
            ) : paso.tipo === 'reenviar' ? (
              <>
                <ThemedText type="subtitle">Tu verificación no pasó</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Revisa el motivo y vuelve a enviarla.</ThemedText>
                <Sello onPress={() => irAVerificar(paso.rol)} accessibilityLabel="Volver a enviar mi verificación">Volver a enviar</Sello>
              </>
            ) : (
              <>
                <ThemedText type="subtitle">En revisión</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Recibimos tus documentos. Te avisamos en cuanto los revisemos; mientras tanto, lo tuyo aún no aparece para los estudiantes.
                </ThemedText>
              </>
            )}
          </View>
        ) : null}

        <View style={estilos.cifras}>
          <Cifra etiqueta="MENSAJES" valor={sinLeer} nota="sin leer" accesible="Mensajes sin leer" />
          <Cifra etiqueta="ACTIVOS" valor={activos} nota="publicados" accesible="Activos" />
        </View>

        <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Mi plan</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {suscripcion ? describirSuscripcion(suscripcion) : 'Cargando tu plan…'}
          </ThemedText>
          {suscripcion?.estado === 'gratis' && suscripcion.prueba_disponible ? (
            <Sello
              onPress={() => router.push({ pathname: '/planes/[rol]', params: { rol: rolPlan } })}
              accessibilityLabel="Empezar prueba gratis"
            >
              Empezar prueba gratis
            </Sello>
          ) : null}
          <Pulsable
            onPress={() => router.push('/pagos')}
            accessibilityRole="button"
            accessibilityLabel="Ver mi plan y pagos"
            style={estilos.enlace}
          >
            <ThemedText type="small" themeColor="acento" style={Texto.pesoFuerte}>Ver mi plan y pagos</ThemedText>
          </Pulsable>
        </View>

        {/* Una sola forma de fila en toda la app (`FilaAjuste`): icono, título, descripción y flecha. */}
        <View style={[estilos.filas, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
          <FilaAjuste
            icono="storefront-outline"
            etiqueta={tituloDeLoPropio(roles)}
            descripcion="Datos, fotos y lo que publicas."
            onPress={() => router.push('/(tabs)/publicar')}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.two },
  cifras: { flexDirection: 'row', gap: Spacing.three },
  cifra: { flex: 1, borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.one },
  enlace: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  filas: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
});
