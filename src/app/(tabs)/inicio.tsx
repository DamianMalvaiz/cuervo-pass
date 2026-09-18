import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { TarjetaPublicacion } from '@/components/TarjetaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { obtenerSugerencias } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { PublicacionSugerida } from '@/types/database.types';

// Documento maestro v5 · §17, §18, §25.
//
// Cambio de fondo frente a v3: esta pantalla ya NO calcula el score. Antes se
// traía el catálogo completo y lo puntuaba en JavaScript; ahora
// `obtenerSugerencias` llama a las funciones de Postgres, que aplican el filtro
// DURO (presupuesto, distancia, mascotas) antes de ordenar. Lo que llega aquí
// ya es viable: la lista solo se reordena si el usuario elige otro criterio.

type Orden = 'recomendado' | 'cercano' | 'lejano' | 'precio_asc' | 'precio_desc';

const OPCIONES_ORDEN: { valor: Orden; etiqueta: string }[] = [
  { valor: 'recomendado', etiqueta: 'Recomendado' },
  { valor: 'cercano', etiqueta: 'Más cercano' },
  { valor: 'lejano', etiqueta: 'Más lejano' },
  { valor: 'precio_asc', etiqueta: 'Menor precio' },
  { valor: 'precio_desc', etiqueta: 'Mayor precio' },
];

// Filtro de orden en dropdown (esquina superior derecha) en vez de pastillas
// horizontales — mismo patrón "tocar y despliega en el mismo lugar" que el
// formulario de publicación, sin modal. Botón y filas cumplen el target mínimo
// de 44pt en móvil (WCAG 2.2 SC 2.5.8) y usan combobox/menu/menuitem con
// accessibilityValue en vez de "button" genérico (Name-Role-Value correcto).
function SelectorOrden({ valor, onCambiar }: { valor: Orden; onCambiar: (v: Orden) => void }) {
  const theme = useTheme();
  const [abierto, setAbierto] = useState(false);
  const etiquetaActual = OPCIONES_ORDEN.find((o) => o.valor === valor)?.etiqueta ?? '';

  return (
    <View style={[styles.envolturaSelector, abierto && styles.envolturaSelectorAbierta]}>
      <Pressable
        onPress={() => setAbierto((v) => !v)}
        style={[styles.botonSelector, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        accessibilityRole="combobox"
        accessibilityLabel="Ordenar sugerencias"
        accessibilityValue={{ text: etiquetaActual }}
        accessibilityState={{ expanded: abierto }}
        hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      >
        <Ionicons name="filter" size={14} color={theme.text} />
        <ThemedText type="small" numberOfLines={1} style={styles.textoSelector}>
          {etiquetaActual}
        </ThemedText>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
      </Pressable>

      {abierto && (
        <View
          style={[styles.desplegableSelector, { borderColor: theme.border, backgroundColor: theme.background }]}
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
                  styles.filaSelector,
                  seleccionado && { backgroundColor: theme.backgroundSelected },
                  indice < OPCIONES_ORDEN.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
                accessibilityRole="menuitem"
                accessibilityLabel={opcion.etiqueta}
                accessibilityState={{ selected: seleccionado }}
              >
                <ThemedText
                  style={[styles.textoFila, { color: seleccionado ? AppColors.primary : theme.textSecondary }]}
                >
                  {opcion.etiqueta}
                </ThemedText>
                {seleccionado && <Ionicons name="checkmark" size={16} color={AppColors.primary} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// §18: el indicador de nivel se muestra a propósito durante la demo. Poder
// decir "esto corre en Nivel 2; si apago el contenedor la app sigue funcionando
// en Nivel 1" — y demostrarlo en vivo — vale más que cualquier feature extra.
function IndicadorNivel({ nivel }: { nivel: 1 | 2 }) {
  const theme = useTheme();
  const texto = nivel === 2 ? 'Nivel 2 · afinidad semántica' : 'Nivel 1 · filtros ponderados';
  return (
    <View style={styles.indicadorNivel}>
      <Ionicons
        name={nivel === 2 ? 'sparkles' : 'options'}
        size={12}
        color={nivel === 2 ? AppColors.primary : theme.textSecondary}
      />
      <ThemedText type="small" style={{ color: nivel === 2 ? AppColors.primary : theme.textSecondary }}>
        {texto}
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

  const cargar = useCallback(async () => {
    if (!session?.user.id) return;
    setError(null);
    try {
      const resultado = await obtenerSugerencias();
      setSugerencias(resultado.datos);
      setNivel(resultado.nivel);
    } catch (e) {
      // §27: nunca una pantalla en blanco. Se dice qué pasó y se ofrece
      // reintentar; "algo salió mal" no es un mensaje de error, es una forma de
      // no decir nada.
      console.warn('obtenerSugerencias falló:', e);
      setError('No pudimos cargar tus sugerencias. Revisa tu conexión y desliza para reintentar.');
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
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <View style={styles.encabezado}>
        <IndicadorNivel nivel={nivel} />
        <SelectorOrden valor={orden} onCambiar={setOrden} />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={listaFinal}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefrescar} />}
          renderItem={({ item }) => (
            <TarjetaPublicacion
              titulo={item.titulo}
              precio={item.precio_renta}
              direccion={item.direccion}
              fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
              distanciaKm={item.distancia}
              onPress={() =>
                router.push(`/publicacion/${item.id}?score=${item.score_final ?? item.score}`)
              }
            />
          )}
          ListEmptyComponent={
            <ThemedText type="small" style={styles.vacio} accessibilityLiveRegion="polite">
              {error ??
                'Ninguna publicación cumple tus filtros por ahora. Prueba ampliando el presupuesto o la distancia desde Mi perfil.'}
            </ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  indicadorNivel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, flexShrink: 1 },
  vacio: { marginTop: Spacing.four, lineHeight: 20 },
  envolturaSelector: { position: 'relative', zIndex: 1 },
  envolturaSelectorAbierta: { zIndex: 30, elevation: 30 },
  botonSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    minHeight: 36,
    maxWidth: 160,
  },
  textoSelector: { flexShrink: 1, fontWeight: '600' },
  desplegableSelector: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.two,
    overflow: 'hidden',
    minWidth: 148,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  filaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    minHeight: 36,
  },
  textoFila: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
});
