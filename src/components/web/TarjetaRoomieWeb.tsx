import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { etiquetaCompatibilidad } from '@/components/TarjetaRoomie';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useCuentaRestringida } from '@/hooks/queries/useCuentaRestringida';
import { useTheme } from '@/hooks/use-theme';
import { abrirChatCon } from '@/lib/abrirChat';
import { animTarjeta } from '@/lib/movimientoWeb';
import { useAuthStore } from '@/store/useAuthStore';
import type { RoomieSugerido } from '@/types/database.types';

const MAX_FRASES = 4;

/**
 * Una persona que busca roomie, para quien tiene cuenta. La etiqueta sale de la compatibilidad POR REGLAS (la que se puede explicar con las frases de abajo, que son las del servidor); sin dato dice «Sin datos para
 * comparar» y no «baja»: no tener con qué comparar no es ser incompatible. «Saludar» abre el chat, salvo en una cuenta restringida (0082), que no abre conversaciones nuevas. La versión `compacta` (la de «Para ti»)
 * es una sola pieza que lleva al perfil, sin frases largas ni botones.
 */
export function TarjetaRoomieWeb({ r, foto, compacta = false, paso }: { r: RoomieSugerido; foto?: string; compacta?: boolean; paso?: number }) {
  const theme = useTheme();
  const miId = useAuthStore((s) => s.session?.user.id);
  const restringida = useCuentaRestringida(miId);
  const nivel = etiquetaCompatibilidad(r.compatibilidad);
  const etiqueta = nivel ? `Compatibilidad ${nivel.toLowerCase()}` : 'Sin datos para comparar';
  const inicial = (r.nombre_completo ?? '?').trim().charAt(0).toUpperCase();
  const aFavor = (r.coincidencias ?? []).slice(0, MAX_FRASES);
  const enContra = (r.diferencias ?? []).slice(0, Math.max(1, MAX_FRASES - aFavor.length));
  const verPerfil = () => router.push(`/perfil/${r.usuario_id}` as never);

  const cabeza = (
    <View style={estilos.cabeza}>
      {foto ? (
        <Image source={{ uri: foto }} style={[estilos.avatar, { borderColor: theme.filete }]} accessibilityLabel={`Foto de ${r.nombre_completo}`} />
      ) : (
        <View style={[estilos.avatar, estilos.avatarVacio, { backgroundColor: theme.tintedSurface }]}>
          <ThemedText style={[Texto.titulo, { color: theme.bosque }]}>{inicial}</ThemedText>
        </View>
      )}
      <View style={estilos.nombre}>
        <ThemedText style={Texto.subtitulo} numberOfLines={1}>{r.nombre_completo}</ThemedText>
        <ThemedText style={[Texto.pequenoFuerte, { color: nivel ? theme.acento : theme.textSecondary }]}>{etiqueta}</ThemedText>
      </View>
    </View>
  );

  if (compacta) {
    return (
      <Pulsable onPress={verPerfil} accessibilityRole="button" accessibilityLabel={`${r.nombre_completo}, ${etiqueta.toLowerCase()}`} style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]} {...animTarjeta(paso)}>
        {cabeza}
        {aFavor[0] ? <Frase texto={aFavor[0]} favor /> : null}
      </Pulsable>
    );
  }
  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]} {...animTarjeta(paso)}>
      {cabeza}
      {aFavor.length + enContra.length > 0 ? (
        <View style={estilos.frases}>
          {aFavor.map((f) => <Frase key={f} texto={f} favor />)}
          {enContra.map((f) => <Frase key={f} texto={f} favor={false} />)}
        </View>
      ) : null}
      {r.descripcion_busqueda ? (
        <View style={estilos.busca}>
          <ThemedText style={[Texto.etiqueta, { color: theme.textSecondary }]}>QUÉ BUSCA</ThemedText>
          <ThemedText style={Texto.cuerpo} numberOfLines={3}>{r.descripcion_busqueda}</ThemedText>
        </View>
      ) : null}
      <View style={estilos.acciones}>
        <View style={estilos.accion}>
          <BotonWeb variante="contorno" onPress={verPerfil} accessibilityLabel={`Ver perfil de ${r.nombre_completo}`}>Ver perfil</BotonWeb>
        </View>
        {restringida ? null : (
          <View style={estilos.accion}>
            <BotonWeb icono="chatbubble-ellipses-outline" onPress={() => void abrirChatCon(r.usuario_id)} accessibilityLabel={`Saludar a ${r.nombre_completo}`}>Saludar</BotonWeb>
          </View>
        )}
      </View>
    </View>
  );
}

function Frase({ texto, favor }: { texto: string; favor: boolean }) {
  const theme = useTheme();
  return (
    <View style={[estilos.frase, { backgroundColor: favor ? theme.tintedSurface : theme.background, borderColor: favor ? 'transparent' : theme.filete }]}>
      <Ionicons name={favor ? 'checkmark' : 'information-circle-outline'} size={14} color={favor ? theme.bosque : theme.textSecondary} />
      <ThemedText style={Texto.pequenoFuerte}>{texto}</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 60, height: 60, borderRadius: Radios.full, borderWidth: Filete.fino },
  avatarVacio: { alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  nombre: { flex: 1, minWidth: 0 },
  frases: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  frase: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Radios.full, borderWidth: Filete.fino },
  busca: { gap: Spacing.one },
  acciones: { flexDirection: 'row', gap: Spacing.two },
  accion: { flex: 1 },
});
