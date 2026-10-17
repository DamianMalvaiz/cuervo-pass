import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { Campo } from '@/components/Campo';
import { CampoFicha, FileteHoja } from '@/components/ficha/CampoFicha';
import { SeccionFunciones } from '@/components/SeccionFunciones';
import { useModuloStore } from '@/store/useModuloStore';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Seccion } from '@/components/ficha/Seccion';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTheme } from '@/hooks/use-theme';
import { avisarPermisoDeFotosDenegado } from '@/lib/permisos';
import { subirFotoPerfil } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { eliminarMiCuenta, exportarMisDatos } from '@/services/usuarios.service';
import { useMiRoomie } from '@/hooks/queries/useRoomies';
import { useMisPublicaciones } from '@/hooks/queries/usePublicaciones';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Documento maestro v5 · §25 y §29 (derechos ARCO).
export default function PerfilScreen() {
  const theme = useTheme();
  const margenSuperior = useMargenSuperior();
  const { anchoContenido, clase } = useTamanoPantalla();
  const session = useAuthStore((s) => s.session);
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const { perfil, cargando, cargarPerfil, actualizarPerfil } = usePerfilStore();
  // La ficha de roomie, para poder decir la VERDAD sobre si apareces en esa
  // lista. Es una consulta más y va con su propia clave: si falla, el resto del
  // perfil se pinta igual y el campo cae a «No», que es lo que se ve desde
  // fuera cuando no hay ficha.
  const { miRoomie } = useMiRoomie(session?.user.id);
  // Solo para el conteo del acceso a «Mis publicaciones». La consulta ya está
  // cacheada por react-query: la pestaña de publicaciones usa la misma clave.
  const { datos: misPublicaciones, cargando: cargandoPublicaciones } = useMisPublicaciones(session?.user.id);

  const [biografia, setBiografia] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza el borrador local con el perfil cargado, sin useEffect: React
  // recomienda "ajustar estado durante el render" para este caso exacto
  // (un valor que llega async y debe resetear un draft editable).
  const [biografiaSincronizada, setBiografiaSincronizada] = useState<string | null | undefined>(undefined);
  if (perfil?.biografia !== biografiaSincronizada) {
    setBiografiaSincronizada(perfil?.biografia);
    setBiografia(perfil?.biografia ?? '');
  }

  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  // El bucket es privado (§14): `foto_url` guarda una ruta, y para mostrarla
  // hay que firmarla.
  const { urls: urlsFirmadas } = useFotosFirmadas([perfil?.foto_url]);
  const urlFoto = perfil?.foto_url ? urlsFirmadas.get(perfil.foto_url) : null;

  const onCambiarFoto = async () => {
    if (!session?.user.id) return;
    setError(null);
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      // En la ficha Y como aviso: el texto de la ficha puede estar fuera de la
      // vista si se ha deslizado. Con «Ajustes» cuando el sistema ya no volverá a
      // preguntar.
      setError(avisarPermisoDeFotosDenegado(permiso.canAskAgain));
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      aspect: [1, 1],
      allowsEditing: true,
    });
    if (resultado.canceled) return;

    setSubiendoFoto(true);
    try {
      const ruta = await subirFotoPerfil(session.user.id, resultado.assets[0].uri);
      await actualizarPerfil(session.user.id, { foto_url: ruta });
      toast.exito('Foto actualizada');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo subir la foto';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const onGuardarBiografia = async () => {
    if (!session?.user.id) return;
    setError(null);
    setGuardando(true);
    try {
      await actualizarPerfil(session.user.id, { biografia });
      // Dentro del `try`, para que un fallo no dé también el aviso de éxito.
      toast.exito('Biografía guardada');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo guardar la biografía';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  // ACCESO (§29). Se comparte como texto en vez de escribir un archivo: la app
  // no tiene todavía una dependencia de sistema de archivos, y el volumen de
  // datos de un usuario cabe de sobra. Si algún día no cabe, el cambio es
  // expo-file-system aquí, no en la función de Postgres.
  const onDescargarMisDatos = async () => {
    setExportando(true);
    try {
      const datos = await exportarMisDatos();
      await Share.share({
        title: 'Mis datos en Cuervo Pass',
        message: JSON.stringify(datos, null, 2),
      });
    } catch (e) {
      Alert.alert('No se pudieron exportar tus datos', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  };

  // CANCELACIÓN (§29). Irreversible y en cascada: por eso se confirma dos veces
  // y se dice exactamente qué desaparece.
  const onEliminarCuenta = () => {
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borran tu perfil, tus publicaciones, tus fotos y tus mensajes. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarMiCuenta();
              router.replace('/(auth)/login');
            } catch (e) {
              Alert.alert('No se pudo eliminar la cuenta', e instanceof Error ? e.message : 'Intenta de nuevo.');
            }
          },
        },
      ]
    );
  };

  const onCerrarSesion = async () => {
    await cerrarSesion();
    router.replace('/(auth)/login');
  };

  if (cargando) {
    // END-38 · La forma de lo que viene, no un punto girando. Aquí el esqueleto
    // lleva las etiquetas reales de la ficha de búsqueda: se saben antes de
    // preguntar, y pintarlas en gris haría la espera más pobre sin ganar nada.
    return (
      <ThemedView style={estilos.pantalla}>
        <ScrollView
          contentContainerStyle={[
            estilos.desplazable,
            { paddingTop: margenSuperior },
            clase === 'amplia' && estilos.centradoAmplio,
          ]}
        >
          <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
            <ListaEsqueleto
              variante="hoja"
              filas={1}
              conFoto={false}
              etiquetas={['PRESUPUESTO MENSUAL', 'DISTANCIA MÁXIMA']}
            />
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const folio = (perfil?.id ?? '').replace(/-/g, '').slice(0, 4).toUpperCase();
  // La verdad sobre si apareces en la lista de roomies: la fila de `roomies`,
  // no el booleano del cuestionario.
  const apareceEnRoomies = miRoomie?.estado === 'activo';
  // Se dice cuántas y cuántas ACTIVAS: publicar y estar visible no es lo
  // mismo, y una desactivada que uno cree publicada es de las cosas que se
  // descubren tarde.
  const activas = misPublicaciones.filter((p) => p.activa).length;
  const descripcionPublicaciones = cargandoPublicaciones
    ? 'Consultando…'
    : misPublicaciones.length === 0
      ? 'Todavía no has publicado ninguna.'
      : `${misPublicaciones.length} publicada${misPublicaciones.length === 1 ? '' : 's'} · ${activas} activa${activas === 1 ? '' : 's'}`;
  const biografiaCambiada = biografia !== (perfil?.biografia ?? '');
  const presupuesto =
    perfil?.presupuesto_min != null && perfil?.presupuesto_max != null
      ? `$${perfil.presupuesto_min.toLocaleString('es-MX')} – $${perfil.presupuesto_max.toLocaleString('es-MX')}`
      : 'sin definir';

  return (
    <ThemedView style={estilos.pantalla}>
      <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            estilos.desplazable,
            { paddingTop: margenSuperior },
            clase === 'amplia' && estilos.centradoAmplio,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
            {/* ── Identidad ────────────────────────────────────────────── */}
            <View style={estilos.identidad}>
              <Pulsable
                onPress={onCambiarFoto}
                disabled={subiendoFoto}
                accessibilityRole="button"
                accessibilityLabel={urlFoto ? 'Cambiar tu foto de perfil' : 'Agregar una foto de perfil'}
                accessibilityState={{ busy: subiendoFoto }}
                style={estilos.envolturaFoto}
              >
                {urlFoto ? (
                  <Image source={{ uri: urlFoto }} style={[estilos.foto, { borderColor: theme.filete }]} />
                ) : (
                  <View
                    style={[
                      estilos.foto,
                      estilos.sinFoto,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons name="person-outline" size={34} color={theme.textSecondary} />
                  </View>
                )}
                {/* La afordancia va SOBRE la foto, no como texto debajo: ahí es
                    donde la mano espera encontrarla. */}
                <View style={[estilos.insigniaCamara, { backgroundColor: theme.bosque, borderColor: theme.background }]}>
                  {subiendoFoto ? (
                    <ActivityIndicator size="small" color={theme.bosqueTexto} />
                  ) : (
                    <Ionicons name="camera" size={16} color={theme.bosqueTexto} />
                  )}
                </View>
              </Pulsable>

              <View style={estilos.datosIdentidad}>
                <ThemedText type="folio" themeColor="textSecondary">
                  EXPEDIENTE {folio}
                </ThemedText>
                <ThemedText type="subtitle" numberOfLines={2}>
                  {perfil?.nombre_completo ?? 'Sin nombre'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  @{perfil?.nombre_usuario ?? '—'}
                </ThemedText>
                {perfil?.universidad ? (
                  <View style={estilos.universidad}>
                    <Ionicons name="school-outline" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={estilos.flexible}>
                      {perfil.universidad}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[estilos.filetePrincipal, { backgroundColor: theme.text }]} />

            {error && (
              <View style={[estilos.errorBloque, { borderColor: theme.error }]}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
                <ThemedText
                  type="small"
                  style={[{ color: theme.error }, estilos.flexible]}
                  accessibilityLiveRegion="assertive"
                >
                  {error}
                </ThemedText>
              </View>
            )}

            {/* ── Ficha de búsqueda ────────────────────────────────────── */}
            {/* §25: el cuestionario es editable. Antes solo se contestaba una
                vez al registrarse, así que cambiar de presupuesto exigía crear
                otra cuenta. Y hasta ahora ni siquiera se podían VER las
                respuestas sin entrar a editarlas. */}
            <Seccion
              titulo="TU FICHA DE BÚSQUEDA"
              accion={
                <Pulsable
                  onPress={() => router.push('/perfil/preferencias')}
                  style={estilos.accionSeccion}
                  accessibilityRole="button"
                  accessibilityLabel="Editar mis preferencias de búsqueda"
                  hitSlop={8}
                >
                  <ThemedText type="small" themeColor="acento">
                    Editar
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={theme.acento} />
                </Pulsable>
              }
            >
              <View style={estilos.rejilla}>
                <CampoFicha etiqueta="PRESUPUESTO MENSUAL" valor={presupuesto} ancho={1} />
                <CampoFicha
                  etiqueta="DISTANCIA MÁXIMA"
                  valor={perfil?.distancia_max_km != null ? `${perfil.distancia_max_km} km` : 'sin definir'}
                  ancho={1}
                  tono={perfil?.distancia_max_km != null ? 'normal' : 'atenuado'}
                />
              </View>
              <View style={estilos.rejilla}>
                <CampoFicha
                  etiqueta="MASCOTAS"
                  valor={perfil?.mascotas ? 'Tengo' : 'No tengo'}
                  ancho={1}
                  icono="paw-outline"
                  tono={perfil?.mascotas ? 'normal' : 'atenuado'}
                />
                <CampoFicha
                  etiqueta="TABACO"
                  valor={perfil?.fuma ? 'Fumo' : 'No fumo'}
                  ancho={1}
                  tono={perfil?.fuma ? 'normal' : 'atenuado'}
                />
              </View>
              <View style={estilos.rejilla}>
                <CampoFicha
                  etiqueta="NIVEL DE RUIDO"
                  valor={perfil?.nivel_ruido ?? 'sin definir'}
                  ancho={1}
                  tono={perfil?.nivel_ruido ? 'normal' : 'atenuado'}
                />
                {/* Este campo leía `usuarios.busca_roomie`, y ESE booleano no
                    hace nada. Lo escribe el cuestionario, lo escribe
                    Preferencias, se pintaba aquí… y no lo lee nadie más: lo que
                    te mete en la lista de roomies es una fila en `roomies` con
                    `estado = 'activo'`, que se enciende con el interruptor de
                    la pestaña Roomies.

                    O sea: contestabas «sí busco roomie», tu propio perfil te lo
                    confirmaba, y no aparecías en la lista de nadie. Dos
                    interruptores que parecen el mismo y no lo son.

                    Ahora el campo reporta el ESTADO REAL, y cuando está en no,
                    dice dónde se cambia. Un documento informa de lo que es, no
                    de lo que alguien contestó una vez. */}
                <CampoFicha
                  etiqueta="BUSCA ROOMIE"
                  valor={apareceEnRoomies ? 'Sí, tu ficha está activa' : 'No · actívala en Roomies'}
                  ancho={1}
                  tono={apareceEnRoomies ? 'normal' : 'atenuado'}
                />
              </View>
            </Seccion>

            {/* ── Consentimiento de IA ─────────────────────────────────── */}
            {/* §29 · §18. Se muestra aparte y con su propio recuadro porque es
                el único ajuste cuyo estado cambia lo que la app HACE: con él,
                las sugerencias corren en Nivel 2; sin él, en Nivel 1. Enterrarlo
                dentro de la lista de preferencias lo volvía invisible. */}
            <View
              style={[
                estilos.bloqueIa,
                {
                  borderColor: perfil?.consiente_analisis_ia ? theme.tintedBorder : theme.border,
                  backgroundColor: perfil?.consiente_analisis_ia ? theme.tintedSurface : theme.backgroundElement,
                },
              ]}
            >
              <View style={estilos.filaIa}>
                <Ionicons
                  name={perfil?.consiente_analisis_ia ? 'sparkles' : 'sparkles-outline'}
                  size={18}
                  color={perfil?.consiente_analisis_ia ? theme.acento : theme.textSecondary}
                />
                <ThemedText type="etiqueta" themeColor={perfil?.consiente_analisis_ia ? 'acento' : 'textSecondary'}>
                  ANÁLISIS CON IA · {perfil?.consiente_analisis_ia ? 'ACTIVADO' : 'DESACTIVADO'}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.textoIa}>
                {perfil?.consiente_analisis_ia
                  ? 'Tus sugerencias se ordenan también por afinidad semántica (Nivel 2). Puedes retirarlo cuando quieras desde Editar.'
                  : 'Tus sugerencias se calculan solo con el cuestionario (Nivel 1). Actívalo desde Editar si quieres que también se ordenen por afinidad.'}
              </ThemedText>
            </View>

            {/* ── Biografía ────────────────────────────────────────────── */}
            <Seccion titulo="BIOGRAFÍA">
              <Campo
                punteado
                etiqueta="SOBRE TI"
                placeholder="Cuéntale a otros quién eres. Genera confianza para quien no puede ir a verte antes de decidir."
                multiline
                maxLength={280}
                style={estilos.biografia}
                value={biografia}
                onChangeText={setBiografia}
              />
              <View style={estilos.pieBiografia}>
                <ThemedText type="folio" themeColor="textSecondary">
                  {biografia.length}/280
                </ThemedText>
                {/* El botón aparece SOLO si hay algo sin guardar. Un "Guardar"
                    permanentemente encendido no distingue entre "ya está" y
                    "te falta", que es justo lo que uno necesita saber. */}
                {biografiaCambiada && (
                  <ThemedText type="small" themeColor="acento">
                    Sin guardar
                  </ThemedText>
                )}
              </View>
              {biografiaCambiada && (
                <Sello onPress={onGuardarBiografia} cargando={guardando} accessibilityLabel="Guardar biografía">
                  Guardar biografía
                </Sello>
              )}
            </Seccion>

            {/* ── Tu expediente público ───────────────────────────────── */}
            {/*
                De la pantalla de perfil de Airbnb se toma UNA cosa, y no son
                sus tarjetas ilustradas —este mundo no tiene ilustraciones ni
                sombras—: es que el perfil sea la puerta a lo tuyo, y sobre
                todo el renglón «Consulta el perfil».

                Ese hueco era real. `perfil/[usuarioId]` existe desde la 0026 y
                NADA en la app enlazaba al propio: se podía ver la ficha de
                cualquiera menos la de uno mismo. En un producto cuyo
                PRODUCT.md dice que la confianza para quien decide sin visitar
                pesa tanto como el matching, no poder comprobar qué proyectas
                es el hueco más caro de esta pantalla.

                Y ahora hay más razón: desde END-07 tu ficha pública muestra si
                tu correo está verificado. Un dato sobre ti que no puedes ver.

                Los tres renglones dicen su ESTADO en la descripción, no en una
                insignia al margen. En un documento, un dato va junto a su
                etiqueta; una pastilla con un número al borde derecho es de otro
                mundo.
            */}
            <Seccion titulo="TU EXPEDIENTE PÚBLICO">
              <View style={estilos.lista}>
                <FilaAjuste
                  icono="eye-outline"
                  etiqueta="Ver mi perfil público"
                  descripcion="Lo que ve otra persona cuando entra a tu ficha."
                  onPress={
                    session?.user.id
                      ? () => router.push({ pathname: '/perfil/[usuarioId]', params: { usuarioId: session.user.id } })
                      : undefined
                  }
                />
                <FileteHoja />
                <FilaAjuste
                  icono="documents-outline"
                  etiqueta="Mis publicaciones"
                  descripcion={descripcionPublicaciones}
                  onPress={() => router.push('/(tabs)/publicar')}
                />
                <FileteHoja />
                <FilaAjuste
                  icono="people-outline"
                  etiqueta="Mi anuncio de roomie"
                  descripcion={
                    apareceEnRoomies
                      ? 'Activo: apareces en la lista de roomies.'
                      : miRoomie
                        ? 'Pausado: no apareces en la lista.'
                        : 'Sin crear. Nadie te encuentra como roomie.'
                  }
                  onPress={() => {
                    // Roomies vive dentro de Inicio: se elige el módulo y se navega.
                    useModuloStore.getState().setModulo('roomies');
                    router.push('/(tabs)/inicio');
                  }}
                />
              </View>
            </Seccion>

            {/* ── Funciones (Cuervo 360) ───────────────────────────────── */}
            <SeccionFunciones usuarioId={session?.user.id} />

            {/* ── Cuenta ───────────────────────────────────────────────── */}
            {/* Lista de navegación con chevron: cada renglón dice "esto lleva a
                otro lado" sin que nadie lo explique. Antes esto eran botones
                apilados del mismo peso, sin agrupar y sin jerarquía. */}
            <Seccion titulo="CUENTA">
              <View style={estilos.lista}>
                {/* El aviso solo era alcanzable desde el REGISTRO: quien ya
                    tenía cuenta no podía volver a leerlo. Para una app que
                    promete derechos ARCO, no poder consultar el aviso después
                    de aceptarlo es un hueco de cumplimiento, no de diseño. */}
                <FilaAjuste
                  icono="document-text-outline"
                  etiqueta="Aviso de privacidad"
                  descripcion="Qué datos guardamos, para qué, y cómo pedir que los borremos."
                  onPress={() => router.push('/aviso-privacidad')}
                />
                <FileteHoja />
                <FilaAjuste
                  icono="download-outline"
                  etiqueta="Descargar mis datos"
                  descripcion={
                    exportando
                      ? 'Preparando el archivo…'
                      : 'Una copia en JSON de todo lo que guardamos sobre ti.'
                  }
                  onPress={exportando ? undefined : onDescargarMisDatos}
                />
              </View>

              {/*
                  Dos grupos, no una lista plana — la segunda cosa que se toma
                  de las capturas de Airbnb, que separa «Configuración /
                  Privacidad» de «Invita / Legal / Cerrar sesión» con aire y un
                  filete.

                  Aquí la división tiene un motivo propio y no es imitación:
                  arriba están tus DERECHOS sobre tus datos —consultarlos y
                  llevártelos, que el aviso de privacidad promete por la
                  LFPDPPP—; abajo, salir. Meterlos en la misma lista pone un
                  derecho ARCO al mismo peso que un botón de sesión.

                  La separación es aire más filete, no una tarjeta nueva: este
                  mundo separa con regla, no apilando superficies.
              */}
              <View style={[estilos.grupoAparte, { borderTopColor: theme.filete }]}>
                <FilaAjuste
                  icono="log-out-outline"
                  etiqueta="Cerrar sesión"
                  descripcion="Tus datos y tus publicaciones se quedan como están."
                  onPress={onCerrarSesion}
                />
              </View>
            </Seccion>

            {/* ── Eliminar la cuenta ───────────────────────────────────── */}
            {/* El peso visual estaba INVERTIDO: "Cerrar sesión" era un botón
                rojo relleno —lo más ruidoso de la pantalla— y "Eliminar mi
                cuenta" un contorno discreto. Lo irreversible ahora se ve
                irreversible, y lo rutinario es un renglón más de la lista. */}
            <View style={[estilos.zonaRiesgo, { borderColor: theme.error }]}>
              <View style={estilos.filaIa}>
                <Ionicons name="warning-outline" size={18} color={theme.error} />
                <ThemedText type="etiqueta" style={{ color: theme.error }}>
                  ELIMINAR LA CUENTA
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.textoSeccion}>
                Se borran tu perfil, tus publicaciones, tus fotografías y tus mensajes. Es
                irreversible y no conservamos copia.
              </ThemedText>
              <Pulsable
                onPress={onEliminarCuenta}
                style={[estilos.botonPeligro, { backgroundColor: theme.error }]}
                accessibilityRole="button"
                accessibilityLabel="Eliminar mi cuenta"
              >
                <ThemedText style={[estilos.textoPeligro, { color: theme.errorTexto }]}>
                  Eliminar mi cuenta
                </ThemedText>
              </Pulsable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  flexible: { flex: 1 },

  identidad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  // El aire de arriba es mayor que el de abajo: un grupo empieza donde acaba
  // el espacio, no donde empieza el filete.
  grupoAparte: { marginTop: Spacing.four, paddingTop: Spacing.three, borderTopWidth: Filete.fino },
  envolturaFoto: { width: 88, height: 88 },
  foto: { width: 88, height: 88, borderRadius: 44, borderWidth: Filete.fino },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  insigniaCamara: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datosIdentidad: { flex: 1, gap: Spacing.half },
  universidad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.half },
  filetePrincipal: { height: Filete.grueso },

  errorBloque: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },

  accionSeccion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, minHeight: 44 },
  rejilla: { flexDirection: 'row', gap: Spacing.three },
  textoSeccion: { lineHeight: 20 },

  bloqueIa: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  filaIa: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  textoIa: { lineHeight: 20 },

  biografia: { minHeight: 110, textAlignVertical: 'top', paddingTop: Spacing.three },
  pieBiografia: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  zonaRiesgo: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  botonPeligro: {
    minHeight: 48,
    borderRadius: Radios.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  textoPeligro: Texto.sello,

  lista: { gap: 0 },
});
