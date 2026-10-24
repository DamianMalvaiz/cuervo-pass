import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ANCHO_FICHA_COMPACTA, FichaCompacta } from '@/components/FichaCompacta';
import { FilaPublicacion } from '@/components/FilaPublicacion';
import { CampanaAvisos } from '@/components/CampanaAvisos';
import { SelectorModulo } from '@/components/SelectorModulo';
import { VistaRoomies } from '@/components/vistas/VistaRoomies';
import { VistaServicios } from '@/components/vistas/VistaServicios';
import { useModuloStore } from '@/store/useModuloStore';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Carrusel } from '@/components/ficha/Carrusel';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMiniaturas } from '@/hooks/use-miniaturas';
import { ANCHOS } from '@/lib/miniaturas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { toque } from '@/lib/tacto';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type {
  OrdenSugerencias,
  PublicacionNueva,
  PublicacionSugerida,
  TipoPublicacion,
} from '@/types/database.types';
import { useDestacadas, useNuevas, useSugerencias } from '@/hooks/queries/usePublicaciones';

// Documento maestro v5 · §17, §18, §25.
//
// Esta pantalla ya NO calcula el score: `obtenerSugerencias` llama a las
// funciones de Postgres, que aplican el filtro DURO (presupuesto, distancia,
// mascotas) antes de ordenar. Lo que llega aquí ya es viable.
//
// END-32 · Había TRES carruseles y una lista, los cuatro sobre el mismo
// conjunto. El primero, «Mejor afinidad contigo», era `filtradas.slice(0, 8)`:
// un prefijo LITERAL de la lista que empezaba veinticuatro fichas más abajo. Los
// otros dos eran reordenamientos. Cuatro pinceladas del mismo contenido no son
// arquitectura de información, son indecisión renderizada.
//
// Se defendió aquí que tres lentes simultáneas eran mejores que un desplegable
// que «obliga a elegir UNA y perder el sitio». El argumento tenía un agujero:
// «Las de menor renta» ordenaba por precio el top-30 YA TRUNCADO por encaje, así
// que enseñaba las más baratas de las treinta que mejor encajan — no las más
// baratas. Una lente que miente no es una lente.
//
// Queda UN carrusel, con lo único que la lista no dice: lo reciente. Y un
// control de orden que reordena la lista en su sitio, aplicado en POSTGRES por
// la misma razón por la que el filtro de tipo se fue allí en B.3.

// El tipo del arreglo NO es `string | null`, y ese es el arreglo de fondo.
// Escrito como `string`, este chip decía `'casa'` —un valor que no existe en
// ninguna otra parte del proyecto: el formulario, el enum de zod, la ficha y el
// CHECK de la migración 0010 dicen todos `'casa_compartida'`— y nada se quejó
// nunca. Mientras el filtro corría en el cliente, el chip simplemente no
// coincidía con nada; al mandarlo al servidor habría devuelto vacío para
// siempre. Con `TipoPublicacion` el compilador lo atrapa.
const TIPOS: { valor: TipoPublicacion | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Todo' },
  { valor: 'depa', etiqueta: 'Departamento' },
  { valor: 'casa_compartida', etiqueta: 'Casa compartida' },
  { valor: 'cuarto', etiqueta: 'Cuarto' },
];

/** Por debajo de tres, el carrusel no se pinta: un carril con dos elementos es
 *  un hueco con título, y encima invita a deslizar algo que no se mueve. */
const MINIMO_CARRUSEL = 3;

/** Ocho filas es aproximadamente lo que cabe en una pantalla. Escalonar más allá
 *  de lo visible no escalona: retrasa. */
const TOPE_ESCALONADO = 8;


/**
 * El resumen de tus filtros, tocable.
 *
 * Airbnb pone aquí su búsqueda actual —dónde, cuándo, cuántos— y al tocarla la
 * edita. El equivalente honesto en este producto no es una caja de búsqueda por
 * texto, que no existe: son los filtros DUROS que deciden qué publicaciones
 * llegan siquiera a la lista. Enseñarlos evita la pregunta "¿por qué no aparece
 * tal departamento?" antes de que se formule.
 */
function ResumenFiltros() {
  const theme = useTheme();
  const perfil = usePerfilStore((s) => s.perfil);

  const partes = [
    perfil?.presupuesto_max != null
      ? `Hasta $${perfil.presupuesto_max.toLocaleString('es-MX')}`
      : 'Sin presupuesto',
    perfil?.distancia_max_km != null ? `${perfil.distancia_max_km} km` : 'Sin distancia',
    perfil?.universidad ?? 'Sin universidad',
  ];

  return (
    <Pressable
      onPress={() => router.push('/perfil/preferencias')}
      accessibilityRole="button"
      accessibilityLabel={`Ajustar tu búsqueda. Filtros actuales: ${partes.join(', ')}`}
      style={({ pressed }) => [
        estilos.pastilla,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && estilos.presionado,
      ]}
    >
      <Ionicons name="options-outline" size={18} color={theme.text} />
      <View style={estilos.textoPastilla}>
        <ThemedText type="etiqueta" themeColor="textSecondary">
          TU BÚSQUEDA
        </ThemedText>
        <ThemedText type="small" numberOfLines={2}>
          {partes.join(' · ')}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Chips de tipo. El estado activo no depende solo del color: cambia el filete,
 *  el fondo y el peso de la letra. */
function ChipsTipo({
  valor,
  onCambiar,
}: {
  valor: TipoPublicacion | null;
  onCambiar: (v: TipoPublicacion | null) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.tiraChips}
      accessibilityRole="tablist"
    >
      {TIPOS.map((t) => {
        const activo = valor === t.valor;
        return (
          <Pressable
            key={t.etiqueta}
            onPress={() => onCambiar(t.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={t.etiqueta}
            style={({ pressed }) => [
              estilos.chip,
              {
                borderColor: activo ? theme.text : theme.border,
                backgroundColor: activo ? theme.backgroundSelected : 'transparent',
              },
              pressed && estilos.presionado,
            ]}
          >
            <ThemedText type="small" style={activo ? estilos.chipActivo : undefined}>
              {t.etiqueta}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function VistaDepas({ selector, campana }: { selector?: ReactNode; campana?: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const cargarPerfil = usePerfilStore((s) => s.cargarPerfil);
  // Dos números y no una bandera: en una misma lista conviven publicaciones
  // ordenadas por afinidad y publicaciones ordenadas solo por filtros (END-08).
  const [tipo, setTipo] = useState<TipoPublicacion | null>(null);
  // El orden es AUTOMÁTICO: lo decide el servidor por compatibilidad y nadie lo elige (antes había un control «Ordenar por»).
  const orden: OrdenSugerencias = 'ajuste';
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const margenSuperior = useMargenSuperior();
  const reducido = useMovimientoReducido();

  // END-18 · Toda la carga vive en el hook: caché, deduplicación, reintento con
  // backoff y el estado de error. Lo que había antes eran seis `useState` y un
  // `useFocusEffect` que reconsultaba el motor COMPLETO en cada regreso desde
  // el detalle, reemplazando el arreglo entero — parpadeo y pérdida del scroll.
  const { datos: sugerencias, cargando, refrescando, fallo, refrescar } =
    useSugerencias(tipo, orden);

  // El resumen de filtros necesita el perfil, y esta pantalla es la primera que
  // se abre tras entrar.
  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  // END-32 · El único carrusel. No depende del orden de la lista: ordena por
  // fecha, que es lo suyo.
  const { datos: nuevas } = useNuevas(tipo);
  // Los destacados salen del PLAN del arrendador (0087): uno solo ya se pinta, porque no es relleno sino algo que se paga.
  const { datos: destacadas } = useDestacadas(tipo);

  // AUD-08: una sola petición para todas las miniaturas visibles, y las del
  // carrusel VAN INCLUIDAS. Firmarlas en dos llamadas separadas era el defecto
  // que AUD-08 vino a quitar, y un hook nuevo es justo donde se vuelve a colar.
  const { urls: urlsFirmadas } = useFotosFirmadas([
    ...sugerencias.map((s) => s.fotos?.[0]),
    ...nuevas.map((n) => n.fotos?.[0]),
    ...destacadas.map((d) => d.fotos?.[0]),
  ]);
  // Miniaturas (lib/miniaturas.ts): sin red, solo URLs con la sesión en cabeceras. La foto completa de arriba queda de respaldo.
  const miniaturasLista = useMiniaturas(sugerencias.map((s) => s.fotos?.[0]), ANCHOS.ancha);
  const miniaturasCarrusel = useMiniaturas([...nuevas, ...destacadas].map((n) => n.fotos?.[0]), ANCHOS.compacta);

  // B.3 · El filtro ya corre en Postgres, dentro de la función que trunca a
  // treinta, así que lo que llega aquí es el top-30 DE ESE TIPO y no lo que
  // quedó de filtrar el top-30 general. No hay nada que filtrar en el cliente:
  // el nombre se conserva porque media pantalla lo usa.
  const filtradas = sugerencias;

  // END-21 · Solo el id. La calificación viajaba por la URL, así que un enlace
  // directo a una ficha no la traía y el desglose desaparecía según por dónde
  // entraras; y ese valor acababa escrito en `contactos.score_mostrado`, o sea
  // que la métrica la suministraba el cliente. Ahora la ficha la pregunta.
  const irADetalle = useCallback((item: PublicacionSugerida) => {
    router.push({ pathname: '/publicacion/[id]', params: { id: item.id } });
  }, []);

  const compacta = useCallback(
    (item: PublicacionNueva, destacada = false) => (
      <FichaCompacta
        destacada={destacada}
        titulo={item.titulo}
        tipo={item.tipo}
        precio={item.precio_renta}
        fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
        fotoMini={miniaturasCarrusel(item.fotos?.[0])}
        distanciaKm={item.distancia}
        score={item.score}
        onPress={() => router.push({ pathname: '/publicacion/[id]', params: { id: item.id } })}
      />
    ),
    [urlsFirmadas, miniaturasCarrusel]
  );

  return (
    <ThemedView style={estilos.pantalla}>
      <FlatList
        data={filtradas}
        keyExtractor={(item) => item.id}
        // END-36 · La columna se ACOTA y se centra en pantallas amplias, no se
        // estira. `useTamanoPantalla` vivía en ocho formularios y en ninguna
        // pantalla de contenido, y `MaxContentWidth` tenía cero usos en todo el
        // código: un token muerto en el corazón del sistema visual.
        //
        // `width: '100%'` junto al `maxWidth` no sobra: sin él, un
        // contentContainer con `alignSelf: center` se encoge al ancho de su
        // contenido y la lista deja de ocupar el teléfono.
        contentContainerStyle={[estilos.lista, estilos.columna, { paddingTop: margenSuperior, maxWidth: anchoLista }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={theme.textSecondary}
            colors={[theme.textSecondary]}
          />
        }
        ListHeaderComponent={
          <View style={estilos.cabecera}>
            {selector ? <View style={estilos.margen}>{selector}</View> : null}
            <View style={estilos.margen}>
              <Encabezado titulo="Sugerencias" accion={campana} />
              <ResumenFiltros />
            </View>

            {/* El tacto va en el MANEJADOR y no dentro de los componentes:
                así los dos controles de esta pantalla responden igual, y
                `ChipsTipo` y `ControlOrden` siguen sin saber nada de tacto —
                que es lo que permite reutilizarlos sin arrastrar la vibración
                a sitios donde no toca. */}
            <ChipsTipo
              valor={tipo}
              onCambiar={(v) => {
                toque();
                setTipo(v);
              }}
            />

            {/* §27: un refresh fallido CON resultados en memoria mostraba datos
                viejos y ningún aviso. Silencioso es la peor forma de fallar. */}
            {fallo && filtradas.length > 0 && (
              <View style={[estilos.margen, estilos.avisoError, { borderColor: theme.error }]}>
                <Ionicons name="cloud-offline-outline" size={16} color={theme.error} />
                <ThemedText type="small" themeColor="error" style={estilos.textoAviso} accessibilityLiveRegion="polite">
                  No pudimos actualizar. Estás viendo los últimos resultados cargados.
                </ThemedText>
              </View>
            )}

            {destacadas.length > 0 && (
              <Carrusel
                titulo="Destacados cerca de ti"
                datos={destacadas}
                claveDe={(p) => `ds-${p.id}`}
                renderizar={(p) => compacta(p, true)}
                anchoItem={ANCHO_FICHA_COMPACTA}
              />
            )}

            {/* Lo ÚNICO que la lista de abajo no dice. Se pinta solo si hay
                al menos tres: un carril con dos es un hueco con título. */}
            {nuevas.length >= MINIMO_CARRUSEL && (
              <Carrusel
                titulo="Nuevas esta semana"
                descripcion="por fecha de publicación"
                datos={nuevas}
                claveDe={(p) => `nv-${p.id}`}
                renderizar={compacta}
                anchoItem={ANCHO_FICHA_COMPACTA}
              />
            )}

            {filtradas.length > 0 && (
              <View style={[estilos.margen, estilos.tituloLista]}>
                <ThemedText type="subtitle">
                  Todas las publicaciones
                </ThemedText>
                <View style={[estilos.fileteLista, { backgroundColor: theme.filete }]} />
              </View>
            )}
          </View>
        }
        // END-33 · Un renglón de tabla, no una tarjeta. La ficha grande mide
        // 420–450 px —una y media por pantalla— y PRODUCT.md dice que esto
        // ordena por AJUSTE. El ajuste se evalúa comparando, y comparar exige
        // ver varias opciones a la vez. `FichaPublicacion` se conserva para
        // «Mis publicaciones», donde la pregunta es «cómo va la mía» y no
        // «cuál de estas».
        renderItem={({ item, index }) => (
          // END-37 · Entrada escalonada, con TOPE. Sin él, la fila treinta
          // esperaría 900 ms y la lista parecería cargar en cascada eterna; con
          // tope de ocho, lo último entra a 210 ms y el escalonado se percibe
          // igual. Ocho es aproximadamente lo que cabe en pantalla: escalonar lo
          // que nadie está viendo no escalona nada, solo retrasa.
          //
          // `reducido !== false` cubre el «todavía no sé» (D.8).
          <Animated.View
            style={estilos.margen}
            entering={
              reducido !== false
                ? undefined
                : FadeInDown.delay(Math.min(index, TOPE_ESCALONADO - 1) * 30).duration(220)
            }
          >
            <FilaPublicacion
              publicacionId={item.id}
              titulo={item.titulo}
              tipo={item.tipo}
              precio={item.precio_renta}
              fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
              fotoMini={miniaturasLista(item.fotos?.[0])}
              distanciaKm={item.distancia}
              onPress={() => irADetalle(item)}
            />
          </Animated.View>
        )}
        // Sin separador: la fila ya trae su filete inferior, y dos líneas
        // juntas se leen como un error de impresión.
        ItemSeparatorComponent={null}
        ListEmptyComponent={
          // El esqueleto va DENTRO de la lista, no en lugar de la pantalla. El
          // encabezado, el resumen de filtros y los chips siguen ahí y siguen
          // siendo tocables: se puede cambiar de tipo mientras carga.
          cargando ? (
            <View style={estilos.margen}>
              <ListaEsqueleto filas={5} />
            </View>
          ) : (
          <View style={estilos.margen}>
            {fallo ? (
              <BloqueEstado etiqueta="No se pudo consultar" mensaje={fallo} icono="cloud-offline-outline" tono="alerta" />
            ) : tipo ? (
              <BloqueEstado
                etiqueta="Sin resultados de ese tipo"
                mensaje="Ninguna publicación de esta categoría cumple tus filtros. Prueba con Todo."
                icono="funnel-outline"
              />
            ) : (
              <BloqueEstado
                etiqueta="Sin resultados"
                mensaje="Ninguna publicación cumple tus filtros por ahora. Prueba ampliando el presupuesto o la distancia desde Tu búsqueda."
                icono="document-outline"
              />
            )}
          </View>
          )
        }
      />
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  columna: { width: '100%', alignSelf: 'center' },
  pantalla: { flex: 1 },
  lista: { paddingBottom: Spacing.six },
  // El margen va POR BLOQUE, no en el contenedor: los carruseles tienen que
  // poder sangrar hasta el borde de la pantalla para que se vea que siguen.
  margen: { paddingHorizontal: Spacing.three },
  cabecera: { gap: Spacing.four, paddingBottom: Spacing.four },
  separador: { height: Spacing.three },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 60,
    marginTop: Spacing.three,
  },
  textoPastilla: { flex: 1, gap: Spacing.half },
  presionado: { opacity: 0.6 },
  tiraChips: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  chip: {
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActivo: Texto.pesoFuerte,
  avisoError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
  textoAviso: { flex: 1, lineHeight: 20 },
  tituloLista: { gap: Spacing.two },
  filaOrden: { gap: Spacing.one },
  opcionesOrden: { flexDirection: 'row', gap: Spacing.four },
  // 44 pt de alto contando el filete: el objetivo táctil no se negocia porque el
  // control sea visualmente ligero (invariante 8).
  opcionOrden: { minHeight: 44, justifyContent: 'center', gap: Spacing.half },
  ordenActivo: Texto.pesoFuerte,
  fileteOrden: { height: Filete.grueso },
  fileteLista: { height: Filete.fino },
});

/**
 * Inicio reúne los módulos · Cuervo 360. Depas, Roomies y Servicios.
 *
 * Roomies dejó de ser una pestaña: el menú es de cinco accesos. Cada vista pinta el selector
 * arriba de su propio encabezado, así comparte el margen superior y el desplazamiento.
 */
export default function InicioScreen() {
  const modulo = useModuloStore((s) => s.modulo);
  const setModulo = useModuloStore((s) => s.setModulo);
  // El selector tiene su PROPIA fila a todo el ancho: con la campana al lado, «Roomies» y «Servicios» se partían en dos renglones (probado en un
  // teléfono real el 24/10/2026). La campana va con el título de cada vista.
  const selector = (
    <View testID="fila-selector">
      <SelectorModulo valor={modulo} onCambiar={setModulo} />
    </View>
  );
  const campana = <CampanaAvisos />;
  if (modulo === 'roomies') return <VistaRoomies selector={selector} campana={campana} />;
  if (modulo === 'servicios') return <VistaServicios selector={selector} campana={campana} />;
  return <VistaDepas selector={selector} campana={campana} />;
}
