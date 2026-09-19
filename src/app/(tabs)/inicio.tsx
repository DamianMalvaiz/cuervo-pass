import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { FichaPublicacion } from '@/components/FichaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { fechaHoraDeSello, folioDe } from '@/lib/folio';
import { obtenerSugerencias } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { PublicacionSugerida } from '@/types/database.types';

// Documento maestro v5 · §17, §18, §25.
//
// Esta pantalla ya NO calcula el score: `obtenerSugerencias` llama a las
// funciones de Postgres, que aplican el filtro DURO (presupuesto, distancia,
// mascotas) antes de ordenar. Lo que llega aquí ya es viable; la lista solo se
// reordena si el usuario elige otro criterio.

type Orden = 'recomendado' | 'cercano' | 'lejano' | 'precio_asc' | 'precio_desc';

const OPCIONES_ORDEN: { valor: Orden; etiqueta: string }[] = [
  { valor: 'recomendado', etiqueta: 'Recomendado' },
  { valor: 'cercano', etiqueta: 'Más cercano' },
  { valor: 'lejano', etiqueta: 'Más lejano' },
  { valor: 'precio_asc', etiqueta: 'Menor precio' },
  { valor: 'precio_desc', etiqueta: 'Mayor precio' },
];

// Botón y filas cumplen el mínimo de 44pt (WCAG 2.2 SC 2.5.8) y usan
// combobox/menu/menuitem con accessibilityValue, no "button" genérico.
function SelectorOrden({ valor, onCambiar }: { valor: Orden; onCambiar: (v: Orden) => void }) {
  const theme = useTheme();
  const [abierto, setAbierto] = useState(false);
  const etiquetaActual = OPCIONES_ORDEN.find((o) => o.valor === valor)?.etiqueta ?? '';

  return (
    <View style={[estilos.envolturaSelector, abierto && estilos.envolturaSelectorAbierta]}>
      <Pressable
        onPress={() => setAbierto((v) => !v)}
        style={[estilos.botonSelector, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        accessibilityRole="combobox"
        accessibilityLabel="Ordenar sugerencias"
        accessibilityValue={{ text: etiquetaActual }}
        accessibilityState={{ expanded: abierto }}
        hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      >
        <Ionicons name="swap-vertical" size={14} color={theme.text} />
        <ThemedText type="small" numberOfLines={1} style={estilos.textoSelector}>
          {etiquetaActual}
        </ThemedText>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
      </Pressable>

      {abierto && (
        // Sin sombra ni elevation: este mundo separa con filete, y Android pinta
        // `elevation` como una sombra gris que no pertenece a la hoja.
        <View
          style={[estilos.desplegable, { borderColor: theme.border, backgroundColor: theme.background }]}
          accessibilityRole="menu"
        >
          {OPCIONES_ORDEN.map((opcion, indice) => {
            const seleccionado = opcion.valor === valor;
            return (
              <Pressable
                key={opcion.valor}
                onPress={() => {
                  onCambiar(opcion.valor);
                  setAbierto(false);
                }}
                style={[
                  estilos.filaSelector,
                  seleccionado && { backgroundColor: theme.backgroundSelected },
                  indice < OPCIONES_ORDEN.length - 1 && {
                    borderBottomWidth: Filete.fino,
                    borderBottomColor: theme.filete,
                  },
                ]}
                accessibilityRole="menuitem"
                accessibilityLabel={opcion.etiqueta}
                accessibilityState={{ selected: seleccionado }}
              >
                <ThemedText type="small" themeColor={seleccionado ? 'text' : 'textSecondary'}>
                  {opcion.etiqueta}
                </ThemedText>
                {seleccionado && <Ionicons name="checkmark" size={16} color={theme.text} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * §18 — el encabezado del expediente.
 *
 * El nivel deja de ser una pastilla flotante y pasa a ser lo que un documento
 * pone arriba: qué es y cuántos registros trae. Poder decir "esto corre en Nivel
 * 2; si apago el contenedor sigue funcionando en Nivel 1" — y demostrarlo en
 * vivo — vale más que cualquier feature extra, y aquí se lee sin buscarlo.
 *
 * El nivel no se codifica con ÁMBAR: en esta pantalla no hay ninguna acción que
 * comprometa, así que no hay sello que gastar. El Nivel 2 se distingue por el
 * icono, por el texto y por el contraste pleno frente al tono secundario del
 * Nivel 1 — tres señales, ninguna dependiente solo del color.
 */
function EncabezadoExpediente({
  nivel,
  registros,
  emitido,
  orden,
  onCambiarOrden,
}: {
  nivel: 1 | 2;
  registros: number;
  /** Cuándo se consultó. Un expediente lleva su fecha de emisión, y aquí además
   *  dice qué tan fresca es la lista que se está viendo. */
  emitido: Date | null;
  orden: Orden;
  onCambiarOrden: (v: Orden) => void;
}) {
  const theme = useTheme();
  const esNivel2 = nivel === 2;

  return (
    <View style={estilos.encabezado}>
      <View style={estilos.filaEncabezado}>
        <View style={estilos.nivel}>
          <Ionicons
            name={esNivel2 ? 'sparkles' : 'options-outline'}
            size={14}
            color={esNivel2 ? theme.text : theme.textSecondary}
          />
          <ThemedText type="etiqueta" themeColor={esNivel2 ? 'text' : 'textSecondary'}>
            {esNivel2 ? 'NIVEL 2 · AFINIDAD SEMÁNTICA' : 'NIVEL 1 · FILTROS PONDERADOS'}
          </ThemedText>
        </View>
        <SelectorOrden valor={orden} onCambiar={onCambiarOrden} />
      </View>

      <ThemedText type="folio" themeColor="textSecondary">
        {registros === 1 ? '1 REGISTRO' : `${registros} REGISTROS`}
        {emitido ? ` · EMITIDO ${fechaHoraDeSello(emitido)}` : ''}
      </ThemedText>

      {/* El filete grueso cierra el encabezado, como la regla que separa el
          membrete del cuerpo en un formulario impreso. */}
      <View style={[estilos.filetePrincipal, { backgroundColor: theme.text }]} />
    </View>
  );
}

/** Un estado con forma de campo vacío del documento, no un párrafo suelto. */
function BloqueEstado({
  etiqueta,
  mensaje,
  icono,
}: {
  etiqueta: string;
  mensaje: string;
  icono: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <View
      style={[estilos.bloqueEstado, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={icono} size={22} color={theme.textSecondary} />
      <ThemedText type="etiqueta" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={estilos.mensajeEstado}>
        {mensaje}
      </ThemedText>
    </View>
  );
}

export default function InicioScreen() {
  const session = useAuthStore((s) => s.session);
  const [sugerencias, setSugerencias] = useState<PublicacionSugerida[]>([]);
  const [nivel, setNivel] = useState<1 | 2>(1);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<Orden>('recomendado');
  const [emitido, setEmitido] = useState<Date | null>(null);
  const theme = useTheme();

  const cargar = useCallback(async () => {
    // Sin sesión hay que APAGAR los indicadores igual. Antes esto salía con un
    // `return` seco antes del try/finally, así que `cargando` se quedaba en true
    // y la pantalla mostraba "CONSULTANDO EXPEDIENTE" para siempre.
    if (!session?.user.id) {
      setCargando(false);
      setRefrescando(false);
      return;
    }
    setError(null);
    try {
      const resultado = await obtenerSugerencias();
      setSugerencias(resultado.datos);
      setNivel(resultado.nivel);
      setEmitido(new Date());
    } catch (e) {
      // §27: nunca una pantalla en blanco. Se dice qué pasó y se ofrece
      // reintentar; "algo salió mal" no es un mensaje de error, es una forma de
      // no decir nada.
      console.warn('obtenerSugerencias falló:', e);
      setError('No pudimos consultar el expediente. Revisa tu conexión y desliza hacia abajo para reintentar.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const onRefrescar = useCallback(() => {
    setRefrescando(true);
    cargar();
  }, [cargar]);

  // AUD-08: una sola petición para todas las miniaturas visibles.
  const urlsFirmadas = useFotosFirmadas(sugerencias.map((s) => s.fotos?.[0]));

  // "Recomendado" ya viene ordenado por Postgres; las demás opciones son
  // reordenamientos directos sobre el MISMO conjunto, que ya pasó el filtro duro.
  const listaFinal = useMemo(() => {
    const sinDistanciaAlFinal = (a: PublicacionSugerida, b: PublicacionSugerida) => {
      if (a.distancia == null && b.distancia == null) return 0;
      if (a.distancia == null) return 1;
      if (b.distancia == null) return -1;
      return 0;
    };

    switch (orden) {
      case 'cercano':
        return [...sugerencias].sort((a, b) => sinDistanciaAlFinal(a, b) || (a.distancia ?? 0) - (b.distancia ?? 0));
      case 'lejano':
        return [...sugerencias].sort((a, b) => sinDistanciaAlFinal(a, b) || (b.distancia ?? 0) - (a.distancia ?? 0));
      case 'precio_asc':
        return [...sugerencias].sort((a, b) => a.precio_renta - b.precio_renta);
      case 'precio_desc':
        return [...sugerencias].sort((a, b) => b.precio_renta - a.precio_renta);
      case 'recomendado':
      default:
        return sugerencias;
    }
  }, [sugerencias, orden]);

  return (
    <ThemedView style={estilos.pantalla}>
      <EncabezadoExpediente
        nivel={nivel}
        registros={listaFinal.length}
        emitido={emitido}
        orden={orden}
        onCambiarOrden={setOrden}
      />

      {/* §27: un refresh que falla CON resultados ya en memoria mostraba datos
          viejos y ningún aviso. Silencioso es la peor forma de fallar, y más a
          media exposición. El aviso va aquí, sobre la lista, además del bloque
          que se pinta cuando la lista está vacía. */}
      {error && listaFinal.length > 0 && (
        <View style={[estilos.avisoError, { borderColor: theme.error, backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.error} />
          <ThemedText
            type="small"
            style={[{ color: theme.error }, estilos.textoAviso]}
            accessibilityLiveRegion="polite"
          >
            No pudimos actualizar. Estás viendo los últimos resultados cargados.
          </ThemedText>
        </View>
      )}

      {cargando ? (
        <View style={estilos.cargando}>
          <ActivityIndicator color={theme.textSecondary} />
          <ThemedText type="etiqueta" themeColor="textSecondary">
            CONSULTANDO EXPEDIENTE
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={listaFinal}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={onRefrescar}
              tintColor={theme.textSecondary}
              colors={[theme.textSecondary]}
            />
          }
          renderItem={({ item }) => (
            <FichaPublicacion
              titulo={item.titulo}
              precio={item.precio_renta}
              direccion={item.direccion}
              fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
              distanciaKm={item.distancia}
              score={item.score_final ?? item.score}
              tipo={item.tipo}
              permiteMascotas={item.permite_mascotas}
              amueblado={item.amueblado}
              folio={folioDe(item.id)}
              onPress={() =>
                // Se pasan los TRES valores, no solo el final: la ficha muestra
                // el desglose de cómo se compuso, y sin las partes no hay nada
                // que desglosar. La 0015 lo calcula como 0.6·filtros + 0.4·afinidad.
                //
                // En forma de objeto, no de cadena: las rutas tipadas de Expo
                // Router no pueden verificar una URL concatenada a mano.
                router.push({
                  pathname: '/publicacion/[id]',
                  params: {
                    id: item.id,
                    score: String(item.score_final ?? item.score),
                    base: String(item.score),
                    ...(item.similitud != null ? { sim: String(item.similitud) } : {}),
                  },
                })
              }
            />
          )}
          ListEmptyComponent={
            error ? (
              <BloqueEstado etiqueta="NO SE PUDO CONSULTAR" mensaje={error} icono="cloud-offline-outline" />
            ) : (
              <BloqueEstado
                etiqueta="SIN REGISTROS"
                mensaje="Ninguna publicación cumple tus filtros por ahora. Prueba ampliando el presupuesto o la distancia desde Mis preferencias."
                icono="document-outline"
              />
            )
          }
        />
      )}
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  encabezado: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.one,
    zIndex: 10,
  },
  filaEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nivel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  filetePrincipal: { height: Filete.grueso, marginTop: Spacing.two },
  lista: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  cargando: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two },
  avisoError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
  textoAviso: { flex: 1, lineHeight: 20 },
  bloqueEstado: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  mensajeEstado: { textAlign: 'center', lineHeight: 20 },
  envolturaSelector: { position: 'relative', zIndex: 1 },
  envolturaSelectorAbierta: { zIndex: 30 },
  botonSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.three,
    minHeight: 38,
    maxWidth: 170,
  },
  textoSelector: { flexShrink: 1, fontFamily: Tipografia.semibold },
  desplegable: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: Spacing.one,
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    overflow: 'hidden',
    minWidth: 168,
  },
  filaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
});
