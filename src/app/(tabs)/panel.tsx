import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { CampanaAvisos } from '@/components/CampanaAvisos';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { GrupoAjustes } from '@/components/ficha/GrupoAjustes';
import { Pulsable } from '@/components/ficha/Pulsable';
import { PanelWeb } from '@/components/web/PanelWeb';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePanelVendedor } from '@/hooks/use-panel-vendedor';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { MAX_ESTRELLAS } from '@/lib/menu';
import { tituloDeLoPropio } from '@/lib/panelVendedor';
import { describirSuscripcion } from '@/lib/planes';

/**
 * Mi panel · la primera vista de un vendedor (0083).
 *
 * Un negocio no tiene por qué abrir la app en «Depas» ni en «Roomies»: aquí ve lo suyo. UN paso de verificación (el que más urge), sus cifras (productos o
 * publicaciones según lo que ofrezca, mensajes sin leer y cuántas personas guardaron lo suyo), su plan —y si lo destaca— y su tienda. Las cifras son las de
 * verdad y un dato que no llegó se escribe «—», nunca 0: un cero parecería un hecho (END-11). NO hay «vistas»: la base no las mide y no se inventan.
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

/** En la web, su propia página (cifras, plan y tienda repartidos en ancho); en la app, la de siempre. */
export default function PanelScreen() {
  return Platform.OS === 'web' ? <PanelWeb /> : <PanelApp />;
}

function PanelApp() {
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const margenSuperior = useMargenSuperior();
  const {
    roles, falloRoles, reintentarRoles, paso, publica, rolPlan, suscripcion, destaca, ofreceProductos, ofrecePublicaciones, totalProductos, publicacionesActivas,
    sinLeer, favoritos, esTienda, negocios, primerNegocio, tienda, productosDeTienda, categorias, estrellas,
  } = usePanelVendedor();

  const irAVerificar = (rol: Vendedor) => router.push({ pathname: '/verificacion/[rol]', params: { rol } });

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.lista, { paddingTop: margenSuperior, maxWidth: anchoLista }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado titulo="Mi panel" accion={<CampanaAvisos />} />

        {falloRoles ? (
          // No se sabe en qué paso va: ni «Verifica tu identidad» ni «sin verificar» (decir lo que no se sabe es peor que decir que falló).
          <ErrorDeCarga etiqueta="No pudimos comprobar tu verificación" onReintentar={reintentarRoles} />
        ) : paso && paso.tipo !== 'listo' ? (
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
          {ofreceProductos ? <Cifra etiqueta="PRODUCTOS" valor={totalProductos} nota="publicados" accesible="Productos" /> : null}
          {ofrecePublicaciones ? <Cifra etiqueta="PUBLICACIONES" valor={publicacionesActivas} nota="activas" accesible="Publicaciones activas" /> : null}
          <Cifra etiqueta="MENSAJES" valor={sinLeer} nota="sin leer" accesible="Mensajes sin leer" />
          <Cifra etiqueta="FAVORITOS" valor={favoritos} nota="te guardaron" accesible="Favoritos" />
        </View>

        <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
          <View style={estilos.cabeceraPlan}>
            <ThemedText type="smallBold">Mi plan</ThemedText>
            {destaca ? (
              <View style={[estilos.insignia, { backgroundColor: theme.lima }]}>
                <ThemedText type="smallBold" style={{ color: theme.limaTexto }}>Destacado</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {suscripcion ? describirSuscripcion(suscripcion) : 'Cargando tu plan…'}
          </ThemedText>
          {destaca ? (
            <ThemedText type="small">{`Apareces primero en ${rolPlan === 'comerciante' ? 'Servicios' : 'Departamentos'}.`}</ThemedText>
          ) : null}
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

        {/* Mi tienda: lo que vende el comerciante, de un vistazo y con la acción más común a un toque. */}
        {esTienda && !falloRoles ? (
          negocios.fallo ? (
            <ErrorDeCarga etiqueta="No pudimos cargar tu tienda" onReintentar={negocios.reintentar} />
          ) : negocios.cargando ? null : !primerNegocio ? (
            <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Mi tienda</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Todavía no publicas tu negocio.</ThemedText>
              <Sello onPress={() => router.push('/negocio/nuevo')} accessibilityLabel="Publicar mi negocio">Publicar mi negocio</Sello>
            </View>
          ) : (
            <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Mi tienda</ThemedText>
              <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{primerNegocio.nombre}</ThemedText>
              {tienda.fallo ? null : (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${productosDeTienda.length} ${productosDeTienda.length === 1 ? 'producto' : 'productos'}`}
                  </ThemedText>
                  {categorias.length > 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">{`Categorías: ${categorias.join(' · ')}`}</ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">{`Destacados: ${estrellas} de ${MAX_ESTRELLAS}`}</ThemedText>
                </>
              )}
              <Sello
                variante="contorno"
                icono="add"
                onPress={() => router.push({ pathname: '/negocio/menu/[id]', params: { id: primerNegocio.id } })}
                accessibilityLabel="Agregar producto"
              >
                Agregar producto
              </Sello>
            </View>
          )
        ) : null}

        {/* Una sola forma de fila en toda la app (`FilaAjuste`): icono, título, descripción y flecha. Sin saber si está verificada no se enseña (ni abierta ni bloqueada). */}
        {falloRoles ? null : (
          <GrupoAjustes>
            <FilaAjuste
              icono="storefront-outline"
              etiqueta={tituloDeLoPropio(roles)}
              descripcion={publica ? 'Datos, fotos y lo que publicas.' : 'Disponible cuando te verifiquemos'}
              bloqueada={!publica}
              onPress={() => router.push('/(tabs)/publicar')}
            />
          </GrupoAjustes>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.two },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  cabeceraPlan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insignia: { borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.half },
  cifra: { flexGrow: 1, flexBasis: '45%', borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.one },
  enlace: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
