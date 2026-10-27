import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BarraFichaWeb } from '@/components/web/BarraFichaWeb';
import { ALTO_BARRA_CONTACTO, BarraContactoWeb } from '@/components/web/BarraContactoWeb';
import { BotonWeb } from '@/components/web/BotonWeb';
import { FilaProductoWeb } from '@/components/web/FilaProductoWeb';
import { UbicacionNegocioConCuentaWeb } from '@/components/web/FichaConCuentaWeb';
import { GaleriaWeb } from '@/components/web/GaleriaWeb';
import { HorarioWeb } from '@/components/web/HorarioWeb';
import { PieWeb } from '@/components/web/PieWeb';
import { TarjetaEntrarWeb } from '@/components/web/TarjetaEntrarWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas, useHorarioPublico, useNegocioPublico, useProductosPublicos } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';
import { zonaCorta } from '@/lib/zona';
import { useAuthStore } from '@/store/useAuthStore';
import type { ProductoExplorar } from '@/services/explorar.service';

// `/servicios/<id>` · ficha pública de un negocio. Datos REDUCIDOS (migración 0090): la zona y no la dirección exacta, sin teléfono. Escribir, guardar y la dirección exacta piden cuenta.

const ANCHO_MAXIMO = 1200;
const FIJA = { position: 'sticky', top: Spacing.three } as unknown as ViewStyle;
const DESTACADOS = 'Destacados';

/** Las estrellas van primero, bajo «Destacados»; el resto, por sección en el orden en que llegan. Los que no tienen sección no llevan rótulo. */
function grupos(productos: ProductoExplorar[]): { rotulo: string | null; items: ProductoExplorar[] }[] {
  const estrellas = productos.filter((p) => p.estrella);
  const resto = productos.filter((p) => !p.estrella);
  const porSeccion = new Map<string | null, ProductoExplorar[]>();
  for (const p of resto) {
    const clave = p.seccion?.trim() || null;
    porSeccion.set(clave, [...(porSeccion.get(clave) ?? []), p]);
  }
  const salida: { rotulo: string | null; items: ProductoExplorar[] }[] = [];
  if (estrellas.length > 0) salida.push({ rotulo: DESTACADOS, items: estrellas });
  for (const [rotulo, items] of porSeccion) salida.push({ rotulo, items });
  return salida;
}

export default function FichaNegocio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { ancho } = useTamanoPantalla();
  const escritorio = ancho >= 1000;
  const telefono = ancho < 700;
  const hayCuenta = useAuthStore((s) => Boolean(s.session));
  const margen = ancho >= 700 ? Spacing.four : Spacing.three;
  const { negocio: n, cargando, fallo, reintentar } = useNegocioPublico(id);
  const productos = useProductosPublicos(id);
  const horario = useHorarioPublico(id);
  const { fotos } = useFotosPublicas('negocio', id, n?.num_fotos ?? 0);
  // Día ISO de hoy: 1 = lunes … 7 = domingo.
  const hoy = ((new Date().getDay() + 6) % 7) + 1;

  if (fallo) {
    return (
      <ThemedView style={estilos.centro}>
        <ErrorDeCarga etiqueta="No pudimos cargar este negocio" onReintentar={reintentar} />
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
  if (!n) {
    return (
      <ThemedView style={estilos.centro}>
        <BloqueEstado etiqueta="Ya no está disponible" mensaje="Este negocio se retiró o dejó de estar publicado." icono="storefront-outline" />
        <BotonWeb variante="contorno" onPress={() => router.push(RutasWeb.servicios)} accessibilityLabel="Ver más negocios">Ver más negocios</BotonWeb>
      </ThemedView>
    );
  }

  const zona = zonaCorta(n.zona);
  const estado = n.abierto_ahora === null ? null : n.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora';

  return (
    <ThemedView style={estilos.raiz}>
      <Head>
        <title>{`${n.nombre} · Cuervo 360`}</title>
      </Head>
      <ScrollView contentContainerStyle={[estilos.scroll, telefono && !hayCuenta && { paddingBottom: ALTO_BARRA_CONTACTO }]}>
        <View style={[estilos.contenido, { paddingHorizontal: margen }]}>
          <BarraFichaWeb escritorio={escritorio} volverA={RutasWeb.servicios} guardar={{ tipo: 'negocio', id: n.id }} />
          <GaleriaWeb fotos={fotos} titulo={n.nombre} escritorio={escritorio} textoSinFotos="Este negocio todavía no tiene fotos" />

          <View style={escritorio ? estilos.fila : estilos.columna}>
            <View style={escritorio ? estilos.izquierda : undefined}>
              <Text accessibilityRole="header" style={[escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto, { color: theme.text }]}>{n.nombre}</Text>
              <View style={estilos.datos}>
                {n.calificacion ? (
                  <View style={estilos.dato}>
                    <Ionicons name="star" size={16} color={theme.text} />
                    <ThemedText style={Texto.pequenoFuerte}>{n.num_resenas ? `${n.calificacion.toFixed(1)} · ${n.num_resenas} ${n.num_resenas === 1 ? 'reseña' : 'reseñas'}` : n.calificacion.toFixed(1)}</ThemedText>
                  </View>
                ) : null}
                {estado ? (
                  <View style={estilos.dato}>
                    <View style={[estilos.punto, { backgroundColor: n.abierto_ahora ? theme.exito : theme.textSecondary }]} />
                    <ThemedText style={[Texto.pequenoFuerte, { color: n.abierto_ahora ? theme.exito : theme.textSecondary }]}>{estado}</ThemedText>
                  </View>
                ) : null}
                {zona ? <ThemedText style={Texto.pequeno} themeColor="textSecondary">{zona}</ThemedText> : null}
              </View>
              {n.descripcion ? <ThemedText style={[Texto.cuerpo, estilos.descripcion]}>{n.descripcion}</ThemedText> : null}

              <View style={[estilos.bloque, { borderTopColor: theme.filete }]}>
                <ThemedText accessibilityRole="header" style={escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto}>Menú</ThemedText>
                {productos.fallo ? (
                  <ErrorDeCarga etiqueta="No pudimos cargar los productos" onReintentar={productos.reintentar} />
                ) : productos.cargando ? (
                  <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
                ) : productos.productos.length === 0 ? (
                  <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Este negocio todavía no tiene productos publicados.</ThemedText>
                ) : (
                  grupos(productos.productos).map((g) => (
                    <View key={g.rotulo ?? 'sin-seccion'}>
                      {g.rotulo ? <ThemedText style={[Texto.etiqueta, estilos.rotulo]} themeColor="textSecondary">{g.rotulo.toUpperCase()}</ThemedText> : null}
                      {g.items.map((p) => <FilaProductoWeb key={p.id} p={p} />)}
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={escritorio ? [estilos.derecha, FIJA] : estilos.derechaApilada}>
              <View style={[estilos.horario, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
                <ThemedText accessibilityRole="header" style={Texto.titulo}>Horario</ThemedText>
                {horario.fallo ? (
                  <ErrorDeCarga etiqueta="No pudimos cargar el horario" onReintentar={horario.reintentar} />
                ) : horario.cargando ? (
                  <ThemedText style={Texto.pequeno} themeColor="textSecondary">Cargando…</ThemedText>
                ) : (
                  <HorarioWeb horario={horario.horario} hoy={hoy} />
                )}
              </View>
              {hayCuenta ? <UbicacionNegocioConCuentaWeb id={n.id} zona={zona ?? ''} /> : telefono ? null : <TarjetaEntrarWeb mensaje="Entra para guardarlo y ver su dirección exacta." accion="Entrar para ver la dirección exacta" />}
            </View>
          </View>

        </View>
        <PieWeb />
      </ScrollView>
      {telefono && !hayCuenta ? <BarraContactoWeb nombre={n.nombre} detalle={estado ?? zona ?? undefined} /> : null}
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
  derecha: { width: 360, gap: Spacing.three },
  derechaApilada: { gap: Spacing.three },
  datos: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.three },
  dato: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half },
  punto: { width: 9, height: 9, borderRadius: Radios.full },
  descripcion: { marginTop: Spacing.three, maxWidth: 620 },
  bloque: { borderTopWidth: Filete.fino, marginTop: Spacing.four, paddingTop: Spacing.four, gap: Spacing.two },
  rotulo: { marginTop: Spacing.three },
  horario: { gap: Spacing.two, padding: Spacing.four, borderRadius: Radios.panel - Spacing.one, borderWidth: Filete.fino },
});
