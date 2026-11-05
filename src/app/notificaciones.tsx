import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useAvisos, useMarcarAvisos } from '@/hooks/queries/useNotificaciones';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { MarcoSesionWeb } from '@/components/web/MarcoSesionWeb';
import { NotificacionesWeb } from '@/components/web/NotificacionesWeb';
import { cuandoFue, ICONOS_AVISO } from '@/lib/avisosVista';
import { rutaDeDestino } from '@/lib/destinoNotificacion';
import type { AvisoDelCentro } from '@/services/notificaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

// Se reexporta: la prueba de esta pantalla (y quien la importe) lo sigue encontrando aquí.
export { cuandoFue };

/**
 * Centro de avisos · 0072. Tres estados y no dos: cargando, falló y «no hay avisos» se pintan distinto (invariante 2). Tocar un aviso lo marca
 * como leído y, si su destino es una clase conocida, lleva allí. Lo no leído se distingue por el PESO del texto y un punto, no solo por color.
 */
export default function NotificacionesScreen() {
  // En la web, su propia página con el marco de la web (encabezado y barra inferior); la cabecera de la app se apaga en el layout.
  return Platform.OS === 'web' ? (
    <MarcoSesionWeb>
      <NotificacionesWeb />
    </MarcoSesionWeb>
  ) : (
    <NotificacionesApp />
  );
}

function NotificacionesApp() {
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const uid = useAuthStore((s) => s.session?.user.id);
  const { avisos, cargando, fallo, reintentar } = useAvisos(uid);
  const { marcarUno, marcarTodos, marcandoTodos } = useMarcarAvisos(uid);
  const sinLeer = avisos.filter((a) => !a.leida).length;

  // Sin `toque()`: abrir un aviso navega a su destino, no cambia nada que haya que confirmar al tacto.
  const abrir = (a: AvisoDelCentro) => {
    if (!a.leida) marcarUno(a.id);
    const ruta = rutaDeDestino(a.destino);
    if (ruta) router.push(ruta);
  };

  const vacio = cargando ? (
    <ListaEsqueleto variante="renglon" filas={4} />
  ) : fallo ? (
    <View style={estilos.estado}>
      <BloqueEstado tono="alerta" icono="cloud-offline-outline" etiqueta="No pudimos cargar tus avisos" mensaje="Revisa tu conexión e intenta de nuevo." />
      <Sello variante="contorno" icono="refresh" onPress={reintentar} accessibilityLabel="Reintentar">
        Reintentar
      </Sello>
    </View>
  ) : (
    <BloqueEstado icono="notifications-off-outline" etiqueta="Sin avisos" mensaje="Aquí verás si aprueban tu verificación, si reseñan tu negocio o si responden a tu reseña." />
  );

  return (
    <ThemedView style={estilos.pantalla}>
      <FlatList
        data={cargando || fallo ? [] : avisos}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[estilos.lista, { maxWidth: anchoLista }]}
        ListHeaderComponent={
          sinLeer > 0 ? (
            <Sello variante="contorno" icono="checkmark-done-outline" onPress={() => marcarTodos()} cargando={marcandoTodos} accessibilityLabel="Marcar todos como leídos">
              Marcar todos como leídos
            </Sello>
          ) : null
        }
        ListEmptyComponent={vacio}
        ItemSeparatorComponent={Separador}
        renderItem={({ item }) => (
          <Pulsable
            onPress={() => abrir(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.leida ? '' : 'Sin leer. '}${item.contenido ?? ''}. ${cuandoFue(item.creado_en)}`}
            style={[estilos.fila, { backgroundColor: item.leida ? 'transparent' : theme.backgroundElement, borderColor: theme.filete }]}
          >
            <Ionicons name={ICONOS_AVISO[item.tipo] ?? 'notifications-outline'} size={22} color={theme.bosque} />
            <View style={estilos.textos}>
              <ThemedText style={item.leida ? undefined : Texto.pesoFuerte}>{item.contenido ?? ''}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{cuandoFue(item.creado_en)}</ThemedText>
            </View>
            {!item.leida ? <View style={[estilos.punto, { backgroundColor: theme.bosque }]} /> : null}
          </Pulsable>
        )}
      />
    </ThemedView>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { width: '100%', alignSelf: 'center', padding: Spacing.three, paddingBottom: Spacing.six },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, minHeight: 64, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  textos: { flex: 1, gap: Spacing.half },
  punto: { width: 10, height: 10, borderRadius: Radios.full },
  separador: { height: Spacing.two },
  estado: { gap: Spacing.three },
});
