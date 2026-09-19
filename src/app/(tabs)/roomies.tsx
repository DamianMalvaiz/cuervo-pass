import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Switch, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { FileteHoja } from '@/components/ficha/CampoFicha';
import { Encabezado } from '@/components/ficha/Encabezado';
import { TarjetaRoomie } from '@/components/TarjetaRoomie';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';
import { aviso } from '@/lib/registro';
import { useGuardarMiRoomie, useMiRoomie, useRoomiesSugeridos } from '@/hooks/queries/useRoomies';

// Documento maestro v5 · §11 (la tabla se llama `roomies`), §18, §25.
//
// El orden por afinidad ya no se arma en dos pasos desde el cliente: la función
// `sugerencias_roomies` devuelve la lista ordenada, con los datos públicos del
// dueño unidos. Aquí no hay "Nivel 1" de filtros duros —ambos lados ya buscan
// cerca de la misma universidad— así que el orden es directamente la similitud.
export default function RoomiesScreen() {
  const theme = useTheme();
  const margenSuperior = useMargenSuperior();
  const session = useAuthStore((s) => s.session);
  const [descripcion, setDescripcion] = useState('');
  const [buscoRoomie, setBuscoRoomie] = useState(false);

  // END-18 · Dos consultas separadas en vez de un `Promise.all` dentro de un
  // `useFocusEffect`. Guardar la ficha propia ya no obliga a volver a pedir la
  // lista de sugeridos, que es lo caro.
  const miId = session?.user.id;
  const { roomies, cargando } = useRoomiesSugeridos(Boolean(miId));
  const { miRoomie } = useMiRoomie(miId);
  const guardar = useGuardarMiRoomie(miId);
  const guardando = guardar.isPending;

  // Los campos del formulario se siembran desde la ficha guardada la primera
  // vez que llega, y NO en cada render: si no, escribir en el campo se
  // sobreescribiría con el valor del servidor en el siguiente refresco.
  const sembrado = useRef(false);
  useEffect(() => {
    if (sembrado.current || !miRoomie) return;
    sembrado.current = true;
    setDescripcion(miRoomie.descripcion_busqueda ?? '');
    setBuscoRoomie(miRoomie.estado === 'activo');
  }, [miRoomie]);

  const { urls: urlsFirmadas } = useFotosFirmadas(roomies.map((r) => r.foto_url));

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
    try {
      await guardar.mutateAsync({
        descripcionBusqueda: descripcion.trim() || 'Busco roomie.',
        estado: nuevoEstado ? 'activo' : 'cerrado',
      });
    } catch (e) {
      setBuscoRoomie(!nuevoEstado);
      Alert.alert(
        'No se pudo guardar',
        'Revisa tu conexión e intenta de nuevo. Si el problema sigue, puede faltar aplicar una migración de la base de datos.'
      );
      aviso('No se pudo guardar el roomie', undefined, e);
    }
  };

  const onGuardarDescripcion = async () => {
    if (!miId || !buscoRoomie || descripcion.trim().length < 10) return;
    // Guardar la descripción regenera el vector de búsqueda: si no, la afinidad
    // seguiría calculándose contra el texto anterior.
    await guardar.mutateAsync({ descripcionBusqueda: descripcion.trim(), estado: 'activo' });
  };

  const descripcionSinGuardar = (miRoomie?.descripcion_busqueda ?? '') !== descripcion;

  return (
    <ThemedView style={estilos.pantalla}>
      <FlatList
        data={roomies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[estilos.lista, { paddingTop: margenSuperior }]}
        showsVerticalScrollIndicator={false}
        // La ficha propia va como encabezado de la lista, no fija arriba: así se
        // puede recorrer la lista completa sin que ocupe un tercio de la pantalla
        // en un teléfono pequeño.
        ListHeaderComponent={
          <View style={estilos.encabezado}>
            <Encabezado
              kicker="REGISTRO DE ROOMIES"
              titulo="Roomies"
              descripcion="Personas que buscan con quién compartir, cerca de tu universidad."
            />

            <View style={[estilos.miFicha, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <View style={estilos.filaInterruptor}>
                <View style={estilos.textoInterruptor}>
                  <ThemedText type="etiqueta" themeColor="textSecondary">
                    TU FICHA DE ROOMIE
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={estilos.ayuda}>
                    Actívala para aparecer en esta lista para los demás.
                  </ThemedText>
                </View>
                <Switch
                  value={buscoRoomie}
                  onValueChange={onGuardarMiRoomie}
                  disabled={guardando}
                  accessibilityLabel="Buscar roomie"
                  trackColor={{ true: theme.text, false: theme.border }}
                  thumbColor={theme.background}
                  ios_backgroundColor={theme.border}
                />
              </View>

              {buscoRoomie && (
                <>
                  <FileteHoja />
                  <Campo
                    punteado
                    etiqueta="QUÉ BUSCAS"
                    placeholder="Zona, presupuesto, horarios, si fumas, si tienes mascota…"
                    multiline
                    maxLength={2000}
                    style={estilos.campoDescripcion}
                    value={descripcion}
                    onChangeText={setDescripcion}
                    onBlur={onGuardarDescripcion}
                  />
                  <View style={estilos.pieCampo}>
                    <ThemedText type="folio" themeColor="textSecondary">
                      {descripcion.length}/2000
                    </ThemedText>
                    {/* El estado se dice, no se adivina. Antes el aviso "se
                        guarda al salir del campo" aparecía siempre que hubiera
                        diferencia, sin distinguir entre "te falta guardar" y
                        "ya quedó". */}
                    <ThemedText type="small" themeColor={descripcionSinGuardar ? 'acento' : 'textSecondary'}>
                      {descripcionSinGuardar ? 'Sin guardar · se guarda al salir del campo' : 'Guardado'}
                    </ThemedText>
                  </View>
                </>
              )}
            </View>

            <ThemedText type="folio" themeColor="textSecondary">
              {roomies.length === 1 ? '1 PERSONA BUSCANDO' : `${roomies.length} PERSONAS BUSCANDO`}
            </ThemedText>
            <View style={[estilos.fileteLista, { backgroundColor: theme.filete }]} />
          </View>
        }
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
          cargando ? (
            <View style={estilos.cargando}>
              <ActivityIndicator color={theme.textSecondary} />
              <ThemedText type="etiqueta" themeColor="textSecondary">
                CONSULTANDO REGISTRO
              </ThemedText>
            </View>
          ) : (
            <BloqueEstado
              etiqueta="SIN REGISTROS"
              mensaje="Nadie está buscando roomie cerca de tu universidad por ahora. Activa tu ficha para que te encuentren a ti."
              icono="people-outline"
            />
          )
        }
      />
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  encabezado: { gap: Spacing.three, paddingBottom: Spacing.one },
  miFicha: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  filaInterruptor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  textoInterruptor: { flex: 1, gap: Spacing.half },
  ayuda: { lineHeight: 20 },
  campoDescripcion: { minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.three },
  pieCampo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  fileteLista: { height: Filete.fino },
  cargando: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two },
});
