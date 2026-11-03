import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { etiquetaAfinidad } from '@/components/TarjetaRoomie';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EsqueletoFilasWeb } from '@/components/web/EsqueletoWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useAfinidadRoomie, usePerfilPublico } from '@/hooks/queries/usePerfilPublico';
import { useCuentaRestringida } from '@/hooks/queries/useCuentaRestringida';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTheme } from '@/hooks/use-theme';
import { abrirChatCon } from '@/lib/abrirChat';
import { reportarUsuario } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { PerfilPublico } from '@/types/database.types';

const RUIDO: Record<string, string> = { bajo: 'Prefiere silencio', medio: 'Ruido normal', alto: 'Ambiente animado' };
const HORARIO: Record<string, string> = { diurno: 'De día', nocturno: 'De noche', mixto: 'Variable' };
const MOTIVOS = ['comportamiento sospechoso', 'información falsa'];

/**
 * El perfil de una persona (roomie) en la web, para quien tiene cuenta. Solo lo que la vista `perfiles_publicos` deja ver: foto, nombre, biografía y convivencia, SIN presupuesto ni universidad. La afinidad se dice en palabras
 * (alta, media, baja) y, sin ficha activa con qué comparar, dice «Sin datos para comparar» y NO «baja». «Correo verificado» dice solo eso: no se verifican identidades. Sin cuenta pide entrar. Tres estados distintos (END-11):
 * cargando, FALLÓ la lectura y «no se encontró». El reporte se hace aquí mismo (la web no tiene los diálogos de la app).
 */
export function PerfilRoomieWeb() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const miId = useAuthStore((s) => s.session?.user.id);
  const { perfil, cargando, fallo, reintentar } = usePerfilPublico(miId ? usuarioId : undefined);

  let cuerpo;
  if (!miId) {
    cuerpo = (
      <View style={estilos.centrado}>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Los perfiles de roomies se ven al iniciar sesión.</ThemedText>
        <BotonWeb onPress={() => router.push('/(auth)/login')} accessibilityLabel="Iniciar sesión para ver el perfil">Iniciar sesión</BotonWeb>
      </View>
    );
  } else if (fallo) cuerpo = <ErrorDeCarga etiqueta="No pudimos cargar este perfil" onReintentar={reintentar} />;
  else if (cargando) cuerpo = <EsqueletoFilasWeb filas={3} />;
  else if (!perfil) cuerpo = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">No se encontró este perfil.</ThemedText>;
  else cuerpo = <Ficha perfil={perfil} miId={miId} />;

  return (
    <PaginaSesionWeb titulo={perfil?.nombre_completo ?? 'Perfil'}>
      <View style={estilos.cuerpo}>{cuerpo}</View>
    </PaginaSesionWeb>
  );
}

function Ficha({ perfil, miId }: { perfil: PerfilPublico; miId: string }) {
  const theme = useTheme();
  const { urls } = useFotosFirmadas([perfil.foto_url]);
  const foto = perfil.foto_url ? urls.get(perfil.foto_url) : undefined;
  const { afinidad } = useAfinidadRoomie(perfil.id);
  const restringida = useCuentaRestringida(miId);
  const esPropio = miId === perfil.id;
  const [abriendo, setAbriendo] = useState(false);
  const [reportando, setReportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const nivel = afinidad?.similitud != null ? etiquetaAfinidad(afinidad.similitud) : null;
  const inicial = perfil.nombre_completo.trim().charAt(0).toUpperCase();

  const iniciarChat = async () => {
    if (abriendo) return;
    setAbriendo(true);
    try {
      await abrirChatCon(perfil.id);
    } finally {
      setAbriendo(false);
    }
  };
  const reportar = async (motivo: string) => {
    setReportando(false);
    try {
      await reportarUsuario(miId, perfil.id, motivo);
      setAviso('Reporte registrado. Al tercer reporte de cuentas distintas, el perfil se suspende y deja de aparecer en la app. Si corres peligro, no uses solo esta app: avisa a alguien de confianza.');
    } catch (e) {
      // 23505 = ya lo habías reportado (el índice único existe para que una sola cuenta no empuje el contador).
      setAviso((e as { code?: string })?.code === '23505' ? 'No se pudo enviar el reporte. Ya habías reportado a esta persona.' : 'No se pudo enviar el reporte. Intenta de nuevo en un momento.');
    }
  };

  return (
    <>
      <View style={[estilos.identidad, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
        {foto ? (
          <Image source={{ uri: foto }} style={[estilos.avatar, { borderColor: theme.filete }]} accessibilityLabel={`Foto de ${perfil.nombre_completo}`} />
        ) : (
          <View style={[estilos.avatar, estilos.avatarVacio, { backgroundColor: theme.tintedSurface }]}>
            <ThemedText style={[Texto.titulo, { color: theme.bosque }]}>{inicial}</ThemedText>
          </View>
        )}
        <View style={estilos.nombre}>
          <ThemedText accessibilityRole="header" style={Texto.seccionWebCompacto} numberOfLines={2}>{perfil.nombre_completo}</ThemedText>
          <ThemedText style={Texto.cuerpo} themeColor="textSecondary">@{perfil.nombre_usuario}</ThemedText>
          {perfil.correo_verificado ? (
            <View style={estilos.fila}>
              <Ionicons name="mail-outline" size={16} color={theme.bosque} />
              <ThemedText style={Texto.pequenoFuerte}>Correo verificado</ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[estilos.bloque, { borderColor: theme.filete }]}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Afinidad</ThemedText>
        <ThemedText style={[Texto.subtitulo, { color: nivel ? theme.acento : theme.textSecondary }]}>{nivel ? `Afinidad ${nivel.toLowerCase()}` : 'Sin datos para comparar'}</ThemedText>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">
          {nivel ? 'Entre lo que escribiste de ti y lo que esta persona busca.' : 'Esta persona no tiene ficha de roomie activa, así que no hay con qué comparar.'}
        </ThemedText>
      </View>

      <View style={[estilos.bloque, { borderColor: theme.filete }]}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Convivencia</ThemedText>
        <View style={estilos.rejilla}>
          <Dato icono="volume-low-outline" etiqueta="Nivel de ruido" valor={perfil.nivel_ruido ? RUIDO[perfil.nivel_ruido] : 'Sin especificar'} />
          <Dato icono="moon-outline" etiqueta="Horario" valor={perfil.horario_predominante ? HORARIO[perfil.horario_predominante] : 'Sin especificar'} />
          <Dato icono="paw-outline" etiqueta="Mascotas" valor={perfil.mascotas ? 'Sí tiene' : 'No tiene'} />
          <Dato icono="ban-outline" etiqueta="Tabaco" valor={perfil.fuma ? 'Sí fuma' : 'No fuma'} />
        </View>
      </View>

      {perfil.biografia ? (
        <View style={[estilos.bloque, { borderColor: theme.filete }]}>
          <ThemedText accessibilityRole="header" style={Texto.titulo}>Sobre mí</ThemedText>
          <ThemedText style={Texto.cuerpo}>{perfil.biografia}</ThemedText>
        </View>
      ) : null}

      {esPropio ? (
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">Así te ven las demás personas.</ThemedText>
      ) : restringida ? (
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">Una cuenta de vendedor no inicia conversaciones ni reporta. Sí puedes responder a quien te escribe.</ThemedText>
      ) : (
        <View style={estilos.acciones}>
          <BotonWeb icono="chatbubble-ellipses-outline" onPress={iniciarChat} accessibilityLabel={`Iniciar chat con ${perfil.nombre_completo}`}>{abriendo ? 'Abriendo…' : 'Iniciar chat'}</BotonWeb>
          <BotonWeb variante="contorno" icono="flag-outline" onPress={() => { setAviso(null); setReportando((r) => !r); }} accessibilityLabel="Reportar usuario">Reportar usuario</BotonWeb>
        </View>
      )}

      {reportando ? (
        <View style={[estilos.bloque, { borderColor: theme.filete }]} role="group" aria-label="Motivo del reporte">
          <ThemedText style={Texto.pequenoFuerte}>¿Por qué lo reportas?</ThemedText>
          <View style={estilos.acciones}>
            {MOTIVOS.map((m) => (
              <Pulsable key={m} onPress={() => reportar(m)} accessibilityRole="button" accessibilityLabel={`Reportar: ${m}`} style={[estilos.motivo, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={Texto.pequenoFuerte}>{m.charAt(0).toUpperCase() + m.slice(1)}</ThemedText>
              </Pulsable>
            ))}
          </View>
        </View>
      ) : null}
      {aviso ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" accessibilityRole="alert">{aviso}</ThemedText> : null}
    </>
  );
}

function Dato({ icono, etiqueta, valor }: { icono: keyof typeof Ionicons.glyphMap; etiqueta: string; valor: string }) {
  const theme = useTheme();
  return (
    <View style={estilos.dato}>
      <Ionicons name={icono} size={20} color={theme.bosque} />
      <View>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">{etiqueta}</ThemedText>
        <ThemedText style={Texto.pequenoFuerte}>{valor}</ThemedText>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cuerpo: { gap: Spacing.four, maxWidth: 760 },
  centrado: { gap: Spacing.three, alignItems: 'flex-start' },
  identidad: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.four, padding: Spacing.four, borderRadius: Radios.tarjeta, borderWidth: Filete.fino },
  avatar: { width: 104, height: 104, borderRadius: Radios.full, borderWidth: Filete.fino },
  avatarVacio: { alignItems: 'center', justifyContent: 'center' },
  nombre: { flex: 1, minWidth: 200, gap: Spacing.one },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half },
  bloque: { gap: Spacing.two, paddingTop: Spacing.four, borderTopWidth: Filete.fino },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.five, rowGap: Spacing.three },
  dato: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minWidth: 220 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  motivo: { minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
});
