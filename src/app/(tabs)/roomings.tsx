import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  guardarMiRooming,
  listarRoomingsActivos,
  obtenerMiRooming,
  ordenarRoomingsPorSimilitud,
  type RoomingConUsuario,
} from '@/services/roomings.service';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';
import type { Rooming } from '@/types/database.types';

// Nivel 2 solo reordena dentro de este tope de candidatos (mismo patrón que
// inicio.tsx).
const TOPE_CANDIDATOS_NIVEL_2 = 30;

// Sección 9/10: lista de "busco roomie" ordenada por afinidad real (Semana
// 10, similitud de coseno entre perfiles — sin "Nivel 1" de filtros duros
// aquí, a diferencia de publicaciones: ambos ya buscan cerca de la misma
// universidad) + gestión del propio rooming — el doc no separa esto en una
// pantalla aparte, así que vive aquí, arriba de la lista.
export default function RoomingsScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const { perfil, cargarPerfil } = usePerfilStore();
  const [roomings, setRoomings] = useState<RoomingConUsuario[]>([]);
  const [ordenNivel2, setOrdenNivel2] = useState<string[] | null>(null);
  const [miRooming, setMiRooming] = useState<Rooming | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [buscoRoomie, setBuscoRoomie] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const miId = session?.user.id;
    if (!miId) return;
    setCargando(true);
    try {
      await cargarPerfil(miId);
      const [activos, propio] = await Promise.all([listarRoomingsActivos(miId), obtenerMiRooming(miId)]);
      setRoomings(activos);
      setMiRooming(propio);
      setDescripcion(propio?.descripcion_busqueda ?? '');
      setBuscoRoomie(propio?.estado === 'activo');
    } catch (e) {
      // Nunca dejar la pantalla en blanco/rota por un error de red o de una
      // migración pendiente — mostramos la lista vacía y seguimos.
      console.warn('No se pudieron cargar roomings:', e);
      setRoomings([]);
    } finally {
      setCargando(false);
    }
  }, [session?.user.id, cargarPerfil]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  // Si falla o no hay perfil_vector todavía, ordenNivel2 se queda null y se
  // usa el orden por fecha sin romper la lista (sección 17).
  useEffect(() => {
    if (typeof perfil?.perfil_vector !== 'string' || roomings.length === 0) return;
    let activo = true;
    const idsCandidatos = roomings.slice(0, TOPE_CANDIDATOS_NIVEL_2).map((r) => r.id);
    ordenarRoomingsPorSimilitud(perfil.perfil_vector, idsCandidatos).then((idsOrdenados) => {
      if (activo) setOrdenNivel2(idsOrdenados);
    });
    return () => {
      activo = false;
    };
  }, [perfil?.perfil_vector, roomings]);

  const roomingsOrdenados = useMemo(() => {
    if (typeof perfil?.perfil_vector !== 'string' || !ordenNivel2 || ordenNivel2.length === 0) return roomings;
    const porId = new Map(roomings.map((r) => [r.id, r]));
    const reordenados = ordenNivel2.map((id) => porId.get(id)).filter((r): r is RoomingConUsuario => r != null);
    const idsYaColocados = new Set(ordenNivel2);
    const resto = roomings.filter((r) => !idsYaColocados.has(r.id));
    return [...reordenados, ...resto];
  }, [roomings, ordenNivel2, perfil?.perfil_vector]);

  const onGuardarMiRooming = async (nuevoEstado: boolean) => {
    const miId = session?.user.id;
    if (!miId) return;
    setBuscoRoomie(nuevoEstado);
    setGuardando(true);
    try {
      const actualizado = await guardarMiRooming(miId, {
        descripcionBusqueda: descripcion,
        estado: nuevoEstado ? 'activo' : 'cerrado',
      });
      setMiRooming(actualizado);
    } catch (e) {
      setBuscoRoomie(!nuevoEstado);
      Alert.alert(
        'No se pudo guardar',
        'Revisa tu conexión e intenta de nuevo. Si el problema sigue, puede faltar aplicar una migración de la base de datos.'
      );
      console.warn('No se pudo guardar el rooming:', e);
    } finally {
      setGuardando(false);
    }
  };

  const onGuardarDescripcion = async () => {
    const miId = session?.user.id;
    if (!miId || !buscoRoomie) return;
    setGuardando(true);
    try {
      const actualizado = await guardarMiRooming(miId, { descripcionBusqueda: descripcion, estado: 'activo' });
      setMiRooming(actualizado);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Roomings</ThemedText>

      <View style={[styles.tarjetaMiRooming, { borderColor: theme.border }]}>
        <View style={styles.filaSwitch}>
          <ThemedText type="smallBold">¿Buscas roomie?</ThemedText>
          <Switch
            value={buscoRoomie}
            onValueChange={onGuardarMiRooming}
            disabled={guardando}
            accessibilityLabel="Buscar roomie"
          />
        </View>
        {buscoRoomie && (
          <>
            <TextInput
              style={[styles.inputDescripcion, { borderColor: theme.border, color: theme.text }]}
              placeholder="Cuenta qué buscas (zona, presupuesto, horarios...)"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Descripción de lo que buscas en un roomie"
              multiline
              value={descripcion}
              onChangeText={setDescripcion}
              onBlur={onGuardarDescripcion}
            />
            {miRooming?.descripcion_busqueda !== descripcion && (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Se guarda al salir del campo.
              </ThemedText>
            )}
          </>
        )}
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={roomingsOrdenados}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/perfil/${item.usuario_id}`)}
              style={styles.fila}
              accessibilityRole="button"
              accessibilityLabel={`Ver perfil de ${item.usuarios?.nombre_completo ?? 'usuario'}`}
            >
              {item.usuarios?.foto_url ? (
                <Image source={{ uri: item.usuarios.foto_url }} style={styles.foto} contentFit="cover" />
              ) : (
                <View style={[styles.foto, { backgroundColor: theme.backgroundSelected }]} />
              )}
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.usuarios?.nombre_completo ?? 'Usuario'}</ThemedText>
                {item.usuarios?.universidad && (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {item.usuarios.universidad}
                  </ThemedText>
                )}
                {item.descripcion_busqueda && (
                  <ThemedText type="small" numberOfLines={2}>
                    {item.descripcion_busqueda}
                  </ThemedText>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <ThemedText type="small" style={{ marginTop: Spacing.three }}>
              Aún no hay roomies buscando.
            </ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tarjetaMiRooming: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, marginVertical: Spacing.three, gap: Spacing.two },
  filaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputDescripcion: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.two, minHeight: 60, textAlignVertical: 'top' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, minHeight: 44 },
  foto: { width: 52, height: 52, borderRadius: 26 },
});
