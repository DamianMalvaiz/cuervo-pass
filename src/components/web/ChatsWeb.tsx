import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ConversacionHilo } from '@/components/ConversacionHilo';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useConversaciones } from '@/hooks/queries/useChat';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { formateadorHora } from '@/lib/formatoHora';
import { medidasWeb } from '@/lib/medidasWeb';
import { useAuthStore } from '@/store/useAuthStore';

const ACTUAL = { 'aria-current': 'true' } as object;

/**
 * La bandeja de chats en la web. En escritorio es una sola página con dos paneles: las conversaciones a la izquierda y la elegida a la derecha, sin salir de la página. En teléfono y tableta es la lista, y tocar una
 * conversación abre su pantalla (el hilo es el mismo componente). Cuatro estados distintos (END-11): cargando, FALLÓ la lectura (nunca «sin conversaciones»), vacío y lista.
 */
export function ChatsWeb() {
  const { ancho } = useTamanoPantalla();
  const { escritorio, relleno } = medidasWeb(ancho);
  const miId = useAuthStore((s) => s.session?.user.id);
  const { conversaciones, cargando, fallo, reintentar } = useConversaciones(miId);
  const { urls } = useFotosFirmadas(conversaciones.map((c) => c.otroUsuario.foto_url));
  const [elegida, setElegida] = useState<string | null>(null);
  const actual = conversaciones.find((c) => c.conversacionId === elegida) ?? null;

  const lista = cargando ? (
    <ThemedText style={[Texto.pequeno, estilos.aviso]} themeColor="textSecondary">Cargando…</ThemedText>
  ) : conversaciones.length === 0 ? (
    fallo ? (
      <View style={estilos.aviso}>
        <ErrorDeCarga etiqueta="No pudimos cargar tus conversaciones" onReintentar={reintentar} />
      </View>
    ) : (
      <View style={estilos.aviso}>
        <ThemedText style={Texto.subtitulo}>Sin conversaciones</ThemedText>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Cuando pidas el contacto de una publicación o te escriba alguien, el hilo aparece aquí.</ThemedText>
      </View>
    )
  ) : (
    conversaciones.map((c) => (
      <FilaConversacion
        key={c.conversacionId}
        c={c}
        foto={c.otroUsuario.foto_url ? urls.get(c.otroUsuario.foto_url) : undefined}
        elegida={escritorio && elegida === c.conversacionId}
        onPress={() => (escritorio ? setElegida(c.conversacionId) : router.push(`/chat/${c.conversacionId}`))}
      />
    ))
  );

  if (!escritorio) {
    return (
      <PaginaSesionWeb titulo="Chats" subtitulo="Tus conversaciones con quien publica y con tus roomies.">
        <View>{lista}</View>
      </PaginaSesionWeb>
    );
  }
  return <Bandeja relleno={relleno} lista={lista} actual={actual} foto={actual?.otroUsuario.foto_url ? urls.get(actual.otroUsuario.foto_url) : undefined} elegida={elegida} />;
}

type Conv = ReturnType<typeof useConversaciones>['conversaciones'][number];

function Bandeja({ relleno, lista, actual, foto, elegida }: { relleno: number; lista: React.ReactNode; actual: Conv | null; foto: string | undefined; elegida: string | null }) {
  const theme = useTheme();
  return (
    <View style={[estilos.pagina, { paddingHorizontal: relleno }]}>
      <View style={[estilos.panel, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
        <View style={[estilos.izquierda, { borderRightColor: theme.filete }]}>
          <View style={[estilos.cabeza, { borderBottomColor: theme.filete }]}>
            <ThemedText accessibilityRole="header" style={Texto.seccionWebCompacto}>Chats</ThemedText>
          </View>
          <ScrollView>{lista}</ScrollView>
        </View>
        <View style={estilos.derecha}>
          {actual && elegida ? (
            <>
              <View style={[estilos.cabeza, estilos.cabezaHilo, { borderBottomColor: theme.filete }]}>
                <Avatar nombre={actual.otroUsuario.nombre_completo} foto={foto} />
                <ThemedText style={Texto.subtitulo} numberOfLines={1}>{actual.otroUsuario.nombre_completo}</ThemedText>
              </View>
              <ConversacionHilo key={elegida} conversacionId={elegida} />
            </>
          ) : (
            <View style={estilos.vacio}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.textSecondary} />
              <ThemedText style={Texto.subtitulo}>Elige una conversación</ThemedText>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Tus mensajes aparecen aquí, sin salir de la página.</ThemedText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function FilaConversacion({ c, foto, elegida, onPress }: { c: Conv; foto: string | undefined; elegida: boolean; onPress: () => void }) {
  const theme = useTheme();
  const noLeidos = c.noLeidos > 0;
  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversación con ${c.otroUsuario.nombre_completo}. ${noLeidos ? `${c.noLeidos} sin leer. ` : ''}${c.ultimoMensaje?.contenido ?? 'Sin mensajes todavía'}`}
      {...(elegida ? ACTUAL : {})}
      style={[estilos.fila, { borderBottomColor: theme.filete }, elegida && { backgroundColor: theme.backgroundSelected }]}
    >
      <Avatar nombre={c.otroUsuario.nombre_completo} foto={foto} />
      <View style={estilos.centro}>
        <ThemedText numberOfLines={1} style={noLeidos ? Texto.pesoFuerte : Texto.cuerpo}>{c.otroUsuario.nombre_completo}</ThemedText>
        <ThemedText style={Texto.pequeno} themeColor={noLeidos ? 'text' : 'textSecondary'} numberOfLines={1}>{c.ultimoMensaje?.contenido ?? 'Sin mensajes todavía'}</ThemedText>
      </View>
      <View style={estilos.extremo}>
        {c.ultimoMensaje ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">{formateadorHora.format(new Date(c.ultimoMensaje.creado_en))}</ThemedText> : null}
        {noLeidos ? (
          <View style={[estilos.insignia, { backgroundColor: theme.sello }]}>
            <ThemedText style={[Texto.pequenoFuerte, { color: theme.selloTexto }]}>{c.noLeidos > 99 ? '99+' : String(c.noLeidos)}</ThemedText>
          </View>
        ) : null}
      </View>
    </Pulsable>
  );
}

function Avatar({ nombre, foto }: { nombre: string | null; foto: string | undefined }) {
  const theme = useTheme();
  const inicial = (nombre ?? '?').trim().charAt(0).toUpperCase();
  return foto ? (
    <Image source={{ uri: foto }} style={[estilos.avatar, { borderColor: theme.filete }]} />
  ) : (
    <View style={[estilos.avatar, estilos.avatarVacio, { backgroundColor: theme.backgroundSelected, borderColor: theme.filete }]}>
      <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">{inicial}</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flex: 1, width: '100%', minHeight: 480, paddingTop: Spacing.three, paddingBottom: Spacing.four },
  panel: { flex: 1, flexDirection: 'row', borderWidth: Filete.fino, borderRadius: Radios.panel - Spacing.one, overflow: 'hidden' },
  izquierda: { width: 380, borderRightWidth: Filete.fino },
  derecha: { flex: 1, minWidth: 0 },
  cabeza: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderBottomWidth: Filete.fino, minHeight: 72, justifyContent: 'center' },
  cabezaHilo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: Spacing.three },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, minHeight: 76, borderBottomWidth: Filete.fino },
  centro: { flex: 1, minWidth: 0, gap: Spacing.half },
  extremo: { alignItems: 'flex-end', gap: Spacing.one },
  insignia: { minWidth: 22, minHeight: 22, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.one },
  avatar: { width: 48, height: 48, borderRadius: Radios.full, borderWidth: Filete.fino },
  avatarVacio: { alignItems: 'center', justifyContent: 'center' },
  aviso: { padding: Spacing.four, gap: Spacing.two },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.five },
});
