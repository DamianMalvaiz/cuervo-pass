import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { EsqueletoFilasWeb } from '@/components/web/EsqueletoWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useMisPublicaciones } from '@/hooks/queries/usePublicaciones';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useMiRoomie } from '@/hooks/queries/useRoomies';
import { useFotoPerfil } from '@/hooks/use-foto-perfil';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { funcionesDeVendedor } from '@/lib/funciones';
import { medidasWeb } from '@/lib/medidasWeb';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

const D = Colors.dark;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

interface Punto {
  clave: string;
  titulo: string;
  detalle: string;
  hecho: boolean;
  accion?: { texto: string; etiqueta: string; alPulsar: () => void };
}

/**
 * El perfil de quien busca, en la web: tu identidad (con la foto que se cambia desde el avatar), qué falta para completarlo, lo que declaraste buscar, «sobre mí», tu ficha de roomie y el acceso a vendedor. Cada punto de «completa
 * tu perfil» se calcula SOLO con datos reales: hecho o pendiente según lo que hay, y lo pendiente trae su acción. «Correo verificado» es literalmente lo que se sabe (no «usuario verificado»). Un fallo al leer el perfil se dice y se
 * puede reintentar: nunca se pinta como «sin nombre» ni «sin definir» (END-11). Los destinos de edición son las pantallas de siempre.
 */
export function PerfilWeb() {
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const { escritorio } = medidasWeb(ancho);
  const miId = useAuthStore((s) => s.session?.user.id);
  const perfil = usePerfilStore((s) => s.perfil);
  const cargando = usePerfilStore((s) => s.cargando);
  const error = usePerfilStore((s) => s.error);
  const cargarPerfil = usePerfilStore((s) => s.cargarPerfil);
  const { urlFoto, subiendoFoto, error: errorFoto, cambiarFoto } = useFotoPerfil();
  const { miRoomie } = useMiRoomie(miId);
  const { datos: publicaciones, cargando: cargandoPublicaciones } = useMisPublicaciones(miId);
  const { roles, fallo: falloRoles, reintentar: reintentarRoles } = useMisRoles(miId);
  const { cambiar } = usePerfilActivo(miId);
  const [cambiandoPerfil, setCambiandoPerfil] = useState(false);

  useEffect(() => {
    if (miId) cargarPerfil(miId);
  }, [miId, cargarPerfil]);

  const funciones = funcionesDeVendedor(roles);
  const tieneVendedor = funciones.length > 0;
  const falta = funciones.length === 1 ? (funciones[0] === 'arrendador' ? 'un negocio o servicio' : 'un depa para rentar') : null;
  const aVendedor = async () => {
    if (cambiandoPerfil) return;
    setCambiandoPerfil(true);
    try {
      await cambiar('vendedor');
      router.replace('/(tabs)/panel');
    } catch {
      toast.error('No pudimos cambiar de perfil. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setCambiandoPerfil(false);
    }
  };

  if (cargando && !perfil) {
    return (
      <PaginaSesionWeb titulo="Mi perfil">
        <EsqueletoFilasWeb filas={4} />
      </PaginaSesionWeb>
    );
  }
  if (!perfil && error) {
    return (
      <PaginaSesionWeb titulo="Mi perfil">
        <ErrorDeCarga etiqueta="No pudimos cargar tu perfil" onReintentar={() => miId && void cargarPerfil(miId)} />
      </PaginaSesionWeb>
    );
  }

  const presupuesto = perfil?.presupuesto_min != null && perfil?.presupuesto_max != null ? `$${perfil.presupuesto_min.toLocaleString('es-MX')} a $${perfil.presupuesto_max.toLocaleString('es-MX')}` : 'sin definir';
  const distancia = perfil?.distancia_max_km != null ? `Hasta ${perfil.distancia_max_km} km` : 'sin definir';
  const sobreMi = perfil?.biografia?.trim();
  const apareceEnRoomies = miRoomie?.estado === 'activo';
  const descripcionRoomie = apareceEnRoomies ? 'Activa: apareces en la lista de roomies.' : miRoomie ? 'Pausada: no apareces en la lista.' : 'Sin crear. Nadie te encuentra como roomie.';
  const activas = publicaciones.filter((p) => p.activa).length;

  const puntos: Punto[] = [
    { clave: 'correo', titulo: 'Correo universitario', detalle: perfil?.correo_verificado ? 'Verificado' : 'Sin verificar', hecho: Boolean(perfil?.correo_verificado) },
    {
      clave: 'presupuesto',
      titulo: 'Presupuesto y distancia',
      detalle: perfil?.presupuesto_max != null && perfil?.distancia_max_km != null ? `Hasta $${perfil.presupuesto_max.toLocaleString('es-MX')} · ${perfil.distancia_max_km} km` : 'Dinos cuánto y qué tan lejos',
      hecho: perfil?.presupuesto_max != null && perfil?.distancia_max_km != null,
      accion: { texto: 'Completar', etiqueta: 'Completar presupuesto y distancia', alPulsar: () => router.push('/perfil/preferencias') },
    },
    {
      clave: 'habitos',
      titulo: 'Hábitos de convivencia',
      detalle: perfil?.nivel_ruido && perfil?.horario_predominante ? `Ruido ${perfil.nivel_ruido} · horario ${perfil.horario_predominante}` : 'Ruido, horario y mascotas',
      hecho: Boolean(perfil?.nivel_ruido && perfil?.horario_predominante),
      accion: { texto: 'Completar', etiqueta: 'Completar hábitos de convivencia', alPulsar: () => router.push('/perfil/preferencias') },
    },
    { clave: 'foto', titulo: 'Foto de perfil', detalle: perfil?.foto_url ? 'Lista' : 'Da confianza a quien no puede visitarte', hecho: Boolean(perfil?.foto_url), accion: { texto: 'Agregar', etiqueta: 'Agregar foto de perfil', alPulsar: () => void cambiarFoto() } },
    { clave: 'sobremi', titulo: 'Sobre mí', detalle: sobreMi ? 'Escrito' : 'Una frase para tu ficha', hecho: Boolean(sobreMi), accion: { texto: 'Escribir', etiqueta: 'Escribir sobre mí', alPulsar: () => router.push('/perfil/sobre-mi') } },
    { clave: 'roomie', titulo: 'Ficha de roomie', detalle: apareceEnRoomies ? 'Activa' : 'Para que te encuentren', hecho: apareceEnRoomies, accion: { texto: 'Activar', etiqueta: 'Activar mi ficha de roomie', alPulsar: () => router.push('/roomies') } },
  ];
  const hechos = puntos.filter((p) => p.hecho).length;

  const inicial = (perfil?.nombre_completo ?? '?').trim().charAt(0).toUpperCase();
  const encabezado = (
    <View style={[estilos.cabecera, { backgroundColor: theme.background === D.background ? D.backgroundElement : D.background }]}>
      <Pulsable
        onPress={() => void cambiarFoto()}
        disabled={subiendoFoto}
        accessibilityRole="button"
        accessibilityLabel={urlFoto ? 'Cambiar tu foto de perfil' : 'Agregar una foto de perfil'}
        accessibilityState={{ busy: subiendoFoto }}
        style={estilos.envolturaFoto}
      >
        {urlFoto ? (
          <Image source={{ uri: urlFoto }} style={estilos.foto} />
        ) : (
          <View style={[estilos.foto, estilos.sinFoto]}>
            <Text style={[Texto.titulo, { color: D.limaTexto }]}>{inicial}</Text>
          </View>
        )}
        <View style={[estilos.camara, { backgroundColor: theme.bosque, borderColor: D.background }]}>
          {subiendoFoto ? <ActivityIndicator size="small" color={theme.bosqueTexto} /> : <Ionicons name="camera" size={16} color={theme.bosqueTexto} />}
        </View>
      </Pulsable>
      <View style={estilos.identidad}>
        <Text accessibilityRole="header" style={[escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto, { color: D.text }]} numberOfLines={2}>{perfil?.nombre_completo ?? 'Sin nombre'}</Text>
        <ThemedText style={[Texto.cuerpo, { color: D.textSecondary }]}>{`@${perfil?.nombre_usuario ?? '—'}`}</ThemedText>
        {perfil?.universidad ? <ThemedText style={[Texto.pequeno, { color: D.textSecondary }]}>{perfil.universidad}</ThemedText> : null}
        {perfil?.correo_verificado ? (
          <View style={estilos.insignia}>
            <Ionicons name="shield-checkmark-outline" size={16} color={D.limaTexto} />
            <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>Correo verificado</ThemedText>
          </View>
        ) : null}
        {errorFoto ? <ThemedText style={[Texto.pequeno, { color: D.textSecondary }]}>{errorFoto}</ThemedText> : null}
      </View>
      <View style={estilos.accionesCabecera}>
        <BotonWeb compacto variante="contornoClaro" onPress={() => miId && router.push(`/perfil/${miId}` as never)} accessibilityLabel="Ver cómo me ven">Cómo me ven</BotonWeb>
      </View>
    </View>
  );

  const progreso = (
    <Panel>
      <View style={estilos.panelCabeza}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Completa tu perfil</ThemedText>
        <ThemedText style={[Texto.pequenoFuerte, { color: theme.textSecondary }]}>{`${hechos} de ${puntos.length}`}</ThemedText>
      </View>
      <View style={[estilos.barra, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[estilos.relleno, { width: `${(hechos / puntos.length) * 100}%`, backgroundColor: theme.bosque }]} />
      </View>
      {puntos.map((p) => (
        <View key={p.clave} style={[estilos.punto, { borderTopColor: theme.filete }]}>
          <View style={[estilos.marca, p.hecho ? { backgroundColor: theme.bosque } : { borderColor: theme.textSecondary, borderWidth: 2, borderStyle: 'dashed' }]}>
            {p.hecho ? <Ionicons name="checkmark" size={15} color={theme.bosqueTexto} /> : null}
          </View>
          <View style={estilos.puntoTexto}>
            <ThemedText style={Texto.pesoFuerte}>{p.titulo}</ThemedText>
            <ThemedText style={Texto.pequeno} themeColor="textSecondary">{p.detalle}</ThemedText>
          </View>
          {!p.hecho && p.accion ? (
            <Pulsable onPress={p.accion.alPulsar} accessibilityRole="button" accessibilityLabel={p.accion.etiqueta} style={estilos.accionPunto}>
              <ThemedText style={[Texto.pequenoFuerte, { color: theme.acento }]}>{p.accion.texto}</ThemedText>
              <Ionicons name="chevron-forward" size={14} color={theme.acento} />
            </Pulsable>
          ) : null}
        </View>
      ))}
    </Panel>
  );

  const busqueda = (
    <Panel>
      <View style={estilos.panelCabeza}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Mi búsqueda</ThemedText>
        <Pulsable onPress={() => router.push('/perfil/preferencias')} accessibilityRole="button" accessibilityLabel="Editar mi búsqueda" style={estilos.accionPunto}>
          <ThemedText style={[Texto.pequenoFuerte, { color: theme.acento }]}>Editar</ThemedText>
          <Ionicons name="chevron-forward" size={14} color={theme.acento} />
        </Pulsable>
      </View>
      <Dato icono="cash-outline" k="Presupuesto al mes" v={presupuesto} />
      <Dato icono="location-outline" k="Distancia máxima" v={distancia} />
      <Dato icono="business-outline" k="Estudio en" v={perfil?.universidad ?? 'sin definir'} />
    </Panel>
  );

  const lado = (
    <View style={estilos.columna}>
      <Panel>
        <View style={estilos.panelCabeza}>
          <ThemedText accessibilityRole="header" style={Texto.titulo}>Sobre mí</ThemedText>
          <Pulsable onPress={() => router.push('/perfil/sobre-mi')} accessibilityRole="button" accessibilityLabel="Editar sobre mí" style={estilos.accionPunto}>
            <ThemedText style={[Texto.pequenoFuerte, { color: theme.acento }]}>Editar</ThemedText>
            <Ionicons name="chevron-forward" size={14} color={theme.acento} />
          </Pulsable>
        </View>
        <ThemedText style={Texto.cuerpo} themeColor={sobreMi ? 'text' : 'textSecondary'}>{sobreMi ? sobreMi : 'Todavía no has escrito nada.'}</ThemedText>
      </Panel>
      <Panel>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Mi ficha de roomie</ThemedText>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{descripcionRoomie}</ThemedText>
        <BotonWeb compacto variante="contorno" onPress={() => router.push('/roomies')} accessibilityLabel="Ir a Roomies">Ir a Roomies</BotonWeb>
      </Panel>
      {!cargandoPublicaciones && publicaciones.length > 0 ? (
        <Panel>
          <ThemedText accessibilityRole="header" style={Texto.titulo}>Mis publicaciones</ThemedText>
          <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{`${plural(publicaciones.length, 'publicada', 'publicadas')} · ${plural(activas, 'activa', 'activas')}`}</ThemedText>
          <BotonWeb compacto variante="contorno" onPress={() => router.push('/(tabs)/publicar')} accessibilityLabel="Ver mis publicaciones">Ver mis publicaciones</BotonWeb>
        </Panel>
      ) : null}
      {falloRoles ? (
        <ErrorDeCarga etiqueta="No pudimos comprobar tu perfil de vendedor" onReintentar={reintentarRoles} />
      ) : (
        <Panel>
          <ThemedText accessibilityRole="header" style={Texto.titulo}>Perfil de vendedor</ThemedText>
          {tieneVendedor ? (
            <>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Tu panel, tu verificación y lo que publicas.</ThemedText>
              <BotonWeb compacto onPress={() => void aVendedor()} accessibilityLabel="Ir a mi perfil de vendedor">Ir a mi perfil de vendedor</BotonWeb>
            </>
          ) : (
            <>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">¿Tienes un negocio o un depa para rentar?</ThemedText>
              <BotonWeb compacto variante="contorno" onPress={() => router.push('/perfil/crear-vendedor')} accessibilityLabel="Crea tu perfil de vendedor">Crea tu perfil de vendedor</BotonWeb>
            </>
          )}
          {falta ? <BotonWeb compacto variante="contorno" onPress={() => router.push('/perfil/crear-vendedor')} accessibilityLabel="Agregar otro tipo de perfil">{`¿También tienes ${falta}?`}</BotonWeb> : null}
        </Panel>
      )}
      <Panel>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Cuenta</ThemedText>
        <View style={estilos.enlaces}>
          <BotonWeb compacto variante="contorno" onPress={() => router.push('/notificaciones')} accessibilityLabel="Notificaciones">Notificaciones</BotonWeb>
          <BotonWeb compacto variante="contorno" onPress={() => router.push('/configuracion')} accessibilityLabel="Configuración">Configuración</BotonWeb>
        </View>
      </Panel>
    </View>
  );

  return (
    <PaginaSesionWeb titulo="Mi perfil" subtitulo="Tu cuenta, lo que buscas y cómo te ven los demás.">
      {encabezado}
      <View style={escritorio ? estilos.dos : estilos.uno}>
        <View style={estilos.principal}>
          {progreso}
          {busqueda}
        </View>
        <View style={escritorio ? estilos.ladoAncho : undefined}>{lado}</View>
      </View>
    </PaginaSesionWeb>
  );
}

function Panel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[estilos.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>{children}</View>;
}

function Dato({ icono, k, v }: { icono: keyof typeof Ionicons.glyphMap; k: string; v: string }) {
  const theme = useTheme();
  return (
    <View style={[estilos.dato, { borderTopColor: theme.filete }]}>
      <View style={[estilos.iconoDato, { backgroundColor: theme.tintedSurface }]}>
        <Ionicons name={icono} size={22} color={theme.bosque} />
      </View>
      <View style={estilos.puntoTexto}>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">{k}</ThemedText>
        <ThemedText style={Texto.pesoFuerte}>{v}</ThemedText>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, flexWrap: 'wrap', padding: Spacing.five, borderRadius: Radios.panel },
  envolturaFoto: { width: 96, height: 96 },
  foto: { width: 96, height: 96, borderRadius: Radios.full },
  sinFoto: { backgroundColor: D.lima, alignItems: 'center', justifyContent: 'center' },
  camara: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  identidad: { flex: 1, minWidth: 220, gap: Spacing.one },
  insignia: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half, alignSelf: 'flex-start', backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, marginTop: Spacing.one },
  accionesCabecera: { flexDirection: 'row', gap: Spacing.two },
  dos: { flexDirection: 'row', gap: Spacing.five, alignItems: 'flex-start' },
  uno: { gap: Spacing.four },
  principal: { flex: 1, minWidth: 0, gap: Spacing.four },
  ladoAncho: { width: 400 },
  columna: { gap: Spacing.four },
  panel: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino },
  panelCabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  barra: { height: 8, borderRadius: Radios.full, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: Radios.full },
  punto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three, borderTopWidth: Filete.fino },
  marca: { width: 26, height: 26, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  puntoTexto: { flex: 1, minWidth: 0, gap: Spacing.half },
  accionPunto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, minHeight: 44 },
  dato: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three, borderTopWidth: Filete.fino },
  iconoDato: { width: 44, height: 44, borderRadius: Radios.control, alignItems: 'center', justifyContent: 'center' },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
