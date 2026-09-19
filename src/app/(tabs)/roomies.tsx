import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Switch, TextInput, View } from 'react-native';

import { TarjetaRoomie } from '@/components/TarjetaRoomie';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { guardarMiRoomie, listarRoomiesSugeridos, obtenerMiRoomie } from '@/services/roomies.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { Roomie, RoomieSugerido } from '@/types/database.types';

// Documento maestro v5 · §11 (la tabla se llama `roomies`), §18, §25.
//
// El orden por afinidad ya no se arma en dos pasos desde el cliente: la función
// `sugerencias_roomies` devuelve la lista ordenada, con los datos públicos del
// dueño unidos. Aquí no hay "Nivel 1" de filtros duros —ambos lados ya buscan
// cerca de la misma universidad— así que el orden es directamente la similitud.
export default function RoomiesScreen() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const [roomies, setRoomies] = useState<RoomieSugerido[]>([]);
  const [miRoomie, setMiRoomie] = useState<Roomie | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [buscoRoomie, setBuscoRoomie] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const miId = session?.user.id;
    if (!miId) return;
    setCargando(true);
    try {
      const [sugeridos, propio] = await Promise.all([listarRoomiesSugeridos(), obtenerMiRoomie(miId)]);
      setRoomies(sugeridos);
      setMiRoomie(propio);
      setDescripcion(propio?.descripcion_busqueda ?? '');
      setBuscoRoomie(propio?.estado === 'activo');
    } catch (e) {
      // Nunca dejar la pantalla rota por un error de red o una migración
      // pendiente — se muestra la lista vacía y se sigue.
      console.warn('No se pudieron cargar los roomies:', e);
      setRoomies([]);
    } finally {
      setCargando(false);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const urlsFirmadas = useFotosFirmadas(roomies.map((r) => r.foto_url));

  const onGuardarMiRoomie = async (nuevoEstado: boolean) => {
    const miId = session?.user.id;
    if (!miId) return;
    if (nuevoEstado && descripcion.trim().length < 10) {
      Alert.alert(
        'Falta tu descripción',
        'Escribe qué buscas antes de activar la búsqueda: es lo que usamos para ordenar tu lista por afinidad.'
      );
      return;
    }
    setBuscoRoomie(nuevoEstado);
    setGuardando(true);
    try {
      const actualizado = await guardarMiRoomie(miId, {
        descripcionBusqueda: descripcion.trim() || 'Busco roomie.',
        estado: nuevoEstado ? 'activo' : 'cerrado',
      });
      setMiRoomie(actualizado);
    } catch (e) {
      setBuscoRoomie(!nuevoEstado);
      Alert.alert(
        'No se pudo guardar',
        'Revisa tu conexión e intenta de nuevo. Si el problema sigue, puede faltar aplicar una migración de la base de datos.'
      );
      console.warn('No se pudo guardar el roomie:', e);
    } finally {
      setGuardando(false);
    }
  };

  const onGuardarDescripcion = async () => {
    const miId = session?.user.id;
    if (!miId || !buscoRoomie || descripcion.trim().length < 10) return;
    setGuardando(true);
    try {
      // Guardar la descripción regenera el vector de búsqueda: si no, la
      // afinidad seguiría calculándose contra el texto anterior.
      const actualizado = await guardarMiRoomie(miId, {
        descripcionBusqueda: descripcion.trim(),
        estado: 'activo',
      });
      setMiRoomie(actualizado);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, padding: Spacing.three }}>
      <ThemedText type="title">Roomies</ThemedText>

      <View style={[styles.tarjetaMiRoomie, { borderColor: theme.border }]}>
        <View style={styles.filaSwitch}>
          <ThemedText type="smallBold">¿Buscas roomie?</ThemedText>
          <Switch
            value={buscoRoomie}
            onValueChange={onGuardarMiRoomie}
            disabled={guardando}
            accessibilityLabel="Buscar roomie"
          />
        </View>
        <TextInput
          style={[styles.inputDescripcion, { borderColor: theme.border, color: theme.text }]}
          placeholder="Cuenta qué buscas (zona, presupuesto, horarios...)"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Descripción de lo que buscas en un roomie"
          multiline
          maxLength={2000}
          value={descripcion}
          onChangeText={setDescripcion}
          onBlur={onGuardarDescripcion}
        />
        {miRoomie?.descripcion_busqueda !== descripcion && (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Se guarda al salir del campo.
          </ThemedText>
        )}
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: Spacing.four }} />
      ) : (
        <FlatList
          data={roomies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TarjetaRoomie
              nombreUsuario={item.nombre_completo}
              descripcionBusqueda={item.descripcion_busqueda}
              fotoUrl={item.foto_url ? urlsFirmadas.get(item.foto_url) : null}
              afinidad={item.similitud}
              onPress={() => router.push(`/perfil/${item.usuario_id}`)}
            />
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
  tarjetaMiRoomie: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
    marginVertical: Spacing.three,
    gap: Spacing.two,
  },
  filaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputDescripcion: {
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.two,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
