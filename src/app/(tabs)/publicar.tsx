import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { FichaPublicacion } from '@/components/FichaPublicacion';
import { GuardaPublicar } from '@/components/GuardaPublicar';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { FileteHoja } from '@/components/ficha/CampoFicha';
import { Sello } from '@/components/ficha/Sello';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { folioDe } from '@/lib/folio';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';
import { useCambiarEstadoPublicacion, useContactosRecibidos, useMisPublicaciones } from '@/hooks/queries/usePublicaciones';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { toast } from '@/lib/toast';

// Documento maestro v5 · §25 y §27.
function MisPublicaciones() {
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const margenSuperior = useMargenSuperior();
  const miId = useAuthStore((s) => s.session?.user.id);
  // END-18 · La carga, el reintento y la caché viven en el hook. Lo que había
  // era tres `useState` y un `useFocusEffect` que recargaba entero cada vez que
  // la pestaña volvía al foco, aunque no hubiera cambiado nada.
  const { datos: publicaciones, cargando } = useMisPublicaciones(miId);
  const contactos = useContactosRecibidos(Boolean(miId));
  const cambiarEstado = useCambiarEstadoPublicacion(miId);

  const { urls: urlsFirmadas } = useFotosFirmadas(publicaciones.map((p) => p.fotos?.[0]));

  const onCambiarEstado = (publicacion: Publicacion) => {
    const activar = !publicacion.activa;
    Alert.alert(
      activar ? 'Reactivar publicación' : 'Desactivar publicación',
      activar
        ? '¿Volver a mostrarla a otros usuarios?'
        : '¿Seguro que quieres desactivarla? Dejará de verse para otros usuarios (puedes reactivarla después).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: activar ? 'Reactivar' : 'Desactivar',
          style: activar ? 'default' : 'destructive',
          onPress: async () => {
            try {
              // La mutación invalida las consultas afectadas por sí sola: sin
              // eso, la publicación desactivada seguiría en la lista hasta que
              // venciera el staleTime.
              await cambiarEstado.mutateAsync({ id: publicacion.id, activa: activar });
              // Antes un cambio exitoso no decía nada: la publicación solo cambiaba
              // de aspecto en la lista. Dentro del `try`, para que un fallo no dé
              // también el aviso de éxito.
              toast.exito(activar ? 'Publicación reactivada' : 'Publicación desactivada');
            } catch (e) {
              // AUD-26: el límite de 15 activas por cuenta se aplica al
              // reactivar igual que al crear.
              // Es un resultado, no una pregunta: va como aviso. El Alert que SÍ se
              // queda es el de arriba, el que pide confirmar.
              toast.error(
                // END-27 · Por código. Con la subcadena, un servidor con
                // locale distinto nunca entraba en esta rama y la persona leía
                // «intenta de nuevo» ante un límite que no se mueve solo.
                esCodigo(e, CP.LIMITE_PUBLICACIONES)
                  ? 'No se pudo cambiar el estado. Ya tienes 15 publicaciones activas. Desactiva alguna primero.'
                  : 'No se pudo cambiar el estado. Intenta de nuevo en un momento.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <View style={[estilos.encabezado, { paddingTop: margenSuperior }]}>
        <Encabezado
          kicker="REGISTRO PROPIO"
          titulo="Mis publicaciones"
          meta={publicaciones.length === 1 ? '1 PUBLICACIÓN' : `${publicaciones.length} PUBLICACIONES`}
        />
        {/* Crear una publicación NAVEGA a un formulario: no compromete nada
            todavía. El sello se gasta en el "Publicar" de ese formulario, que sí
            escribe. Aquí va la variante de contorno: mismo peso, sin la tinta. */}
        <Sello
          variante="contorno"
          icono="add"
          onPress={() => router.push('/publicacion/nueva')}
          accessibilityLabel="Crear una nueva publicación"
        >
          Nueva publicación
        </Sello>
      </View>

      {cargando ? (
        <View style={estilos.lista}>
          <ListaEsqueleto variante="hoja" filas={2} etiquetas={['RENTA MENSUAL', 'DISTANCIA']} />
        </View>
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[estilos.lista, estilos.columna, { maxWidth: anchoLista }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const recibidos = contactos.get(item.id) ?? 0;
            const avisos: { icono: 'eye-off-outline' | 'flag-outline' | 'location-outline'; texto: string; alerta: boolean }[] = [];
            if (!item.activa) avisos.push({ icono: 'eye-off-outline', texto: 'Inactiva: no aparece en las sugerencias', alerta: false });
            // AUD-16: el dueño se entera de por qué desapareció su publicación,
            // en vez de descubrirlo por su cuenta.
            if (item.oculta_por_reportes) avisos.push({ icono: 'flag-outline', texto: 'Oculta por reportes', alerta: true });
            if (item.pendiente_geocoding)
              avisos.push({ icono: 'location-outline', texto: 'Sin ubicación en el mapa — se reintenta al abrir esta pantalla', alerta: false });

            return (
              <View style={estilos.registro}>
                <FichaPublicacion
                  titulo={item.titulo}
                  precio={item.precio_renta}
                  direccion={item.direccion}
                  fotoUrl={item.fotos?.[0] ? urlsFirmadas.get(item.fotos[0]) : null}
                  tipo={item.tipo}
                  permiteMascotas={item.permite_mascotas}
                  amueblado={item.amueblado}
                  folio={folioDe(item.id)}
                  onPress={() => router.push(`/publicacion/${item.id}`)}
                />

                {/* El pie de gestión: estado y acciones del DUEÑO, en su propio
                    bloque. Antes iban sueltos al lado de la ficha, que con la
                    fotografía a todo el ancho la dejaba estrujada en una columna
                    estrecha, y las etiquetas de estado flotaban fuera de su borde. */}
                <View style={[estilos.gestion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
                  {avisos.map((a) => (
                    <View key={a.texto} style={estilos.aviso}>
                      <Ionicons name={a.icono} size={14} color={a.alerta ? theme.error : theme.textSecondary} />
                      <ThemedText
                        type="small"
                        themeColor={a.alerta ? 'error' : 'textSecondary'}
                        style={estilos.textoAviso}
                      >
                        {a.texto}
                      </ThemedText>
                    </View>
                  ))}

                  {/* AUD-11: esta métrica ya no se infla sola con cada toque
                      repetido; `contactos` tiene índice único por par. */}
                  <View style={estilos.aviso}>
                    <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary" style={estilos.textoAviso}>
                      {recibidos === 1 ? '1 persona pidió tu contacto' : `${recibidos} personas pidieron tu contacto`}
                    </ThemedText>
                  </View>

                  <FileteHoja />

                  <View style={estilos.acciones}>
                    <Pressable
                      onPress={() => router.push(`/publicacion/editar/${item.id}`)}
                      style={estilos.accion}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${item.titulo}`}
                    >
                      <Ionicons name="create-outline" size={16} color={theme.acento} />
                      <ThemedText type="small" themeColor="acento">
                        Editar
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => onCambiarEstado(item)}
                      style={estilos.accion}
                      accessibilityRole="button"
                      accessibilityLabel={item.activa ? `Desactivar ${item.titulo}` : `Reactivar ${item.titulo}`}
                    >
                      <Ionicons
                        name={item.activa ? 'eye-off-outline' : 'eye-outline'}
                        size={16}
                        color={item.activa ? theme.error : theme.exito}
                      />
                      <ThemedText type="small" themeColor={item.activa ? 'error' : 'exito'}>
                        {item.activa ? 'Desactivar' : 'Reactivar'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <BloqueEstado
              etiqueta="SIN PUBLICACIONES"
              mensaje="Cuando publiques un departamento o un cuarto aparecerá aquí, con cuánta gente pidió tu contacto."
              icono="business-outline"
            />
          }
        />
      )}
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  columna: { width: '100%', alignSelf: 'center' },
  pantalla: { flex: 1 },
  encabezado: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  lista: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  cargando: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two },
  registro: { gap: Spacing.two },
  gestion: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  textoAviso: { flex: 1, lineHeight: 20 },
  acciones: { flexDirection: 'row', gap: Spacing.four, paddingTop: Spacing.two },
  accion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
});

/** La pestaña «Publicar» · Cuervo 360. Solo con una función de vendedor aprobada (ver GuardaPublicar). */
export default function PublicarScreen() {
  return (
    <GuardaPublicar>
      <MisPublicaciones />
    </GuardaPublicar>
  );
}
