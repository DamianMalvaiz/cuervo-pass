import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

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
import { rutaDeDestino } from '@/lib/destinoNotificacion';
import { toque } from '@/lib/tacto';
import type { AvisoDelCentro } from '@/services/notificaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

const ICONOS: Record<AvisoDelCentro['tipo'], keyof typeof Ionicons.glyphMap> = {
  nuevo_mensaje: 'chatbubble-outline',
  nuevo_contacto: 'person-add-outline',
  publicacion_oculta: 'eye-off-outline',
  cuenta_suspendida: 'alert-circle-outline',
  verificacion_resuelta: 'shield-checkmark-outline',
  resena_nueva: 'star-outline',
  resena_respondida: 'chatbox-ellipses-outline',
};

const MINUTO = 60_000;
/** «hace 5 min», «hace 3 h», «hace 2 d» y, pasada una semana, la fecha. Sin dependencias: es una línea de apoyo, no el dato. */
export function cuandoFue(iso: string, ahora = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const dif = Math.max(0, ahora - t);
  if (dif < MINUTO) return 'ahora';
  if (dif < 60 * MINUTO) return `hace ${Math.floor(dif / MINUTO)} min`;
  if (dif < 24 * 60 * MINUTO) return `hace ${Math.floor(dif / (60 * MINUTO))} h`;
  if (dif < 7 * 24 * 60 * MINUTO) return `hace ${Math.floor(dif / (24 * 60 * MINUTO))} d`;
  return new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/**
 * Centro de avisos · 0072. Tres estados y no dos: cargando, falló y «no hay avisos» se pintan distinto (invariante 2). Tocar un aviso lo marca
 * como leído y, si su destino es una clase conocida, lleva allí. Lo no leído se distingue por el PESO del texto y un punto, no solo por color.
 */
export default function NotificacionesScreen() {
  const theme = useTheme();
  const { anchoLista } = useTamanoPantalla();
  const uid = useAuthStore((s) => s.session?.user.id);
  const { avisos, cargando, fallo, reintentar } = useAvisos(uid);
  const { marcarUno, marcarTodos, marcandoTodos } = useMarcarAvisos(uid);
  const sinLeer = avisos.filter((a) => !a.leida).length;

  const abrir = (a: AvisoDelCentro) => {
    toque();
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
            <Ionicons name={ICONOS[item.tipo] ?? 'notifications-outline'} size={22} color={theme.bosque} />
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
