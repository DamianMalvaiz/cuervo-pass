import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Sello } from '@/components/ficha/Sello';
import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AltoFotoTarjeta, Filete, Radios, Spacing } from '@/constants/theme';
import { useFotosPublicas, useHorarioPublico, useNegocioPublico, useProductosPublicos } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { zonaCorta } from '@/lib/zona';
import { lineasPorDia, recortarHora, type DiaIso } from '@/lib/horario';
import type { ProductoExplorar } from '@/services/explorar.service';

// Ficha pública de un negocio · tramo 1 de la web. Datos REDUCIDOS (migración 0090): la zona y no la dirección exacta, sin teléfono. Escribir o guardar pide cuenta.
// Las fotos de los productos quedan para un siguiente corte: aquí van el nombre, la sección y el precio.

const SECCION_SIN_NOMBRE = 'Productos';
const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** Agrupa por sección conservando el orden en que llegan (las estrellas ya vienen primero). */
function porSeccion(productos: ProductoExplorar[]): { seccion: string; items: ProductoExplorar[] }[] {
  const grupos = new Map<string, ProductoExplorar[]>();
  for (const p of productos) {
    const clave = p.seccion?.trim() || SECCION_SIN_NOMBRE;
    grupos.set(clave, [...(grupos.get(clave) ?? []), p]);
  }
  return [...grupos].map(([seccion, items]) => ({ seccion, items }));
}

export default function FichaNegocio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { negocio: n, cargando, fallo, reintentar } = useNegocioPublico(id);
  const productos = useProductosPublicos(id);
  const horario = useHorarioPublico(id);
  const { fotos } = useFotosPublicas('negocio', id, n?.num_fotos ?? 0);

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
        <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
      </ThemedView>
    );
  }
  if (!n) {
    return (
      <ThemedView style={estilos.centro}>
        <BloqueEstado etiqueta="Ya no está disponible" mensaje="Este negocio se retiró o dejó de estar publicado." icono="storefront-outline" />
        <Sello variante="contorno" onPress={() => router.push('/explorar')} accessibilityLabel="Ver más lugares">Ver más lugares</Sello>
      </ThemedView>
    );
  }

  const turnos = horario.horario.map((h) => ({ dia: h.dia as DiaIso, abre: recortarHora(h.abre), cierra: recortarHora(h.cierra) }));

  return (
    <ThemedView style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
          <FotoLista completa={fotos[0]} style={estilos.fotoImagen} accessibilityLabel={n.nombre} />
        </View>

        <View style={estilos.linea}>
          <ThemedText type="title" accessibilityRole="header" style={estilos.titulo}>{n.nombre}</ThemedText>
          {n.calificacion ? <ThemedText type="smallBold">★ {n.calificacion.toFixed(1)}</ThemedText> : null}
        </View>
        {zonaCorta(n.zona) ? <ThemedText themeColor="textSecondary">{zonaCorta(n.zona)}</ThemedText> : null}
        {n.abierto_ahora === null ? null : (
          <ThemedText type="smallBold">{n.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora'}</ThemedText>
        )}
        {n.descripcion ? <ThemedText>{n.descripcion}</ThemedText> : null}

        <View style={estilos.seccion}>
          <ThemedText type="subtitle" accessibilityRole="header">Horario</ThemedText>
          {horario.fallo ? (
            <ErrorDeCarga etiqueta="No pudimos cargar el horario" onReintentar={horario.reintentar} />
          ) : horario.cargando ? (
            <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
          ) : (
            lineasPorDia(turnos).map((l) => (
              <View key={l.dia} style={[estilos.renglon, { borderBottomColor: theme.filete }]}>
                <ThemedText type="small">{l.dia}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{l.horas}</ThemedText>
              </View>
            ))
          )}
        </View>

        <View style={estilos.seccion}>
          <ThemedText type="subtitle" accessibilityRole="header">Productos</ThemedText>
          {productos.fallo ? (
            <ErrorDeCarga etiqueta="No pudimos cargar los productos" onReintentar={productos.reintentar} />
          ) : productos.cargando ? (
            <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
          ) : productos.productos.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">Este negocio todavía no tiene productos publicados.</ThemedText>
          ) : (
            porSeccion(productos.productos).map((g, _i, todos) => (
              <View key={g.seccion} style={estilos.grupo}>
                {todos.length === 1 && g.seccion === SECCION_SIN_NOMBRE ? null : (
                  <ThemedText type="etiqueta" themeColor="textSecondary">{g.seccion.toUpperCase()}</ThemedText>
                )}
                {g.items.map((p) => (
                  <View key={p.id} style={[estilos.renglon, { borderBottomColor: theme.filete }]}>
                    <ThemedText type="smallBold" style={estilos.titulo}>{p.nombre}</ThemedText>
                    <ThemedText type="small">{p.precio === null ? 'Consulta el precio' : `$${precio.format(p.precio)}`}</ThemedText>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        <View style={[estilos.cuenta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <ThemedText type="subtitle" accessibilityRole="header">¿Quieres escribirle?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            La dirección exacta y la conversación con el negocio están dentro de la cuenta.
          </ThemedText>
          <Sello onPress={() => router.push('/(auth)/login')} accessibilityLabel="Iniciar sesión para escribir">Iniciar sesión para escribir</Sello>
          <Sello variante="contorno" onPress={() => router.push('/(auth)/registro')} accessibilityLabel="Crear cuenta">Crear cuenta</Sello>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  centro: { flex: 1, padding: Spacing.three, gap: Spacing.three, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  contenido: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: 800, alignSelf: 'center' },
  foto: { height: AltoFotoTarjeta * 1.4, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  fotoImagen: { width: '100%', height: '100%' },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flex: 1 },
  seccion: { gap: Spacing.two },
  grupo: { gap: Spacing.one },
  renglon: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: Filete.fino },
  cuenta: { gap: Spacing.two, padding: Spacing.four, borderRadius: Radios.hoja, borderWidth: Filete.fino },
});
