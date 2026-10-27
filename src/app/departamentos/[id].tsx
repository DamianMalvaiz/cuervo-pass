import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BarraFichaWeb } from '@/components/web/BarraFichaWeb';
import { BotonWeb } from '@/components/web/BotonWeb';
import { GaleriaWeb } from '@/components/web/GaleriaWeb';
import { PieWeb } from '@/components/web/PieWeb';
import { TarjetaEntrarWeb } from '@/components/web/TarjetaEntrarWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas, usePublicacionPublica } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';
import { zonaCorta } from '@/lib/zona';

// `/departamentos/<id>` · ficha pública de una vivienda. Datos REDUCIDOS (migración 0090): la zona y no la dirección, sin teléfono ni quién publica. Escribir, guardar, la dirección exacta y el ajuste piden cuenta.

const ANCHO_MAXIMO = 1200;
const NOMBRE_TIPO: Record<string, string> = { depa: 'Departamento', cuarto: 'Cuarto', casa_compartida: 'Casa compartida' };
const CRITERIOS = ['Presupuesto', 'Distancia a tu universidad', 'Mascotas', 'Ruido'];
const FIJA = { position: 'sticky', top: Spacing.three } as ViewStyle;

interface Incluye {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
}

export default function FichaPublica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const escritorio = ancho >= 1000;
  const margen = ancho >= 700 ? Spacing.four : Spacing.three;
  const { publicacion: p, cargando, fallo, reintentar } = usePublicacionPublica(id);
  const { fotos } = useFotosPublicas('publicacion', id, p?.num_fotos ?? 0);

  if (fallo) {
    return (
      <ThemedView style={estilos.centro}>
        <ErrorDeCarga etiqueta="No pudimos cargar este lugar" onReintentar={reintentar} />
      </ThemedView>
    );
  }
  if (cargando) {
    return (
      <ThemedView style={estilos.centro}>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }
  if (!p) {
    return (
      <ThemedView style={estilos.centro}>
        <BloqueEstado etiqueta="Ya no está disponible" mensaje="Este lugar se retiró o dejó de estar publicado." icono="home-outline" />
        <BotonWeb variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Ver más lugares">Ver más lugares</BotonWeb>
      </ThemedView>
    );
  }

  const zona = zonaCorta(p.zona);
  const subtitulo = [NOMBRE_TIPO[p.tipo] ?? p.tipo, p.recamaras ? `${p.recamaras} ${p.recamaras === 1 ? 'recámara' : 'recámaras'}` : null, zona].filter(Boolean).join(' · ');
  const candidatos: (Incluye | null)[] = [
    p.recamaras ? { icono: 'bed-outline', texto: `${p.recamaras} ${p.recamaras === 1 ? 'recámara' : 'recámaras'}` } : null,
    p.amueblado ? { icono: 'cube-outline', texto: 'Amueblado' } : null,
    p.permite_mascotas ? { icono: 'paw-outline', texto: 'Acepta mascotas' } : null,
    p.servicios_incluidos ? { icono: 'flash-outline', texto: 'Servicios incluidos' } : null,
  ];
  const incluye = candidatos.filter((x): x is Incluye => x !== null);

  return (
    <ThemedView style={estilos.raiz}>
      <Head>
        <title>{`${p.titulo_publico} · Cuervo 360`}</title>
      </Head>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <View style={[estilos.contenido, { paddingHorizontal: margen }]}>
          <BarraFichaWeb escritorio={escritorio} />
          <GaleriaWeb fotos={fotos} titulo={p.titulo_publico} escritorio={escritorio} />

          <View style={escritorio ? estilos.fila : estilos.columna}>
            <View style={escritorio ? estilos.izquierda : undefined}>
              <Text accessibilityRole="header" style={[escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto, { color: theme.text }]}>{p.titulo_publico}</Text>
              <ThemedText style={[Texto.cuerpo, estilos.subtitulo]} themeColor="textSecondary">{subtitulo}</ThemedText>
              <View style={estilos.reseña}>
                {p.calificacion ? (
                  <View style={estilos.calificacion}>
                    <Ionicons name="star" size={16} color={theme.text} />
                    <ThemedText style={Texto.pequenoFuerte}>{p.num_resenas ? `${p.calificacion.toFixed(1)} · ${p.num_resenas} ${p.num_resenas === 1 ? 'reseña' : 'reseñas'}` : p.calificacion.toFixed(1)}</ThemedText>
                  </View>
                ) : null}
                {p.destacado ? (
                  <View style={estilos.destacado}>
                    <ThemedText style={[Texto.pequenoFuerte, { color: Colors.dark.limaTexto }]}>Destacado</ThemedText>
                  </View>
                ) : null}
              </View>

              {incluye.length > 0 ? (
                <View style={[estilos.bloque, { borderTopColor: theme.filete }]}>
                  <ThemedText accessibilityRole="header" style={Texto.titulo}>Lo que incluye</ThemedText>
                  <View style={estilos.incluye}>
                    {incluye.map((i) => (
                      <View key={i.texto} style={estilos.item}>
                        <View style={[estilos.icono, { backgroundColor: theme.tintedSurface }]}>
                          <Ionicons name={i.icono} size={22} color={theme.bosque} />
                        </View>
                        <ThemedText style={Texto.pequenoFuerte}>{i.texto}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={[estilos.bloque, { borderTopColor: theme.filete }]}>
                <ThemedText accessibilityRole="header" style={Texto.titulo}>Por qué podría encajar contigo</ThemedText>
                <View style={[estilos.ajuste, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
                  {CRITERIOS.map((c) => (
                    <View key={c} style={estilos.criterio}>
                      <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
                      <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">{c}</ThemedText>
                      <View style={[estilos.barra, { backgroundColor: theme.backgroundSelected }]} />
                    </View>
                  ))}
                  <ThemedText style={Texto.pequenoFuerte}>Entra para ver tu ajuste con este lugar</ThemedText>
                </View>
              </View>

              <View style={[estilos.bloque, { borderTopColor: theme.filete }]}>
                <ThemedText accessibilityRole="header" style={Texto.titulo}>Dónde estarás</ThemedText>
                <View style={[estilos.zona, { backgroundColor: theme.tintedSurface }]}>
                  <Ionicons name="location-outline" size={28} color={theme.bosque} />
                  <View style={estilos.zonaTexto}>
                    {zona ? <ThemedText style={Texto.subtitulo}>{zona}</ThemedText> : null}
                    <ThemedText style={Texto.pequeno} themeColor="textSecondary">La dirección exacta se muestra al iniciar sesión.</ThemedText>
                  </View>
                </View>
              </View>
            </View>

            <View style={escritorio ? [estilos.derecha, FIJA] : undefined}>
              <TarjetaEntrarWeb precio={p.precio_renta} mensaje="Entra para escribir a quien publica y ver cómo encajas." garantia="La conversación se queda en la app: nadie recibe tu teléfono antes de tiempo." />
            </View>
          </View>

        </View>
        <PieWeb />
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  scroll: { paddingTop: Spacing.three },
  centro: { flex: 1, padding: Spacing.three, gap: Spacing.three, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  contenido: { width: '100%', maxWidth: ANCHO_MAXIMO, alignSelf: 'center', gap: Spacing.four, paddingBottom: Spacing.six },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.six - Spacing.three },
  columna: { gap: Spacing.four },
  izquierda: { flex: 1, minWidth: 0 },
  derecha: { width: 360 },
  subtitulo: { marginTop: Spacing.two },
  reseña: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.three },
  calificacion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half },
  destacado: { backgroundColor: Colors.dark.lima, borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  bloque: { borderTopWidth: Filete.fino, marginTop: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
  incluye: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three + Spacing.one, columnGap: Spacing.five },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minWidth: 220 },
  icono: { width: 48, height: 48, borderRadius: Radios.tarjeta - Spacing.two, alignItems: 'center', justifyContent: 'center' },
  ajuste: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radios.tarjeta, borderWidth: Filete.fino },
  criterio: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barra: { flex: 1, height: 7, borderRadius: Radios.full },
  zona: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.four, borderRadius: Radios.tarjeta },
  zonaTexto: { flex: 1, minWidth: 0, gap: Spacing.one },
});
