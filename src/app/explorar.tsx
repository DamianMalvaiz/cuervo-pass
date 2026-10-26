import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AltoFotoTarjeta, Filete, Radios, Spacing } from '@/constants/theme';
import { useCategoriasPublicas, useFotosPublicas, useNegociosPublicos, usePublicacionesPublicas } from '@/hooks/queries/useExplorar';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import type { NegocioExplorar, PublicacionExplorar } from '@/services/explorar.service';

// Portada pública de la web · tramo 1. Se explora SIN cuenta, con datos reducidos (migración 0090): zona y no dirección, ubicación redondeada, sin teléfono.
// Primero se enseña lo que hay; la cuenta se pide solo para lo que la necesita.

const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

function TarjetaDepa({ p }: { p: PublicacionExplorar }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('publicacion', p.id, p.num_fotos);
  const resumen = `${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes`;
  return (
    <Pulsable onPress={() => router.push(`/explorar/${p.id}`)} accessibilityRole="button" accessibilityLabel={resumen} style={estilos.tarjeta}>
      <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.fotoImagen} accessibilityLabel={p.titulo_publico} />
        {p.destacado ? (
          <View style={[estilos.chip, { backgroundColor: theme.lima }]}>
            <ThemedText type="etiqueta" style={{ color: theme.limaTexto }}>DESTACADO</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={estilos.linea}>
        <ThemedText type="smallBold" numberOfLines={1} style={estilos.titulo}>{p.titulo_publico}</ThemedText>
        {p.calificacion ? <ThemedText type="small">★ {p.calificacion.toFixed(1)}</ThemedText> : null}
      </View>
      {p.zona ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{p.zona}</ThemedText> : null}
      <ThemedText type="small">
        <ThemedText type="smallBold">${precio.format(p.precio_renta)}</ThemedText> al mes
      </ThemedText>
    </Pulsable>
  );
}

function TarjetaNegocio({ n }: { n: NegocioExplorar }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('negocio', n.id, n.num_fotos);
  const estado = n.abierto_ahora === null ? null : n.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora';
  return (
    <Pulsable onPress={() => router.push(`/explorar/negocio/${n.id}`)} accessibilityRole="button" accessibilityLabel={`${n.nombre}${estado ? `, ${estado}` : ''}`} style={estilos.tarjeta}>
      <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.fotoImagen} accessibilityLabel={n.nombre} />
      </View>
      <View style={estilos.linea}>
        <ThemedText type="smallBold" numberOfLines={1} style={estilos.titulo}>{n.nombre}</ThemedText>
        {n.calificacion ? <ThemedText type="small">★ {n.calificacion.toFixed(1)}</ThemedText> : null}
      </View>
      {n.zona ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{n.zona}</ThemedText> : null}
      {estado ? <ThemedText type="small">{estado}</ThemedText> : null}
    </Pulsable>
  );
}

export default function Explorar() {
  const theme = useTheme();
  const { clase } = useTamanoPantalla();
  const depas = usePublicacionesPublicas({ limite: 8 });
  const negocios = useNegociosPublicos({ limite: 8 });
  const categorias = useCategoriasPublicas();

  return (
    <ThemedView style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={[estilos.barra, { borderBottomColor: theme.filete }]}>
          <ThemedText type="subtitle">Cuervo 360</ThemedText>
          <View style={estilos.acciones}>
            <Sello variante="contorno" onPress={() => router.push('/(auth)/login')} accessibilityLabel="Iniciar sesión">Iniciar sesión</Sello>
            <Sello onPress={() => router.push('/(auth)/registro')} accessibilityLabel="Crear cuenta">Crear cuenta</Sello>
          </View>
        </View>

        <View style={[estilos.hero, clase === 'amplia' && estilos.heroAmplio]}>
          <ThemedText type="title" accessibilityRole="header">Encuentra dónde vivir, con quién y qué hay cerca.</ThemedText>
          <ThemedText themeColor="textSecondary">
            Departamentos y cuartos a minutos de tu universidad, roomies compatibles contigo y los negocios que necesitas en tu día a día.
          </ThemedText>
        </View>

        <View style={estilos.seccion}>
          <ThemedText type="subtitle" accessibilityRole="header">Departamentos y cuartos</ThemedText>
          {depas.fallo ? (
            <ErrorDeCarga etiqueta="No pudimos cargar los departamentos" onReintentar={depas.reintentar} />
          ) : depas.cargando ? (
            <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
          ) : depas.publicaciones.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">Todavía no hay departamentos publicados.</ThemedText>
          ) : (
            <View style={estilos.cuadricula}>
              {depas.publicaciones.map((p) => <TarjetaDepa key={p.id} p={p} />)}
            </View>
          )}
        </View>

        <View style={estilos.seccion}>
          <ThemedText type="subtitle" accessibilityRole="header">Negocios cerca</ThemedText>
          {negocios.fallo ? (
            <ErrorDeCarga etiqueta="No pudimos cargar los negocios" onReintentar={negocios.reintentar} />
          ) : negocios.cargando ? (
            <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
          ) : negocios.negocios.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">Todavía no hay negocios publicados.</ThemedText>
          ) : (
            <View style={estilos.cuadricula}>
              {negocios.negocios.map((n) => <TarjetaNegocio key={n.id} n={n} />)}
            </View>
          )}
        </View>

        {categorias.categorias.length > 0 ? (
          <View style={estilos.seccion}>
            <ThemedText type="subtitle" accessibilityRole="header">Lo que necesitas cerca</ThemedText>
            <View style={estilos.categorias}>
              {categorias.categorias.map((c) => (
                <View key={c.id} style={[estilos.categoria, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{c.nombre}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[estilos.confianza, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <ThemedText type="subtitle" accessibilityRole="header">Hecho para que confíes</ThemedText>
          <ThemedText themeColor="textSecondary">
            Quien vende pasa por una revisión de identidad hecha por una persona. No vendemos tus datos ni los usamos para publicidad, y puedes borrar tu cuenta cuando quieras.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  contenido: { padding: Spacing.three, gap: Spacing.four, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: Filete.fino },
  acciones: { flexDirection: 'row', gap: Spacing.two },
  hero: { gap: Spacing.three, paddingVertical: Spacing.four },
  heroAmplio: { maxWidth: 640 },
  seccion: { gap: Spacing.three },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tarjeta: { width: 260, flexGrow: 1, maxWidth: 360, gap: Spacing.one },
  foto: { height: AltoFotoTarjeta, borderRadius: Radios.tarjeta, overflow: 'hidden', marginBottom: Spacing.one },
  fotoImagen: { width: '100%', height: '100%' },
  chip: { position: 'absolute', top: Spacing.two, left: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radios.full },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flex: 1 },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  categoria: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radios.full, borderWidth: Filete.fino },
  confianza: { gap: Spacing.two, padding: Spacing.four, borderRadius: Radios.hoja, borderWidth: Filete.fino },
});
