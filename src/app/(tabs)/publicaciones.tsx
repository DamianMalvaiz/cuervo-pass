import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { FichaPublicacion } from '@/components/FichaPublicacion';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { FileteHoja } from '@/components/ficha/CampoFicha';
import { Sello } from '@/components/ficha/Sello';
import { Encabezado } from '@/components/ficha/Encabezado';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTheme } from '@/hooks/use-theme';
import { folioDe } from '@/lib/folio';
import { useAuthStore } from '@/store/useAuthStore';
import type { Publicacion } from '@/types/database.types';
import { useCambiarEstadoPublicacion, useContactosRecibidos, useMisPublicaciones } from '@/hooks/queries/usePublicaciones';

// Documento maestro v5 · §25 y §27.
export default function PublicacionesScreen() {
  const theme = useTheme();
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
            } catch (e) {
              // AUD-26: el límite de 15 activas por cuenta se aplica al
              // reactivar igual que al crear.
              Alert.alert(
                'No se pudo cambiar el estado',
                e instanceof Error && e.message.includes('límite')
                  ? 'Ya tienes 15 publicaciones activas. Desactiva alguna primero.'
                  : 'Intenta de nuevo en un momento.'
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
        <View style={estilos.cargando}>
          <ActivityIndicator color={theme.textSecondary} />
          <ThemedText type="etiqueta" themeColor="textSecondary">
            CONSULTANDO TUS PUBLICACIONES
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilos.lista}
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
