import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonVerContacto } from '@/components/BotonVerContacto';
import { Pastilla } from '@/components/ficha/Pastilla';
import { SeccionResenas } from '@/components/SeccionResenas';
import { PorQueEsBuena } from '@/components/ficha/PorQueEsBuena';
import { Seccion } from '@/components/ficha/Seccion';
import { SeccionParecidas } from '@/components/SeccionParecidas';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { BotonEscribir } from '@/components/BotonEscribir';
import { BotonFavorito } from '@/components/BotonFavorito';
import { ConteoFavoritos } from '@/components/ConteoFavoritos';
import { MapaUbicacion } from '@/components/MapaUbicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { ATRIBUCION_MAPA } from '@/lib/geocoding';
import {
  reportarPublicacion,
  revelarContacto,
} from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import { useCalificacionPublicacion } from '@/hooks/queries/useResenas';
import { usePerfilStore } from '@/store/usePerfilStore';
import { Sello } from '@/components/ficha/Sello';
import { usePublicacion , useAfinidad } from '@/hooks/queries/usePublicaciones';
import { SQL, esCodigo } from '@/lib/erroresPostgres';
import { etiquetaDeAjuste, razonesDeAjuste } from '@/lib/razonesDeAjuste';
import { toast } from '@/lib/toast';

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const ETIQUETA_TIPO: Record<string, string> = {
  depa: 'Departamento',
  cuarto: 'Cuarto',
  casa: 'Casa',
  casa_compartida: 'Casa compartida',
};


export default function DetallePublicacionScreen() {
  const { bottom: insetInferior } = useSafeAreaInsets();
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
  // END-36 · El ancho de la foto es `Math.min(pantalla, MaxContentWidth)`, que
  // es lo que devuelve `anchoLista`. En una tableta de 1200 px, una fotografía
  // 3:2 a pantalla completa mide 800 px de alto: hay que desplazar para ver que
  // debajo hay una ficha. Acotarla a 800 la deja en 533 y el documento cabe.
  //
  // El paginado sigue cuadrando porque la HOJA se acota al mismo ancho y se
  // centra: el carrusel mide exactamente lo que mide cada foto. Acotar solo la
  // foto habría dejado un carril más ancho que sus páginas y el `pagingEnabled`
  // se habría desalineado un poco en cada deslizamiento.
  const { anchoLista } = useTamanoPantalla();

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
  const { calificacion, numResenas } = useCalificacionPublicacion(id);

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
        toast.exito('Gracias. Reportamos esta publicación para revisión.');
      } catch (e) {
        // END-27 · 23505 es el código estándar de violación de unicidad, el
        // mismo en cualquier versión y cualquier locale. El texto «duplicate
        // key value» no lo es.
        // Es un resultado, no una pregunta: va como aviso. El Alert que SÍ se
        // queda es el de arriba, el que pide el motivo.
        toast.error(
          esCodigo(e, SQL.UNIQUE_VIOLATION)
            ? 'No se pudo enviar el reporte. Ya habías reportado esta publicación.'
            : 'No se pudo enviar el reporte. Intenta de nuevo en un momento.'
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
    // END-38 · Una hoja con la forma de la ficha, no un punto girando en medio
    // de la nada. Aquí el esqueleto vale MÁS que en una lista: esta pantalla se
    // abre desde un toque, así que quien llega ya sabe qué publicación pidió y
    // lo que necesita es ver que está apareciendo, no que se está esperando.
    return (
      <ThemedView style={estilos.esqueletoPantalla}>
        <ScrollView contentContainerStyle={[estilos.esqueleto, estilos.columna, { maxWidth: anchoLista }]}>
          <ListaEsqueleto
            variante="hoja"
            filas={1}
            etiquetas={['RENTA MENSUAL', 'DISTANCIA']}
          />
        </ScrollView>
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
          No pudimos consultar
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
          Ficha no disponible
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

  const etiquetaAjuste = etiquetaDeAjuste(afinidad?.scoreFinal);
  const razones = razonesDeAjuste({
    precio: publicacion.precio_renta,
    presupuestoMax: perfil?.presupuesto_max,
    distanciaKm,
    distanciaMaxKm: perfil?.distancia_max_km,
    permiteMascotas: publicacion.permite_mascotas,
    tengoMascotas: Boolean(perfil?.mascotas),
  });

  const fotos = publicacion.fotos ?? [];
  const etiquetaTipo = ETIQUETA_TIPO[publicacion.tipo] ?? String(publicacion.tipo).replace(/^./, (c) => c.toUpperCase());

  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Divide por el ancho ACOTADO, el mismo con el que se pintan las fotos. Con
    // el ancho de pantalla, en una tableta la foja habría contado páginas de 1200
    // px sobre un carril hecho de páginas de 800: el número de foja se habría
    // quedado atrás y el membrete diría «1 de 5» estando en la tercera.
    setFoja(Math.round(e.nativeEvent.contentOffset.x / anchoLista));
  };

  return (
    <View style={estilos.pantalla}>
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={[estilos.hoja, estilos.columna, { maxWidth: anchoLista }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Qué clase de sitio es, en frase normal. Hasta el 17/10/2026 había aquí un membrete de expediente con
          «FOLIO …· ALTA …». */}
      <View style={estilos.membrete}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {etiquetaTipo}
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
                  style={[estilos.foto, { width: anchoLista }]}
                  contentFit="cover"
                  transition={160}
                />
              ) : (
                <View
                  key={ruta}
                  style={[estilos.foto, { width: anchoLista, backgroundColor: theme.backgroundElement }]}
                >
                  {/* END-25 · Un recuadro gris sin texto es indistinguible de
                      «todavía cargando». Si Storage falló hay que decirlo: si
                      no, la persona espera indefinidamente algo que no va a
                      llegar. */}
                  {falloFotos && (
                    <View style={estilos.fotoFallida}>
                      <Ionicons name="image-outline" size={22} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Fotografía no disponible
                      </ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {fotos.length > 1 && (
            // «1 de 6» en una pastilla oscura sobre la foto: dice en cuál vas y cuántas faltan, que los puntitos
            // no dicen cuando pasan de cinco.
            <View style={[estilos.foja, { backgroundColor: theme.text }]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {foja + 1} de {fotos.length}
              </ThemedText>
            </View>
          )}
        </View>
      ) : (
        <View style={[estilos.foto, estilos.sinFoto, { width: anchoLista, backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Sin fotografía
          </ThemedText>
        </View>
      )}

      <View style={[estilos.cuerpo, { backgroundColor: theme.background }]}>
        {/* Solo cuando HAY calificación: al abrir la ficha desde «Mis publicaciones» no hay score —no existe
            afinidad contigo mismo—. Va en palabras, no como «9.4» ni con su fórmula (17/10/2026). */}
        {etiquetaAjuste ? (
          <View style={[estilos.insignia, { backgroundColor: theme.lima }]}>
            <ThemedText type="smallBold" style={{ color: theme.limaTexto }}>
              {etiquetaAjuste}
            </ThemedText>
          </View>
        ) : null}

        <View style={estilos.encabezadoFicha}>
          <ThemedText type="title">{publicacion.titulo}</ThemedText>
          <ThemedText type="subtitle">
            {`$${formateadorPrecio.format(publicacion.precio_renta)} al mes`}
          </ThemedText>
          <View style={estilos.direccion}>
            <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={estilos.textoDireccion}>
              {publicacion.direccion}
            </ThemedText>
          </View>
        </View>

        {/* Las condiciones, a un vistazo y en pastillas: no una tabla de campos. Cada una dice las dos cosas
            («Acepta mascotas» / «No acepta mascotas»); lo que no se cumple va atenuado, nunca omitido. */}
        <View style={estilos.pastillas}>
          <Pastilla icono="bed-outline" texto={`${publicacion.recamaras} ${publicacion.recamaras === 1 ? 'recámara' : 'recámaras'}`} />
          <Pastilla
            icono="paw-outline"
            texto={publicacion.permite_mascotas ? 'Acepta mascotas' : 'No acepta mascotas'}
            atenuada={!publicacion.permite_mascotas}
          />
          <Pastilla
            icono="home-outline"
            texto={publicacion.amueblado ? 'Amueblado' : 'Sin amueblar'}
            atenuada={!publicacion.amueblado}
          />
          <Pastilla
            icono="flash-outline"
            texto={publicacion.servicios_incluidos ? 'Servicios incluidos' : 'Servicios aparte'}
            atenuada={!publicacion.servicios_incluidos}
          />
          <Pastilla
            icono="walk-outline"
            texto={distanciaKm != null ? `A ${distanciaKm.toFixed(1)} km de tu universidad` : 'Distancia sin dato'}
            atenuada={distanciaKm == null}
          />
        </View>

        {afinidad?.scoreFinal != null ? <PorQueEsBuena razones={razones} /> : null}

        {/* 0071 · Explicable: se dice solo cuando de verdad se parece a algo que guardaste (coseno ≥ 0.70). */}
        {afinidad?.parecidoA ? (
          <ThemedText type="small" themeColor="textSecondary">
            Se parece a «{afinidad.parecidoA}», que guardaste en favoritos.
          </ThemedText>
        ) : null}

        {publicacion.descripcion ? (
          <Seccion titulo="Descripción">
            <ThemedText style={estilos.descripcion}>{publicacion.descripcion}</ThemedText>
          </Seccion>
        ) : null}

        <SeccionParecidas publicacionId={id} />

        {tieneUbicacion && (
          <Seccion titulo="Ubicación">
            <MapaUbicacion
              latitud={publicacion.latitud as number}
              longitud={publicacion.longitud as number}
              titulo={publicacion.titulo}
              direccion={publicacion.direccion}
            />
            {/* Obligación de atribución de la licencia ODbL (§9, AUD-02). No es
                decorativa: es la condición bajo la que podemos guardar estas
                coordenadas en la base. */}
            <ThemedText type="folio" themeColor="textSecondary">
              {ATRIBUCION_MAPA}
            </ThemedText>
          </Seccion>
        )}

        {/* Reseñas: el promedio lo calcula la base. El dueño de la vivienda responde pero no reseña lo suyo. */}
        <SeccionResenas
          objetivo={{ publicacionId: publicacion.id }}
          esDueno={publicacion.usuario_id === session?.user.id}
          calificacion={calificacion}
          numResenas={numResenas}
        />

        {/* Cuántas personas la guardaron: el número, nunca quién. */}
        <ConteoFavoritos publicacionId={publicacion.id} />

        {/* §28: esta app no verifica identidades. Decirlo es mejor ingeniería
            que fingir que el riesgo no existe. */}
        <View style={[estilos.advertencia, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={estilos.textoAdvertencia}>
            No adelantes dinero antes de visitar el lugar. Cuervo 360 no verifica la identidad de
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

    {/* Barra fija de contacto (propuesta visual del 17/10/2026): el corazón, «Escribir en la app» y «Ver contacto»
        no se pierden al desplazar y quedan al alcance del pulgar. Contactar DENTRO de la app es lo principal: la
        conversación se queda aquí, se puede moderar y no se expone ningún teléfono. «Ver contacto» (WhatsApp) es
        la segunda opción, con su cuota. Va fuera del ScrollView y no encima de él, así que no tapa contenido. */}
    <View
      testID="barra-contacto"
      style={[
        estilos.barraContacto,
        { backgroundColor: theme.backgroundElement, borderTopColor: theme.filete, paddingBottom: Math.max(insetInferior, Spacing.three) },
      ]}
    >
      <View style={estilos.filaContacto}>
        <BotonFavorito publicacionId={publicacion.id} />
        <View style={estilos.contacto}>
          <BotonEscribir otroUsuarioId={publicacion.usuario_id} />
        </View>
      </View>
      <BotonVerContacto
        publicacionId={publicacion.id}
        titulo={publicacion.titulo}
        score={afinidad?.scoreFinal ?? null}
        onRevelar={revelarContacto}
        onError={(mensaje) => toast.error(mensaje)}
      />
    </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  columna: { width: '100%', alignSelf: 'center' },
  esqueletoPantalla: { flex: 1 },
  esqueleto: { padding: Spacing.three },
  insignia: { alignSelf: 'flex-start', borderRadius: Radios.full, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
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
  },
  foto: { aspectRatio: 3 / 2 },
  sinFoto: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  foja: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.five,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  encabezadoFicha: { gap: Spacing.one },
  direccion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  textoDireccion: { flex: 1 },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // La hoja de contenido sube sobre la foto con las esquinas de arriba redondeadas (propuesta del 17/10/2026).
  cuerpo: { padding: Spacing.three, gap: Spacing.three, marginTop: -Spacing.four, borderTopLeftRadius: Radios.hojaInferior, borderTopRightRadius: Radios.hojaInferior },
  descripcion: { lineHeight: 24 },
  pantalla: { flex: 1 },
  barraContacto: { borderTopWidth: Filete.fino, paddingTop: Spacing.three, paddingHorizontal: Spacing.three, gap: Spacing.one },
  filaContacto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  contacto: { flex: 1 },
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
