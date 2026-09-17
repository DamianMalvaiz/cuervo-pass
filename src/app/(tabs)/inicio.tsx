import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { TarjetaPublicacion } from '@/components/TarjetaPublicacion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calcularDistanciaKm } from '@/lib/distancia';
import { calcularScore } from '@/lib/scoring';
import { listarPublicacionesActivas, ordenarPorSimilitud } from '@/services/publicaciones.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type { Publicacion } from '@/types/database.types';

// Nivel 2 solo reordena dentro de este tope de candidatos que ya pasaron
// Nivel 1 (sección 15: "aplicada solo al subconjunto que ya pasó el Nivel 1").
const TOPE_CANDIDATOS_NIVEL_2 = 30;

interface PublicacionSugerida extends Publicacion {
  distanciaKm?: number;
  score: number;
}

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

// "Recomendado" combina Nivel 1 (sección 14: distancia + presupuesto +
// compatibilidad + frescura, filtros ponderados en src/lib/scoring.ts) con
// Nivel 2 (sección 15: similitud de coseno con pgvector) — Nivel 1 decide QUÉ
// es viable, Nivel 2 reordena ESO por significado. Ninguno se muestra como
// número, solo ordenan. Las demás opciones son ordenamientos directos.
export default function InicioScreen() {
  const session = useAuthStore((s) => s.session);
  const { perfil, cargarPerfil } = usePerfilStore();
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [orden, setOrden] = useState<Orden>('recomendado');
  const [ordenNivel2, setOrdenNivel2] = useState<string[] | null>(null);

  const cargar = useCallback(async () => {
    if (!session?.user.id) return;
    setCargando(true);
    try {
      await cargarPerfil(session.user.id);
      const activas = await listarPublicacionesActivas();
      setPublicaciones(activas.filter((p) => p.usuario_id !== session.user.id));
    } finally {
      setCargando(false);
    }
  }, [session?.user.id, cargarPerfil]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const sugerencias = useMemo(() => {
    const conDatos: PublicacionSugerida[] = publicaciones.map((p) => {
      const distanciaKm =
        perfil?.latitud_universidad != null && perfil?.longitud_universidad != null && p.latitud != null && p.longitud != null
          ? calcularDistanciaKm(perfil.latitud_universidad, perfil.longitud_universidad, p.latitud, p.longitud)
          : undefined;
      return { ...p, distanciaKm, score: calcularScore(p, perfil, distanciaKm ?? null) };
    });

    const sinDistanciaAlFinal = (a: PublicacionSugerida, b: PublicacionSugerida) => {
      if (a.distanciaKm == null && b.distanciaKm == null) return 0;
      if (a.distanciaKm == null) return 1;
      if (b.distanciaKm == null) return -1;
      return 0;
    };

    switch (orden) {
      case 'cercano':
        return [...conDatos].sort((a, b) => sinDistanciaAlFinal(a, b) || (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0));
      case 'lejano':
        return [...conDatos].sort((a, b) => sinDistanciaAlFinal(a, b) || (b.distanciaKm ?? 0) - (a.distanciaKm ?? 0));
      case 'precio_asc':
        return [...conDatos].sort((a, b) => a.precio_renta - b.precio_renta);
      case 'precio_desc':
        return [...conDatos].sort((a, b) => b.precio_renta - a.precio_renta);
      case 'recomendado':
      default:
        return [...conDatos].sort((a, b) => b.score - a.score);
    }
  }, [publicaciones, perfil, orden]);

  // Nivel 2: solo aplica sobre "Recomendado", solo si el perfil ya tiene
  // embedding (perfil_vector se genera en el cuestionario inicial, Semana 9 —
  // puede no existir si el microservicio falló en ese momento). Si la llamada
  // falla o no hay vector, ordenNivel2 se queda null y se usa solo Nivel 1
  // (nunca rompe las sugerencias, sección 17).
  useEffect(() => {
    // No hay nada que pedir — ordenNivel2 simplemente no se usa mientras estas
    // condiciones no se cumplan (ver listaFinal), así que no hace falta
    // resetearlo con un setState síncrono aquí (evita renders en cascada). Si
    // vuelve a cumplirse la condición más tarde, esta misma rama de abajo pide
    // un ordenNivel2 fresco.
    if (orden !== 'recomendado' || typeof perfil?.perfil_vector !== 'string' || sugerencias.length === 0) return;
    let activo = true;
    const idsCandidatos = sugerencias.slice(0, TOPE_CANDIDATOS_NIVEL_2).map((s) => s.id);
    ordenarPorSimilitud(perfil.perfil_vector as string, idsCandidatos).then((idsOrdenados) => {
      if (activo) setOrdenNivel2(idsOrdenados);
    });
    return () => {
      activo = false;
    };
  }, [orden, perfil?.perfil_vector, sugerencias]);

  const listaFinal = useMemo(() => {
    if (orden !== 'recomendado' || typeof perfil?.perfil_vector !== 'string' || !ordenNivel2 || ordenNivel2.length === 0) {
      return sugerencias;
    }
    const porId = new Map(sugerencias.map((s) => [s.id, s]));
    const reordenados = ordenNivel2.map((id) => porId.get(id)).filter((s): s is PublicacionSugerida => s != null);
    const idsYaColocados = new Set(ordenNivel2);
    const resto = sugerencias.filter((s) => !idsYaColocados.has(s.id));
    return [...reordenados, ...resto];
  }, [sugerencias, ordenNivel2, orden, perfil?.perfil_vector]);

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <View style={styles.encabezado}>
        <SelectorOrden valor={orden} onCambiar={setOrden} />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={listaFinal}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TarjetaPublicacion
              precio={item.precio_renta}
              direccion={item.direccion}
              fotoUrl={item.fotos?.[0]}
              distanciaKm={item.distanciaKm}
              onPress={() => router.push(`/publicacion/${item.id}?score=${item.score}`)}
            />
          )}
          ListEmptyComponent={
            <ThemedText type="small" style={{ marginTop: Spacing.four }}>
              Aún no hay publicaciones de otros usuarios para sugerir.
            </ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', justifyContent: 'flex-end' },
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
