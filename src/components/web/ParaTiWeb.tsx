import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { BuscadorWeb } from '@/components/web/BuscadorWeb';
import { EsqueletoFilasWeb, EsqueletoTarjetasWeb } from '@/components/web/EsqueletoWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { TarjetaRoomieWeb } from '@/components/web/TarjetaRoomieWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useConversaciones } from '@/hooks/queries/useChat';
import { usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { useMisFavoritosIds } from '@/hooks/queries/useFavoritos';
import { useSugerencias } from '@/hooks/queries/usePublicaciones';
import { useRoomiesSugeridos } from '@/hooks/queries/useRoomies';
import { useFotosFirmadas } from '@/hooks/use-fotos-firmadas';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { rutaDeConversacion } from '@/lib/abrirChat';
import { FILTROS_VACIOS, type FiltrosWeb } from '@/lib/filtrosWeb';
import { formateadorHora } from '@/lib/formatoHora';
import { HUECO_WEB, medidasWeb } from '@/lib/medidasWeb';
import { anim } from '@/lib/movimientoWeb';
import { primerNombre, saludoDe } from '@/lib/paraTi';
import { etiquetaDeAjuste, razonesDeAjuste } from '@/lib/razonesDeAjuste';
import { RutasWeb, aParametros } from '@/lib/rutasWeb';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

const D = Colors.dark;
const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const MAX_ROOMIES = 3;
const MAX_MENSAJES = 3;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * «Para ti»: lo primero que ve quien ya entró. Saludo por la hora y el nombre (solo si se sabe), tres cifras que se cuentan de verdad, el buscador con tu presupuesto ya puesto, lo que mejor encaja contigo (el ajuste en
 * PALABRAS y solo si se cumple: por debajo de 0.5 se calla; y solo razones que de verdad se cumplen), los roomies que podrían encajar, lo que declaraste buscar y tus mensajes. Cada bloque lee, falla y se recupera
 * por su cuenta, y un FALLO nunca se pinta como «no hay nada» (END-11). Una cifra que no se pudo leer no se pinta: nunca un cero que mienta.
 */
export function ParaTiWeb() {
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const { escritorio, telefono, columnas, anchoTarjeta } = medidasWeb(ancho);
  // El panel de saludo es siempre de carbón; en modo oscuro la página también lo es, así que sube un tono para que se distinga.
  const fondoHola = theme.background === D.background ? D.backgroundElement : D.background;
  const sesion = useAuthStore((s) => s.session);
  const miId = sesion?.user.id;
  const nombre = primerNombre(sesion?.user.user_metadata?.nombre_completo as string | undefined);
  const perfil = usePerfilStore((s) => s.perfil);
  const perfilCargando = usePerfilStore((s) => s.cargando);
  const perfilError = usePerfilStore((s) => s.error);
  const cargarPerfil = usePerfilStore((s) => s.cargarPerfil);
  useEffect(() => {
    if (miId) cargarPerfil(miId);
  }, [miId, cargarPerfil]);

  const sugerencias = useSugerencias(null);
  const cuantos = columnas;
  const mejores = sugerencias.datos.slice(0, cuantos);
  const ids = mejores.map((s) => s.id);
  const viviendas = usePublicacionesPorIds(ids);
  const roomies = useRoomiesSugeridos(true);
  const chats = useConversaciones(miId);
  const guardados = useMisFavoritosIds(miId);
  const { urls } = useFotosFirmadas(roomies.roomies.slice(0, MAX_ROOMIES).map((r) => r.foto_url));

  const [filtros, setFiltros] = useState<FiltrosWeb>(() => ({ ...FILTROS_VACIOS, presupuesto: perfil?.presupuesto_max ? String(perfil.presupuesto_max) : '' }));
  const buscar = () => router.push({ pathname: RutasWeb.departamentos, params: aParametros(filtros) });

  const encajan = sugerencias.datos.filter((s) => etiquetaDeAjuste(s.score_final) !== null).length;
  const sinLeer = chats.conversaciones.reduce((n, c) => n + c.noLeidos, 0);
  const hora = new Date().getHours();
  const cifras: { n: number; texto: string; etiqueta: string }[] = [];
  if (!sugerencias.cargando && !sugerencias.fallo) cifras.push({ n: encajan, texto: encajan === 1 ? 'lugar encaja contigo' : 'lugares encajan contigo', etiqueta: `${plural(encajan, 'lugar encaja', 'lugares encajan')} contigo` });
  if (!chats.cargando && !chats.fallo) cifras.push({ n: sinLeer, texto: sinLeer === 1 ? 'mensaje sin leer' : 'mensajes sin leer', etiqueta: plural(sinLeer, 'mensaje sin leer', 'mensajes sin leer') });
  if (!guardados.cargando && !guardados.fallo) cifras.push({ n: guardados.ids.size, texto: guardados.ids.size === 1 ? 'guardado' : 'guardados', etiqueta: plural(guardados.ids.size, 'guardado', 'guardados') });

  const ordenadas = ids.map((id) => viviendas.publicaciones.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  let lugares;
  if (sugerencias.fallo || viviendas.fallo) {
    lugares = <ErrorDeCarga etiqueta="No pudimos cargar lo que encaja contigo" onReintentar={() => { void sugerencias.refrescar(); viviendas.reintentar(); }} />;
  } else if (sugerencias.cargando || viviendas.cargando) {
    lugares = <EsqueletoTarjetasWeb cuantas={cuantos} ancho={anchoTarjeta} />;
  } else if (sugerencias.datos.length === 0) {
    lugares = (
      <View style={estilos.vacio}>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay lugares que encajen contigo. Explora todos mientras llegan nuevos.</ThemedText>
        <BotonWeb variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Explorar lugares">Explorar lugares</BotonWeb>
      </View>
    );
  } else {
    lugares = (
      <View style={estilos.cuadricula}>
        {ordenadas.map((p, i) => {
          const s = mejores.find((m) => m.id === p.id);
          const razon = s
            ? razonesDeAjuste({ precio: s.precio_renta, presupuestoMax: perfil?.presupuesto_max, distanciaKm: s.distancia, distanciaMaxKm: perfil?.distancia_max_km, permiteMascotas: s.permite_mascotas, tengoMascotas: Boolean(perfil?.mascotas) })[0]
            : undefined;
          return <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} compacta={telefono} paso={i} etiqueta={etiquetaDeAjuste(s?.score_final) ?? undefined} razon={razon} />;
        })}
      </View>
    );
  }

  let personas;
  if (roomies.fallo) personas = <ErrorDeCarga etiqueta="No pudimos cargar los roomies" onReintentar={roomies.reintentar} />;
  else if (roomies.cargando) personas = <EsqueletoFilasWeb filas={MAX_ROOMIES} />;
  else if (roomies.roomies.length === 0) personas = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Todavía no hay personas buscando roomie.</ThemedText>;
  else {
    personas = (
      <View style={estilos.personas}>
        {roomies.roomies.slice(0, MAX_ROOMIES).map((r, i) => (
          <View key={r.id} style={estilos.persona}>
            <TarjetaRoomieWeb r={r} foto={r.foto_url ? urls.get(r.foto_url) : undefined} compacta paso={i} />
          </View>
        ))}
      </View>
    );
  }

  const lado = (
    <View style={estilos.lado}>
      <View style={[estilos.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Tu búsqueda</ThemedText>
        {perfilError && !perfil ? (
          <ErrorDeCarga etiqueta="No pudimos leer tu búsqueda" onReintentar={() => miId && cargarPerfil(miId)} />
        ) : perfil ? (
          <View>
            {perfil.presupuesto_max != null ? <Fila k="Presupuesto" v={`Hasta $${precio.format(perfil.presupuesto_max)}`} /> : null}
            {perfil.distancia_max_km != null ? <Fila k="Distancia" v={`${perfil.distancia_max_km} km`} /> : null}
            {perfil.universidad ? <Fila k="Universidad" v={perfil.universidad} /> : null}
            <Fila k="Mascotas" v={perfil.mascotas ? 'Tengo' : 'No tengo'} />
          </View>
        ) : (
          <ThemedText style={Texto.pequeno} themeColor="textSecondary">{perfilCargando ? 'Cargando…' : 'Todavía no hay preferencias guardadas.'}</ThemedText>
        )}
      </View>
      <View style={[estilos.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
        <View style={estilos.panelCabeza}>
          <ThemedText accessibilityRole="header" style={Texto.titulo}>Mensajes</ThemedText>
          <Pulsable onPress={() => router.push('/(tabs)/chats')} accessibilityRole="link" accessibilityLabel="Ver todos los mensajes" style={estilos.enlace}>
            <ThemedText style={[Texto.pequenoFuerte, { color: theme.acento }]}>Ver todos</ThemedText>
          </Pulsable>
        </View>
        {chats.fallo && chats.conversaciones.length === 0 ? (
          <ErrorDeCarga etiqueta="No pudimos cargar tus mensajes" onReintentar={chats.reintentar} />
        ) : chats.cargando ? (
          <EsqueletoFilasWeb filas={2} />
        ) : chats.conversaciones.length === 0 ? (
          <ThemedText style={Texto.pequeno} themeColor="textSecondary">Sin mensajes todavía</ThemedText>
        ) : (
          chats.conversaciones.slice(0, MAX_MENSAJES).map((c) => {
            const quien = c.otroUsuario.nombre_completo ?? 'Conversación';
            return (
              <Pulsable
                key={c.conversacionId}
                onPress={() => router.push(rutaDeConversacion(c.conversacionId, 'web', ancho) as never)}
                accessibilityRole="button"
                accessibilityLabel={`Conversación con ${quien}${c.noLeidos > 0 ? `, ${c.noLeidos} sin leer` : ''}`}
                style={[estilos.mensaje, { borderTopColor: theme.filete }]}
              >
                <View style={[estilos.inicial, { backgroundColor: c.noLeidos > 0 ? theme.sello : theme.tintedSurface }]}>
                  <ThemedText style={[Texto.pequenoFuerte, { color: c.noLeidos > 0 ? theme.selloTexto : theme.bosque }]}>{quien.trim().charAt(0).toUpperCase()}</ThemedText>
                </View>
                <View style={estilos.mensajeTexto}>
                  <ThemedText style={c.noLeidos > 0 ? Texto.pesoFuerte : Texto.cuerpo} numberOfLines={1}>{quien}</ThemedText>
                  <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{c.ultimoMensaje?.contenido ?? 'Sin mensajes todavía'}</ThemedText>
                </View>
                {c.ultimoMensaje ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">{formateadorHora.format(new Date(c.ultimoMensaje.creado_en))}</ThemedText> : null}
              </Pulsable>
            );
          })
        )}
      </View>
    </View>
  );

  return (
    <PaginaWeb activa={null} titulo="Para ti">
      <View style={[estilos.hola, !escritorio && estilos.holaCompacto, { backgroundColor: fondoHola }]}>
        <View style={estilos.holaMapa} pointerEvents="none" {...anim('traza')}>
          <Image source={require('../../../assets/images/web/topografia.svg')} style={estilos.holaImagen} contentFit="cover" accessible={false} />
        </View>
        <View style={estilos.holaTexto}>
          <Text accessibilityRole="header" style={[escritorio ? Texto.titularWeb : Texto.titularWebCompacto, { color: D.text }]} {...anim('sube')}>
            {nombre ? <>{saludoDe(hora)}, <Text style={{ color: D.lima }}>{`${nombre}.`}</Text></> : `${saludoDe(hora)}.`}
          </Text>
          {cifras.length > 0 ? (
            <View style={estilos.cifras} {...anim('sube', 1)}>
              {cifras.map((c) => (
                <View key={c.texto} style={estilos.cifra} accessible accessibilityLabel={c.etiqueta}>
                  <Text style={[Texto.seccionWeb, { color: D.lima }]}>{c.n}</Text>
                  <ThemedText style={[Texto.pequeno, { color: D.textSecondary }]}>{c.texto}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={escritorio ? estilos.holaBusca : undefined} {...anim('sube', 2)}>
          <BuscadorWeb compacto={!escritorio} filtros={filtros} onCambiar={setFiltros} onBuscar={buscar} />
        </View>
      </View>

      <View style={estilos.seccion}>
        <View style={estilos.cabecera}>
          <View style={estilos.cabeceraTexto}>
            <ThemedText accessibilityRole="header" style={escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto}>Lo que mejor encaja contigo</ThemedText>
            {telefono ? null : <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Ordenado por tu ajuste: presupuesto, distancia y hábitos.</ThemedText>}
          </View>
          <BotonWeb compacto variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Ver todos los lugares">Ver todos</BotonWeb>
        </View>
        {lugares}
      </View>

      <View style={escritorio ? estilos.dos : estilos.uno}>
        <View style={estilos.izquierda}>
          <View style={estilos.cabecera}>
            <View style={estilos.cabeceraTexto}>
              <ThemedText accessibilityRole="header" style={escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto}>Roomies que podrían encajar</ThemedText>
              {telefono ? null : <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Personas que buscan con quién compartir, cerca de ti.</ThemedText>}
            </View>
            <BotonWeb compacto variante="contorno" onPress={() => router.push(RutasWeb.roomies)} accessibilityLabel="Ver todos los roomies">Ver todos</BotonWeb>
          </View>
          {personas}
        </View>
        {lado}
      </View>
    </PaginaWeb>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  const theme = useTheme();
  return (
    <View style={[estilos.fila, { borderTopColor: theme.filete }]}>
      <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{k}</ThemedText>
      <ThemedText style={Texto.pesoFuerte}>{v}</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  hola: { position: 'relative', overflow: 'hidden', borderRadius: Radios.panel, padding: Spacing.five, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.five, flexWrap: 'wrap' },
  holaCompacto: { flexDirection: 'column', alignItems: 'stretch', padding: Spacing.four, gap: Spacing.four },
  holaMapa: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  holaImagen: { width: '100%', height: '100%' },
  holaTexto: { flex: 1, minWidth: 280, gap: Spacing.four },
  holaBusca: { width: 780, maxWidth: '100%' },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.five },
  cifra: { gap: Spacing.half },
  seccion: { gap: Spacing.four },
  cabecera: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.three, flexWrap: 'wrap' },
  cabeceraTexto: { gap: Spacing.one, flexShrink: 1 },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
  dos: { flexDirection: 'row', gap: Spacing.five, alignItems: 'flex-start' },
  uno: { gap: Spacing.five },
  izquierda: { flex: 1, minWidth: 0, gap: Spacing.four },
  personas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  persona: { flexGrow: 1, flexBasis: 200 },
  lado: { width: 380, maxWidth: '100%', gap: Spacing.four },
  panel: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino },
  panelCabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enlace: { minHeight: 44, justifyContent: 'center' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.three, borderTopWidth: Filete.fino },
  mensaje: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, borderTopWidth: Filete.fino, minHeight: 64 },
  inicial: { width: 44, height: 44, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  mensajeTexto: { flex: 1, minWidth: 0, gap: Spacing.half },
});
