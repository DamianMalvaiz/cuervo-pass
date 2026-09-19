import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { BotonVerContacto } from '@/components/BotonVerContacto';
import { CampoFicha } from '@/components/ficha/CampoFicha';
import { DesgloseCalificacion } from '@/components/ficha/DesgloseCalificacion';
import { Seccion } from '@/components/ficha/Seccion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { fechaDeSello, folioDe } from '@/lib/folio';
import { ATRIBUCION_MAPA } from '@/lib/geocoding';
import {
  reportarPublicacion,
  revelarContacto,
} from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import { Sello } from '@/components/ficha/Sello';
import { usePublicacion , useAfinidad } from '@/hooks/queries/usePublicaciones';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const ETIQUETA_TIPO: Record<string, string> = {
  depa: 'DEPARTAMENTO',
  cuarto: 'CUARTO',
  casa: 'CASA',
  casa_compartida: 'CASA COMPARTIDA',
};


export default function DetallePublicacionScreen() {
  const theme = useTheme();
  // END-21 · Solo el id. El score, la base y la similitud llegaban como
  // PARÁMETROS DE RUTA, así que un enlace directo a una ficha no los traía y el
  // desglose —la tesis del producto— desaparecía según por dónde entraras. Y
  // peor: ese valor acababa en `contactos.score_mostrado`, o sea que la métrica
  // la suministraba el cliente. Ahora se consulta al servidor.
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((s) => s.session);
  const { perfil, cargarPerfil } = usePerfilStore();
  const [foja, setFoja] = useState(0);

  // El ancho se lee en cada render, no al importar el módulo: con `Dimensions`
  // capturado arriba, el carrusel paginado quedaba desalineado tras rotar el
  // teléfono o en pantalla dividida. PRODUCT.md declara la plataforma
  // `adaptive`, así que eso no es un caso raro.
  const { width: ancho } = useWindowDimensions();

  // END-11 · TRES estados, no dos, y END-18: la consulta vive en el hook.
  //
  // `fallo` es una caída de lectura; `publicacion === null` es que de verdad no
  // está. Mientras compartieron un mismo `null`, la pantalla elegía la
  // interpretación más grave y acusaba de reportes a un anuncio ajeno por un
  // fallo de red.
  //
  // El contador de intentos y la cancelación al desmontar que hacía falta
  // sostener a mano desaparecen: react-query los trae, y además reintenta dos
  // veces con backoff antes de rendirse.
  const { publicacion, cargando, fallo, reintentar } = usePublicacion(id);
  const afinidad = useAfinidad(id);

  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  const { urls: urlsFirmadas, fallo: falloFotos } = useFotosFirmadas(publicacion?.fotos ?? []);

  const onReportar = () => {
    if (!session?.user.id || !publicacion) return;
    const usuarioId = session.user.id;
    const publicacionId = publicacion.id;
    const enviar = async (motivo: string) => {
      try {
        await reportarPublicacion(usuarioId, publicacionId, motivo);
        // El ocultamiento a los 3 reportes lo hace el trigger `al_reportar`
        // (migración 0013), y el dueño recibe una notificación.
        Alert.alert('Gracias', 'Reportamos esta publicación para revisión.');
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : '';
        Alert.alert(
          'No se pudo enviar el reporte',
          mensaje.includes('duplicate') || mensaje.includes('unique')
            ? 'Ya habías reportado esta publicación.'
            : 'Intenta de nuevo en un momento.'
        );
      }
    };
    Alert.alert('Reportar publicación', '¿Por qué la reportas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Contenido sospechoso', onPress: () => enviar('contenido sospechoso') },
      { text: 'Información falsa', onPress: () => enviar('información falsa') },
    ]);
  };

  if (cargando) {
    return (
      <ThemedView style={estilos.centrado}>
        <ActivityIndicator color={theme.acento} />
        <ThemedText type="etiqueta" themeColor="textSecondary">
          CONSULTANDO FICHA
        </ThemedText>
      </ThemedView>
    );
  }

  // El fallo de lectura va PRIMERO y no comparte pantalla con el vacío: decir
  // «pudo ocultarse tras varios reportes» porque se cayó el wifi es acusar al
  // anuncio de otra persona de algo que nadie denunció.
  if (fallo) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.error} />
        <ThemedText type="etiqueta" themeColor="error">
          NO PUDIMOS CONSULTAR
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={estilos.textoCentrado}>
          No pudimos consultar esta ficha. Revisa tu conexión y reintenta.
        </ThemedText>
        <Sello onPress={() => void reintentar()} icono="refresh" accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </ThemedView>
    );
  }

  if (!publicacion) {
    return (
      <ThemedView style={estilos.centrado}>
        <Ionicons name="document-outline" size={28} color={theme.textSecondary} />
        <ThemedText type="etiqueta" themeColor="textSecondary">
          FICHA NO DISPONIBLE
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={estilos.textoCentrado}>
          Esta publicación ya no está disponible. Pudo desactivarse o ocultarse tras varios reportes.
        </ThemedText>
      </ThemedView>
    );
  }

  const tieneUbicacion = publicacion.latitud != null && publicacion.longitud != null;
  const distanciaKm =
    tieneUbicacion && perfil?.latitud_universidad != null && perfil?.longitud_universidad != null
      ? calcularDistanciaKm(
          perfil.latitud_universidad,
          perfil.longitud_universidad,
          publicacion.latitud as number,
          publicacion.longitud as number
        )
      : null;

  const fotos = publicacion.fotos ?? [];
  const folio = folioDe(publicacion.id);
  const alta = fechaDeSello(publicacion.creado_en);
  const etiquetaTipo = ETIQUETA_TIPO[publicacion.tipo] ?? String(publicacion.tipo).toUpperCase();

  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setFoja(Math.round(e.nativeEvent.contentOffset.x / ancho));
  };

  return (
    <ScrollView contentContainerStyle={estilos.hoja} showsVerticalScrollIndicator={false}>
      {/* Membrete: qué documento es y cuál. */}
      <View style={[estilos.membrete, { borderBottomColor: theme.filete }]}>
        <ThemedText type="etiqueta" themeColor="textSecondary">
          {etiquetaTipo}
        </ThemedText>
        <ThemedText type="folio" themeColor="textSecondary">
          FOLIO {folio}
          {alta ? ` · ALTA ${alta}` : ''}
        </ThemedText>
      </View>

      {fotos.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={alDesplazar}
            accessibilityLabel={`${fotos.length} fotografías de la publicación`}
          >
            {fotos.map((ruta) => {
              const url = urlsFirmadas.get(ruta);
              return url ? (
                <Image
                  key={ruta}
                  source={{ uri: url }}
                  style={[estilos.foto, { width: ancho }]}
                  contentFit="cover"
                  transition={160}
                />
              ) : (
                <View
                  key={ruta}
                  style={[estilos.foto, { width: ancho, backgroundColor: theme.backgroundElement }]}
                >
                  {/* END-25 · Un recuadro gris sin texto es indistinguible de
                      «todavía cargando». Si Storage falló hay que decirlo: si
                      no, la persona espera indefinidamente algo que no va a
                      llegar. */}
                  {falloFotos && (
                    <View style={estilos.fotoFallida}>
                      <Ionicons name="image-outline" size={22} color={theme.textSecondary} />
                      <ThemedText type="folio" themeColor="textSecondary">
                        FOTOGRAFÍA NO DISPONIBLE
                      </ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {fotos.length > 1 && (
            // "Foja n de m" es como un expediente numera sus hojas. Cumple la
            // misma función que los puntitos de un carrusel y además dice
            // CUÁNTAS faltan, que los puntitos no dicen cuando pasan de cinco.
            <View style={[estilos.foja, { backgroundColor: theme.background, borderColor: theme.filete }]}>
              <ThemedText type="folio" themeColor="textSecondary">
                FOJA {foja + 1} DE {fotos.length}
              </ThemedText>
            </View>
          )}
        </View>
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { width: ancho, backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
          <ThemedText type="etiqueta" themeColor="textSecondary">
            SIN FOTOGRAFÍA
          </ThemedText>
        </View>
      )}

      <View style={estilos.cuerpo}>
        <ThemedText type="title">{publicacion.titulo}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {publicacion.direccion}
        </ThemedText>

        {/* La interacción firma del producto: la caja negra se abre.
            Solo cuando HAY calificación. Al abrir esta ficha desde "Mis
            publicaciones" no hay score —no existe afinidad contigo mismo— y
            pintar la casilla vacía con "¿Por qué esta calificación?" debajo
            dejaba una afordancia muerta. */}
        {afinidad?.scoreFinal != null && (
          <>
            <DesgloseCalificacion
              score={afinidad.scoreFinal}
              base={afinidad.score}
              similitud={afinidad.similitud}
            />
            {/* END-30 · El descargo, junto al número y no en un aviso legal que
                nadie abre.
                
                Una casilla con forma de kardex presta autoridad: una
                calificación de kardex es un número ganado y auditable, y éste
                es una mezcla ponderada de cuatro heurísticas. Decir en voz alta
                qué compara —y qué NO— es lo que evita que la metáfora prometa
                por su cuenta, a alguien que está eligiendo dónde va a vivir sin
                haber visto el lugar. */}
            <ThemedText type="folio" themeColor="textSecondary" style={estilos.descargoAjuste}>
              Este ajuste compara tus filtros con lo publicado. No verificamos el inmueble.
            </ThemedText>
          </>
        )}

        <Seccion titulo="DATOS DE LA PUBLICACIÓN">
          <View style={estilos.rejilla}>
            <CampoFicha
              etiqueta="RENTA MENSUAL"
              valor={`$${formateadorPrecio.format(publicacion.precio_renta)}`}
              ancho={1}
            />
            <CampoFicha
              etiqueta="DISTANCIA A TU UNIVERSIDAD"
              valor={distanciaKm != null ? `${distanciaKm.toFixed(1)} km` : 'sin dato'}
              ancho={1}
              tono={distanciaKm != null ? 'normal' : 'atenuado'}
            />
          </View>
          <View style={estilos.rejilla}>
            <CampoFicha
              etiqueta="RECÁMARAS"
              valor={String(publicacion.recamaras)}
              ancho={1}
              icono="bed-outline"
            />
            <CampoFicha
              etiqueta="AMUEBLADO"
              valor={publicacion.amueblado ? 'Sí' : 'No'}
              ancho={1}
              tono={publicacion.amueblado ? 'normal' : 'atenuado'}
            />
          </View>
          <View style={estilos.rejilla}>
            <CampoFicha
              etiqueta="MASCOTAS"
              valor={publicacion.permite_mascotas ? 'Sí acepta' : 'No acepta'}
              ancho={1}
              icono="paw-outline"
              tono={publicacion.permite_mascotas ? 'normal' : 'atenuado'}
            />
            <CampoFicha
              etiqueta="SERVICIOS INCLUIDOS"
              valor={publicacion.servicios_incluidos ? 'Sí' : 'No'}
              ancho={1}
              tono={publicacion.servicios_incluidos ? 'normal' : 'atenuado'}
            />
          </View>
        </Seccion>

        {publicacion.descripcion ? (
          <Seccion titulo="DESCRIPCIÓN">
            <ThemedText style={estilos.descripcion}>{publicacion.descripcion}</ThemedText>
          </Seccion>
        ) : null}

        {tieneUbicacion && (
          <Seccion titulo="UBICACIÓN">
            <View style={[estilos.marcoMapa, { borderColor: theme.border }]}>
              <MapView
                style={estilos.mapa}
                initialRegion={{
                  latitude: publicacion.latitud as number,
                  longitude: publicacion.longitud as number,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                zoomEnabled
                scrollEnabled
                rotateEnabled
                zoomControlEnabled
              >
                <Marker
                  coordinate={{
                    latitude: publicacion.latitud as number,
                    longitude: publicacion.longitud as number,
                  }}
                  title={publicacion.titulo}
                />
              </MapView>
            </View>
            {/* Obligación de atribución de la licencia ODbL (§9, AUD-02). No es
                decorativa: es la condición bajo la que podemos guardar estas
                coordenadas en la base. */}
            <ThemedText type="folio" themeColor="textSecondary">
              {ATRIBUCION_MAPA}
            </ThemedText>
          </Seccion>
        )}

        <View style={estilos.sello}>
          <BotonVerContacto
            publicacionId={publicacion.id}
            titulo={publicacion.titulo}
            score={afinidad?.scoreFinal ?? null}
            onRevelar={revelarContacto}
            onError={(mensaje) => Alert.alert('No se pudo abrir el contacto', mensaje)}
          />
        </View>

        {/* §28: esta app no verifica identidades. Decirlo es mejor ingeniería
            que fingir que el riesgo no existe. */}
        <View style={[estilos.advertencia, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={estilos.textoAdvertencia}>
            No adelantes dinero antes de visitar el lugar. Cuervo Pass no verifica la identidad de
            quien publica.
          </ThemedText>
        </View>

        <Pressable
          onPress={onReportar}
          style={estilos.reportar}
          accessibilityRole="button"
          accessibilityLabel="Reportar publicación"
        >
          <Ionicons name="flag-outline" size={16} color={theme.error} />
          <ThemedText type="small" themeColor="error" style={estilos.textoReportar}>
            Reportar publicación
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  descargoAjuste: { marginTop: Spacing.one, lineHeight: 16 },
  fotoFallida: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  hoja: { paddingBottom: Spacing.six },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  textoCentrado: { textAlign: 'center', lineHeight: 22 },
  membrete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    // El filete que el contrato pide bajo el membrete. Un formulario separa su
    // encabezado del cuerpo con una regla, no con aire.
    borderBottomWidth: Filete.fino,
  },
  foto: { aspectRatio: 3 / 2 },
  sinFoto: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  foja: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.casilla,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  cuerpo: { padding: Spacing.three, gap: Spacing.three },
  rejilla: { flexDirection: 'row', gap: Spacing.three },
  descripcion: { lineHeight: 24 },
  marcoMapa: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  mapa: { height: 220 },
  sello: { marginTop: Spacing.two },
  advertencia: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
  },
  textoAdvertencia: { flex: 1, lineHeight: 20 },
  reportar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 44,
  },
  textoReportar: {},
});
