import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FileteHoja } from '@/components/ficha/CampoFicha';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { FilaAjuste } from '@/components/ficha/FilaAjuste';
import { Pulsable } from '@/components/ficha/Pulsable';
import { EncabezadoPerfil } from '@/components/perfil/EncabezadoPerfil';
import { PerfilVendedor } from '@/components/perfil/PerfilVendedor';
import { TarjetaIdentidad } from '@/components/perfil/TarjetaIdentidad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useMiRoomie } from '@/hooks/queries/useRoomies';
import { useMisPublicaciones } from '@/hooks/queries/usePublicaciones';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuloStore } from '@/store/useModuloStore';
import { usePerfilStore } from '@/store/usePerfilStore';

// Documento maestro v5 · §25 y §29. Perfil por tipo de cuenta · 0083.
//
// El perfil que se pinta depende del PERFIL ACTIVO: un vendedor ve el suyo (`PerfilVendedor`); un estudiante, éste. Mientras no se sabe cuál es, el de
// estudiante: es lo que había y no afirma nada nuevo. Lo que ANTES vivía aquí y se fue: los siete campos de la ficha de búsqueda (el detalle se ve y se
// edita en «Mis datos»), el editor de la biografía (ahora «Sobre mí», su propia pantalla), las cifras de la tarjeta y «Tus funciones» con alertas
// (ahora «Crea tu perfil de vendedor», una pantalla).

function PerfilEstudiante() {
  const theme = useTheme();
  const margenSuperior = useMargenSuperior();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { perfil, cargando } = usePerfilStore();
  // La ficha de roomie, para decir la VERDAD sobre si apareces en esa lista: la fila de `roomies`, no el booleano del cuestionario.
  const { miRoomie } = useMiRoomie(miId);
  const { datos: misPublicaciones, cargando: cargandoPublicaciones } = useMisPublicaciones(miId);

  if (cargando) {
    // END-38 · La forma de lo que viene, no un punto girando. El esqueleto lleva las etiquetas reales: se saben antes de preguntar.
    return (
      <ThemedView style={estilos.pantalla}>
        <ScrollView contentContainerStyle={[estilos.desplazable, { paddingTop: margenSuperior }, clase === 'amplia' && estilos.centradoAmplio]}>
          <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
            <ListaEsqueleto variante="hoja" filas={1} conFoto={false} etiquetas={['PRESUPUESTO MENSUAL', 'DISTANCIA MÁXIMA']} />
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const apareceEnRoomies = miRoomie?.estado === 'activo';
  const descripcionRoomie = apareceEnRoomies
    ? 'Activa: apareces en la lista de roomies.'
    : miRoomie
      ? 'Pausada: no apareces en la lista.'
      : 'Sin crear. Nadie te encuentra como roomie.';
  // Publicar y estar visible no es lo mismo: se dice cuántas y cuántas ACTIVAS. Una desactivada que uno cree publicada se descubre tarde.
  const activas = misPublicaciones.filter((p) => p.activa).length;
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const descripcionPublicaciones = `${plural(misPublicaciones.length, 'publicada', 'publicadas')} · ${plural(activas, 'activa', 'activas')}`;
  const sobreMi = perfil?.biografia?.trim();
  const presupuesto =
    perfil?.presupuesto_min != null && perfil?.presupuesto_max != null
      ? `$${perfil.presupuesto_min.toLocaleString('es-MX')} – $${perfil.presupuesto_max.toLocaleString('es-MX')}`
      : 'sin definir';

  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, { paddingTop: margenSuperior }, clase === 'amplia' && estilos.centradoAmplio]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
          <EncabezadoPerfil />
          {/* Solo se afirma lo que se sabe: «Correo verificado» es literalmente lo que la 0026 deriva, nada más (no «usuario verificado»). */}
          <TarjetaIdentidad insignia={perfil?.correo_verificado ? 'Correo verificado' : undefined} />

          <View style={[estilos.busqueda, { borderColor: theme.tintedBorder, backgroundColor: theme.tintedSurface }]}>
            <View style={estilos.cabeceraBusqueda}>
              <ThemedText type="etiqueta" themeColor="textSecondary">MI BÚSQUEDA</ThemedText>
              <Pulsable
                onPress={() => router.push('/perfil/preferencias')}
                accessibilityRole="button"
                accessibilityLabel="Editar mi búsqueda"
                style={estilos.accionBusqueda}
              >
                <ThemedText type="small" themeColor="acento">Editar</ThemedText>
                <Ionicons name="chevron-forward" size={14} color={theme.acento} />
              </Pulsable>
            </View>
            <View style={estilos.datosBusqueda}>
              <View style={estilos.dato}>
                <ThemedText type="small" themeColor="textSecondary">Presupuesto</ThemedText>
                <ThemedText type="smallBold">{presupuesto}</ThemedText>
              </View>
              <View style={estilos.dato}>
                <ThemedText type="small" themeColor="textSecondary">Distancia</ThemedText>
                <ThemedText type="smallBold">{perfil?.distancia_max_km != null ? `${perfil.distancia_max_km} km` : 'sin definir'}</ThemedText>
              </View>
              <View style={estilos.dato}>
                <ThemedText type="small" themeColor="textSecondary">Universidad</ThemedText>
                <ThemedText type="smallBold" numberOfLines={2}>{perfil?.universidad ?? 'sin definir'}</ThemedText>
              </View>
            </View>
          </View>

          <View style={[estilos.lista, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <FilaAjuste
              icono="person-outline"
              etiqueta="Mis datos"
              descripcion="Tus preferencias de búsqueda y tus hábitos."
              onPress={() => router.push('/perfil/preferencias')}
            />
            <FileteHoja />
            <FilaAjuste
              icono="create-outline"
              etiqueta="Sobre mí"
              descripcion={sobreMi ? (sobreMi.length > 70 ? `${sobreMi.slice(0, 70)}…` : sobreMi) : 'Todavía no has escrito nada.'}
              onPress={() => router.push('/perfil/sobre-mi')}
            />
            <FileteHoja />
            <FilaAjuste
              icono="eye-outline"
              etiqueta="Cómo me ven"
              descripcion="Lo que ve otra persona cuando entra a tu ficha."
              onPress={miId ? () => router.push({ pathname: '/perfil/[usuarioId]', params: { usuarioId: miId } }) : undefined}
            />
            <FileteHoja />
            <FilaAjuste
              icono="people-outline"
              etiqueta="Mi ficha de roomie"
              descripcion={descripcionRoomie}
              onPress={() => {
                // Roomies vive dentro de Inicio: se elige el módulo y se navega.
                useModuloStore.getState().setModulo('roomies');
                router.push('/(tabs)/inicio');
              }}
            />
            {/* Un estudiante que NO publica no necesita este renglón; uno que ya publicaba (o que lo hizo antes) sí. */}
            {!cargandoPublicaciones && misPublicaciones.length > 0 ? (
              <>
                <FileteHoja />
                <FilaAjuste
                  icono="documents-outline"
                  etiqueta="Mis publicaciones"
                  descripcion={descripcionPublicaciones}
                  onPress={() => router.push('/(tabs)/publicar')}
                />
              </>
            ) : null}
          </View>

          <View style={[estilos.lista, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
            <FilaAjuste
              icono="storefront-outline"
              etiqueta="Crea tu perfil de vendedor"
              descripcion="¿Tienes un negocio o un depa para rentar?"
              onPress={() => router.push('/perfil/crear-vendedor')}
            />
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

export default function PerfilScreen() {
  const session = useAuthStore((s) => s.session);
  const { cargarPerfil } = usePerfilStore();
  const { perfil } = usePerfilActivo(session?.user.id);

  // El perfil de la cuenta lo necesitan los dos: la tarjeta de identidad lee de este almacén.
  useEffect(() => {
    if (session?.user.id) cargarPerfil(session.user.id);
  }, [session?.user.id, cargarPerfil]);

  return perfil === 'vendedor' ? <PerfilVendedor /> : <PerfilEstudiante />;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  lista: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  busqueda: { borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.two },
  cabeceraBusqueda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accionBusqueda: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, minHeight: 44 },
  datosBusqueda: { flexDirection: 'row', gap: Spacing.three },
  dato: { flex: 1, gap: Spacing.half },
});
