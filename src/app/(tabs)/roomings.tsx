import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  guardarMiRooming,
  listarRoomingsActivos,
  obtenerMiRooming,
  type RoomingConUsuario,
} from '@/services/roomings.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Rooming } from '@/types/database.types';

// Sección 9/10: lista de "busco roomie" (orden por afinidad real llega en la
// Semana 10 con embeddings) + gestión del propio rooming — el doc no separa
// esto en una pantalla aparte, así que vive aquí, arriba de la lista.
export default function RoomingsScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const [roomings, setRoomings] = useState<RoomingConUsuario[]>([]);
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
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

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
          data={roomings}
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
