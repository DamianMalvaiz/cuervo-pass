import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { CifraAnimadaWeb } from '@/components/web/CifraAnimadaWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePanelVendedor } from '@/hooks/use-panel-vendedor';
import { useTheme } from '@/hooks/use-theme';
import { tituloDeLoPropio } from '@/lib/panelVendedor';
import { describirSuscripcion } from '@/lib/planes';

type Vendedor = 'arrendador' | 'comerciante';

/**
 * Mi panel en la web (0083): lo mismo que el de la app, con los MISMOS números (`usePanelVendedor`), repartido en una página ancha. UN paso de verificación arriba (el que más urge), las cifras, el plan y la tienda o lo que ofrece.
 * Una cifra que no llegó se escribe «—», nunca 0 (END-11); y no hay «vistas»: la base no las mide y no se inventan.
 */
export function PanelWeb() {
  const theme = useTheme();
  const p = usePanelVendedor();
  const irAVerificar = (rol: Vendedor) => router.push({ pathname: '/verificacion/[rol]', params: { rol } });

  return (
    <PaginaSesionWeb titulo="Mi panel" subtitulo="Lo tuyo de un vistazo: verificación, cifras, plan y lo que publicas.">
      <View style={estilos.cuerpo}>
        {p.falloRoles ? (
          // No se sabe en qué paso va: ni «Verifica tu identidad» ni «sin verificar».
          <ErrorDeCarga etiqueta="No pudimos comprobar tu verificación" onReintentar={p.reintentarRoles} />
        ) : p.paso && p.paso.tipo !== 'listo' ? (
          <View style={[estilos.tarjeta, estilos.aviso, { borderColor: theme.tintedBorder, backgroundColor: theme.tintedSurface }]}>
            <ThemedText style={Texto.etiqueta} themeColor="textSecondary">VERIFICACIÓN</ThemedText>
            {p.paso.tipo === 'empezar' ? (
              <>
                <ThemedText style={Texto.titulo}>Verifica tu identidad para publicar</ThemedText>
                <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Necesitamos tu INE y unas fotos. Solo las ve el equipo que verifica.</ThemedText>
                <View style={estilos.accion}><BotonWeb onPress={() => irAVerificar((p.paso as { rol: Vendedor }).rol)} accessibilityLabel="Empezar verificación">Empezar verificación</BotonWeb></View>
              </>
            ) : p.paso.tipo === 'reenviar' ? (
              <>
                <ThemedText style={Texto.titulo}>Tu verificación no pasó</ThemedText>
                <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Revisa el motivo y vuelve a enviarla.</ThemedText>
                <View style={estilos.accion}><BotonWeb onPress={() => irAVerificar((p.paso as { rol: Vendedor }).rol)} accessibilityLabel="Volver a enviar mi verificación">Volver a enviar</BotonWeb></View>
              </>
            ) : (
              <>
                <ThemedText style={Texto.titulo}>En revisión</ThemedText>
                <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Recibimos tus documentos. Te avisamos en cuanto los revisemos; mientras tanto, lo tuyo aún no aparece para los estudiantes.</ThemedText>
              </>
            )}
          </View>
        ) : null}

        <View style={estilos.cifras}>
          {p.ofreceProductos ? <Cifra etiqueta="PRODUCTOS" valor={p.totalProductos} nota="publicados" accesible="Productos" /> : null}
          {p.ofrecePublicaciones ? <Cifra etiqueta="PUBLICACIONES" valor={p.publicacionesActivas} nota="activas" accesible="Publicaciones activas" /> : null}
          <Cifra etiqueta="MENSAJES" valor={p.sinLeer} nota="sin leer" accesible="Mensajes sin leer" />
          <Cifra etiqueta="FAVORITOS" valor={p.favoritos} nota="te guardaron" accesible="Favoritos" />
        </View>

        <View style={estilos.columnas}>
          <View style={[estilos.tarjeta, estilos.columna, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <View style={estilos.cabecera}>
              <ThemedText style={Texto.subtitulo}>Mi plan</ThemedText>
              {p.destaca ? (
                <View style={[estilos.insignia, { backgroundColor: theme.lima }]}>
                  <ThemedText style={[Texto.pequenoFuerte, { color: Colors.dark.limaTexto }]}>Destacado</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{p.suscripcion ? describirSuscripcion(p.suscripcion) : 'Cargando tu plan…'}</ThemedText>
            {p.destaca ? <ThemedText style={Texto.cuerpo}>{`Apareces primero en ${p.rolPlan === 'comerciante' ? 'Servicios' : 'Departamentos'}.`}</ThemedText> : null}
            <View style={estilos.acciones}>
              {p.suscripcion?.estado === 'gratis' && p.suscripcion.prueba_disponible ? (
                <BotonWeb onPress={() => router.push({ pathname: '/planes/[rol]', params: { rol: p.rolPlan } })} accessibilityLabel="Empezar prueba gratis">Empezar prueba gratis</BotonWeb>
              ) : null}
              <BotonWeb variante="contorno" onPress={() => router.push('/pagos')} accessibilityLabel="Ver mi plan y pagos">Ver mi plan y pagos</BotonWeb>
            </View>
          </View>

          {p.esTienda && !p.falloRoles ? <Tienda p={p} /> : null}
          {p.falloRoles ? null : (
            <View style={[estilos.tarjeta, estilos.columna, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={Texto.subtitulo}>{tituloDeLoPropio(p.roles)}</ThemedText>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{p.publica ? 'Datos, fotos y lo que publicas.' : 'Disponible cuando te verifiquemos.'}</ThemedText>
              <View style={estilos.acciones}>
                {p.publica ? (
                  <BotonWeb onPress={() => router.push('/(tabs)/publicar')} accessibilityLabel={`Abrir ${tituloDeLoPropio(p.roles)}`}>Abrir</BotonWeb>
                ) : (
                  <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary" accessibilityRole="text">Bloqueado hasta verificar tu identidad</ThemedText>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </PaginaSesionWeb>
  );
}

function Cifra({ etiqueta, valor, nota, accesible }: { etiqueta: string; valor: number | null; nota: string; accesible: string }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={`${accesible}: ${valor == null ? 'sin dato' : valor}`} style={[estilos.cifra, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={Texto.etiqueta} themeColor="textSecondary">{etiqueta}</ThemedText>
      {valor == null ? <ThemedText style={Texto.titularWebCompacto}>—</ThemedText> : <CifraAnimadaWeb valor={valor} style={Texto.titularWebCompacto} />}
      <ThemedText style={Texto.pequeno} themeColor="textSecondary">{nota}</ThemedText>
    </View>
  );
}

/** Mi tienda: el primer negocio y lo que tiene dentro, con la acción más común a un toque. */
function Tienda({ p }: { p: ReturnType<typeof usePanelVendedor> }) {
  const theme = useTheme();
  const caja = [estilos.tarjeta, estilos.columna, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }];
  if (p.negocios.fallo) return <View style={estilos.columna}><ErrorDeCarga etiqueta="No pudimos cargar tu tienda" onReintentar={p.negocios.reintentar} /></View>;
  if (p.negocios.cargando) return null;
  if (!p.primerNegocio) {
    return (
      <View style={caja}>
        <ThemedText style={Texto.subtitulo}>Mi tienda</ThemedText>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no publicas tu negocio.</ThemedText>
        <View style={estilos.acciones}><BotonWeb onPress={() => router.push('/negocio/nuevo')} accessibilityLabel="Publicar mi negocio">Publicar mi negocio</BotonWeb></View>
      </View>
    );
  }
  const n = p.productosDeTienda.length;
  return (
    <View style={caja}>
      <ThemedText style={Texto.subtitulo}>Mi tienda</ThemedText>
      <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{p.primerNegocio.nombre}</ThemedText>
      {p.tienda.fallo ? null : (
        <>
          <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{`${n} ${n === 1 ? 'producto' : 'productos'}`}</ThemedText>
          {p.categorias.length > 0 ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">{`Categorías: ${p.categorias.join(' · ')}`}</ThemedText> : null}
          <ThemedText style={Texto.pequeno} themeColor="textSecondary">{`Destacados: ${p.estrellas} de ${p.maxEstrellas}`}</ThemedText>
        </>
      )}
      <View style={estilos.acciones}>
        <BotonWeb variante="contorno" icono="add" onPress={() => router.push({ pathname: '/negocio/menu/[id]', params: { id: p.primerNegocio!.id } })} accessibilityLabel="Agregar producto">Agregar producto</BotonWeb>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cuerpo: { gap: Spacing.four },
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.four, gap: Spacing.two },
  aviso: { padding: Spacing.five },
  accion: { alignItems: 'flex-start', marginTop: Spacing.two },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  cifra: { flexGrow: 1, flexBasis: 200, borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.four, gap: Spacing.one },
  columnas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'flex-start' },
  columna: { flexGrow: 1, flexBasis: 320, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  insignia: { borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.half },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
});
