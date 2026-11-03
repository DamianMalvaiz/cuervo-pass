import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EsqueletoFilasWeb } from '@/components/web/EsqueletoWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useAvisos, useMarcarAvisos } from '@/hooks/queries/useNotificaciones';
import { useTheme } from '@/hooks/use-theme';
import { cuandoFue, ICONOS_AVISO } from '@/lib/avisosVista';
import { rutaDeDestino } from '@/lib/destinoNotificacion';
import type { AvisoDelCentro } from '@/services/notificaciones.service';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Notificaciones en la web: lo mismo que el centro de avisos de la app (0072), con el diseño de la web. «Sin leer» arriba y «Anteriores» debajo; lo no leído se distingue por el peso del texto, el relleno y un punto, no solo por color.
 * Cuatro estados distintos (END-11): cargando, FALLÓ la lectura, «no hay avisos» y la lista. Tocar un aviso lo marca como leído y, si su destino es una clase conocida, lleva allí.
 */
export function NotificacionesWeb() {
  const uid = useAuthStore((s) => s.session?.user.id);
  const { avisos, cargando, fallo, reintentar } = useAvisos(uid);
  const { marcarUno, marcarTodos, marcandoTodos } = useMarcarAvisos(uid);
  const sinLeer = avisos.filter((a) => !a.leida);
  const leidos = avisos.filter((a) => a.leida);

  const abrir = (a: AvisoDelCentro) => {
    if (!a.leida) marcarUno(a.id);
    const ruta = rutaDeDestino(a.destino);
    if (ruta) router.push(ruta);
  };

  let cuerpo;
  if (fallo) cuerpo = <ErrorDeCarga etiqueta="No pudimos cargar tus avisos" onReintentar={reintentar} />;
  else if (cargando) cuerpo = <EsqueletoFilasWeb filas={4} />;
  else if (avisos.length === 0) {
    cuerpo = <BloqueEstado icono="notifications-off-outline" etiqueta="Sin avisos" mensaje="Aquí verás si aprueban tu verificación, si reseñan tu negocio o si responden a tu reseña." />;
  } else {
    cuerpo = (
      <>
        {sinLeer.length > 0 ? (
          <Grupo titulo={`Sin leer (${sinLeer.length})`} accion={<BotonWeb compacto variante="contorno" onPress={() => marcarTodos()} accessibilityLabel="Marcar todos como leídos">{marcandoTodos ? 'Marcando…' : 'Marcar todos como leídos'}</BotonWeb>}>
            {sinLeer.map((a) => <Fila key={a.id} aviso={a} onAbrir={abrir} />)}
          </Grupo>
        ) : null}
        {leidos.length > 0 ? (
          <Grupo titulo={sinLeer.length > 0 ? 'Anteriores' : 'Todo al día'}>
            {leidos.map((a) => <Fila key={a.id} aviso={a} onAbrir={abrir} />)}
          </Grupo>
        ) : null}
      </>
    );
  }

  return (
    <PaginaSesionWeb titulo="Notificaciones" subtitulo="Lo que pasa con tu cuenta, tus reseñas y tus publicaciones.">
      <View style={estilos.cuerpo}>{cuerpo}</View>
    </PaginaSesionWeb>
  );
}

function Grupo({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={estilos.grupo}>
      <View style={estilos.cabecera}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>{titulo}</ThemedText>
        {accion}
      </View>
      <View style={estilos.filas}>{children}</View>
    </View>
  );
}

function Fila({ aviso, onAbrir }: { aviso: AvisoDelCentro; onAbrir: (a: AvisoDelCentro) => void }) {
  const theme = useTheme();
  return (
    <Pulsable
      onPress={() => onAbrir(aviso)}
      accessibilityRole="button"
      accessibilityLabel={`${aviso.leida ? '' : 'Sin leer. '}${aviso.contenido ?? ''}. ${cuandoFue(aviso.creado_en)}`}
      style={[estilos.fila, { backgroundColor: aviso.leida ? 'transparent' : theme.backgroundElement, borderColor: theme.filete }]}
    >
      <View style={[estilos.icono, { backgroundColor: theme.tintedSurface }]}>
        <Ionicons name={ICONOS_AVISO[aviso.tipo] ?? 'notifications-outline'} size={22} color={theme.bosque} />
      </View>
      <View style={estilos.textos}>
        <ThemedText style={[Texto.cuerpo, aviso.leida ? undefined : Texto.pesoFuerte]}>{aviso.contenido ?? ''}</ThemedText>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">{cuandoFue(aviso.creado_en)}</ThemedText>
      </View>
      {!aviso.leida ? <View style={[estilos.punto, { backgroundColor: theme.bosque }]} /> : null}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  cuerpo: { gap: Spacing.five, maxWidth: 760 },
  grupo: { gap: Spacing.three },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.three },
  filas: { gap: Spacing.two },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, minHeight: 72, borderWidth: Filete.fino, borderRadius: Radios.tarjeta },
  icono: { width: 44, height: 44, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0, gap: Spacing.half },
  punto: { width: 10, height: 10, borderRadius: Radios.full },
});
