import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ANCHO_FICHA_COMPACTA, FichaCompacta } from '@/components/FichaCompacta';
import { FichaPublicacion } from '@/components/FichaPublicacion';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Carrusel } from '@/components/ficha/Carrusel';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTheme } from '@/hooks/use-theme';
import { fechaHoraDeSello, folioDe } from '@/lib/folio';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type { PublicacionSugerida } from '@/types/database.types';
import { useSugerencias } from '@/hooks/queries/usePublicaciones';

// Documento maestro v5 · §17, §18, §25.
//
// Esta pantalla ya NO calcula el score: `obtenerSugerencias` llama a las
// funciones de Postgres, que aplican el filtro DURO (presupuesto, distancia,
// mascotas) antes de ordenar. Lo que llega aquí ya es viable.
//
// La composición sigue el patrón de una pantalla de exploración: resumen de los
// filtros arriba, chips de categoría, y CARRUSELES que enseñan el mismo conjunto
// viable bajo tres lentes —afinidad, cercanía, precio— antes de la lista
// completa. El desplegable de orden que había antes desapareció: obligaba a
// elegir UNA lente y perder el sitio; ahora se ven las tres a la vez.

const TIPOS: { valor: string | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Todo' },
  { valor: 'depa', etiqueta: 'Departamento' },
  { valor: 'casa', etiqueta: 'Casa' },
  { valor: 'cuarto', etiqueta: 'Cuarto' },
];

const POR_CARRUSEL = 8;

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
        <ThemedText type="small" numberOfLines={1}>
          {partes.join(' · ')}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Chips de tipo. El estado activo no depende solo del color: cambia el filete,
 *  el fondo y el peso de la letra. */
function ChipsTipo({ valor, onCambiar }: { valor: string | null; onCambiar: (v: string | null) => void }) {
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

export default function InicioScreen() {
  const session = useAuthStore((s) => s.session);
  const cargarPerfil = usePerfilStore((s) => s.cargarPerfil);
  // El tope de presupuesto explica la holgura de cada ficha (END-30).
  const miPerfil = usePerfilStore((s) => s.perfil);
  // Dos números y no una bandera: en una misma lista conviven publicaciones
  // ordenadas por afinidad y publicaciones ordenadas solo por filtros (END-08).
  const [tipo, setTipo] = useState<string | null>(null);
  const theme = useTheme();
  const margenSuperior = useMargenSuperior();

  // END-18 · Toda la carga vive en el hook: caché, deduplicación, reintento con
  // backoff y el estado de error. Lo que había antes eran seis `useState` y un
  // `useFocusEffect` que reconsultaba el motor COMPLETO en cada regreso desde
  // el detalle, reemplazando el arreglo entero — parpadeo y pérdida del scroll.
  const { datos: sugerencias, conAfinidad, total, cargando, refrescando, fallo, refrescar, emitido } =
    useSugerencias(tipo);

  // El resumen de filtros necesita el perfil, y esta pantalla es la primera que
  // se abre tras entrar.
  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  // AUD-08: una sola petición para todas las miniaturas visibles.
  const { urls: urlsFirmadas } = useFotosFirmadas(sugerencias.map((s) => s.fotos?.[0]));

  // Ya NO se filtra en el cliente: el tipo entra en la clave de la consulta, así
  // que cada chip tiene su propia caché. Filtrar aquí sobre una página ya
  // truncada por el servidor es END-17, y era lo que hacía que la app dijera
  // «SIN REGISTROS DE ESE TIPO» habiendo cincuenta. El filtro real en Postgres
  // llega con B.3; mientras tanto, esto deja de mentir por su cuenta.
  const filtradas = sugerencias;

  // Tres lentes sobre el MISMO conjunto ya filtrado por el motor. No son
  // consultas distintas: reordenar en el cliente lo que Postgres ya declaró
  // viable es correcto, y pedir tres veces lo mismo al servidor no lo sería.
  const lentes = useMemo(() => {
    const conDistancia = filtradas.filter((p) => p.distancia != null);
    return {
      afinidad: filtradas.slice(0, POR_CARRUSEL),
      cercanas: [...conDistancia]
        .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0))
        .slice(0, POR_CARRUSEL),
      economicas: [...filtradas].sort((a, b) => a.precio_renta - b.precio_renta).slice(0, POR_CARRUSEL),
    };
  }, [filtradas]);

  const irADetalle = useCallback((item: PublicacionSugerida) => {
    router.push({
      pathname: '/publicacion/[id]',
      params: {
        id: item.id,
        score: String(item.score_final ?? item.score),
        base: String(item.score),
        ...(item.similitud != null ? { sim: String(item.similitud) } : {}),
      },
    });
  }, []);

  const compacta = useCallback(
    (item: PublicacionSugerida) => (
      <FichaCompacta
        titulo={item.titulo}
        precio={item.precio_renta}
        fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
        distanciaKm={item.distancia}
        score={item.score_final ?? item.score}
        onPress={() => irADetalle(item)}
      />
    ),
    [urlsFirmadas, irADetalle]
  );

  if (cargando) {
    return (
      <ThemedView style={[estilos.cargandoPantalla, { paddingTop: margenSuperior }]}>
        <ActivityIndicator color={theme.textSecondary} />
        <ThemedText type="etiqueta" themeColor="textSecondary">
          CONSULTANDO EXPEDIENTE
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={estilos.pantalla}>
      <FlatList
        data={filtradas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[estilos.lista, { paddingTop: margenSuperior }]}
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
            <View style={estilos.margen}>
              <Encabezado
                kicker={
                  // El conteo prueba que el motor corre y hasta dónde alcanza.
                  // Una bandera binaria solo lo afirmaba — y mentía cuando una
                  // sola publicación vectorizada la ponía en 2.
                  conAfinidad === 0
                    ? 'NIVEL 1 · FILTROS PONDERADOS'
                    : `NIVEL 2 · ${conAfinidad} DE ${total} CON AFINIDAD SEMÁNTICA`
                }
                titulo="Sugerencias"
                meta={
                  `${filtradas.length === 1 ? '1 REGISTRO' : `${filtradas.length} REGISTROS`}` +
                  (emitido ? ` · EMITIDO ${fechaHoraDeSello(emitido)}` : '')
                }
              />
              <ResumenFiltros />
            </View>

            <ChipsTipo valor={tipo} onCambiar={setTipo} />

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

            {filtradas.length > 0 && (
              <>
                <Carrusel
                  titulo="Mejor afinidad contigo"
                  descripcion={conAfinidad > 0 ? 'orden del motor' : 'filtros ponderados'}
                  datos={lentes.afinidad}
                  claveDe={(p) => `af-${p.id}`}
                  renderizar={compacta}
                  anchoItem={ANCHO_FICHA_COMPACTA}
                />
                <Carrusel
                  titulo="Más cerca de tu campus"
                  datos={lentes.cercanas}
                  claveDe={(p) => `ce-${p.id}`}
                  renderizar={compacta}
                  anchoItem={ANCHO_FICHA_COMPACTA}
                />
                <Carrusel
                  titulo="Las de menor renta"
                  datos={lentes.economicas}
                  claveDe={(p) => `ec-${p.id}`}
                  renderizar={compacta}
                  anchoItem={ANCHO_FICHA_COMPACTA}
                />

                <View style={[estilos.margen, estilos.tituloLista]}>
                  <ThemedText type="subtitle">Todas, en orden</ThemedText>
                  <View style={[estilos.fileteLista, { backgroundColor: theme.filete }]} />
                </View>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={estilos.margen}>
            <FichaPublicacion
              titulo={item.titulo}
              precio={item.precio_renta}
              direccion={item.direccion}
              fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
              distanciaKm={item.distancia}
              score={item.score_final ?? item.score}
              similitud={item.similitud}
              presupuestoMax={miPerfil?.presupuesto_max ?? null}
              tipo={item.tipo}
              permiteMascotas={item.permite_mascotas}
              amueblado={item.amueblado}
              folio={folioDe(item.id)}
              onPress={() => irADetalle(item)}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={estilos.separador} />}
        ListEmptyComponent={
          <View style={estilos.margen}>
            {fallo ? (
              <BloqueEstado etiqueta="NO SE PUDO CONSULTAR" mensaje={fallo} icono="cloud-offline-outline" tono="alerta" />
            ) : tipo ? (
              <BloqueEstado
                etiqueta="SIN REGISTROS DE ESE TIPO"
                mensaje="Ninguna publicación de esta categoría cumple tus filtros. Prueba con Todo."
                icono="funnel-outline"
              />
            ) : (
              <BloqueEstado
                etiqueta="SIN REGISTROS"
                mensaje="Ninguna publicación cumple tus filtros por ahora. Prueba ampliando el presupuesto o la distancia desde Tu búsqueda."
                icono="document-outline"
              />
            )}
          </View>
        }
      />
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cargandoPantalla: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
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
  fileteLista: { height: Filete.fino },
});
