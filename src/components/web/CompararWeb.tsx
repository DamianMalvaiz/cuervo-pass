import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { PaginaWeb } from '@/components/web/PaginaWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { useComparar } from '@/hooks/use-comparar';
import { useTheme } from '@/hooks/use-theme';
import { MAX_COMPARAR, quitarComparar, vaciarComparar } from '@/lib/comparar';
import { RutasWeb } from '@/lib/rutasWeb';
import { zonaCorta } from '@/lib/zona';
import type { PublicacionExplorar } from '@/services/explorar.service';

const NOMBRE_TIPO: Record<string, string> = { depa: 'Departamento', cuarto: 'Cuarto', casa_compartida: 'Casa compartida' };
const dinero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const ANCHO_COLUMNA = 220;
const ANCHO_ETIQUETA = 130;

/** Un sí/no que la base puede no tener: «Sin dato» no es «No». */
const sino = (v: boolean | null) => (v === null ? 'Sin dato' : v ? 'Sí' : 'No');

interface Fila {
  etiqueta: string;
  valor: (p: PublicacionExplorar) => string;
}
const FILAS: Fila[] = [
  { etiqueta: 'Renta al mes', valor: (p) => `$${dinero.format(p.precio_renta)}` },
  { etiqueta: 'Tipo', valor: (p) => NOMBRE_TIPO[p.tipo] ?? p.tipo },
  { etiqueta: 'Zona', valor: (p) => zonaCorta(p.zona) ?? 'Sin dato' },
  { etiqueta: 'Recámaras', valor: (p) => (p.recamaras === null ? 'Sin dato' : String(p.recamaras)) },
  { etiqueta: 'Amueblado', valor: (p) => sino(p.amueblado) },
  { etiqueta: 'Acepta mascotas', valor: (p) => sino(p.permite_mascotas) },
  { etiqueta: 'Servicios incluidos', valor: (p) => sino(p.servicios_incluidos) },
  { etiqueta: 'Calificación', valor: (p) => (p.calificacion === null ? 'Sin reseñas' : `${p.calificacion.toFixed(1)}${p.num_resenas ? ` (${p.num_resenas})` : ''}`) },
];

/**
 * `/comparar`: hasta tres viviendas lado a lado, con lo que la vista pública dice de cada una. Solo marca lo que es un hecho (la renta más baja); no dice cuál «conviene», eso depende de la persona.
 * Cuatro estados distintos (END-11): nada elegido, cargando, FALLÓ la lectura y la tabla. Una elegida que ya no es visible se DICE y se puede quitar.
 */
export function CompararWeb() {
  const theme = useTheme();
  const { ids } = useComparar();
  const { publicaciones, cargando, fallo, reintentar } = usePublicacionesPorIds(ids);

  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  const columnas = ids.map((id) => porId.get(id)).filter((p): p is PublicacionExplorar => p !== undefined);
  const noDisponibles = ids.length - columnas.length;
  const precios = columnas.map((p) => p.precio_renta);
  const minimo = Math.min(...precios);
  // Solo hay «más barato» si hay con qué comparar y no es un empate.
  const hayMasBarato = columnas.length >= 2 && precios.some((x) => x !== minimo);

  let cuerpo;
  if (ids.length === 0) {
    cuerpo = (
      <View style={estilos.vacio}>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{`Aún no eliges nada. En la ficha de un lugar toca «Comparar» (hasta ${MAX_COMPARAR}) y vuelve aquí.`}</ThemedText>
        <BotonWeb variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Explorar lugares">Explorar lugares</BotonWeb>
      </View>
    );
  } else if (fallo) {
    cuerpo = <ErrorDeCarga etiqueta="No pudimos cargar la comparación" onReintentar={reintentar} />;
  } else if (cargando) {
    cuerpo = <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Cargando…</ThemedText>;
  } else {
    cuerpo = (
      <>
        {noDisponibles > 0 ? (
          <View style={estilos.aviso}>
            <ThemedText style={Texto.pequeno} themeColor="textSecondary">
              {noDisponibles === 1 ? '1 lugar de tu lista ya no está disponible.' : `${noDisponibles} lugares de tu lista ya no están disponibles.`}
            </ThemedText>
            <BotonWeb variante="contorno" onPress={() => ids.filter((id) => !porId.has(id)).forEach((x) => quitarComparar(x))} accessibilityLabel="Quitar los que ya no están">Quitar</BotonWeb>
          </View>
        ) : null}
        {columnas.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={estilos.tabla} role="table" aria-label="Comparación de lugares">
              <View style={estilos.fila} role="row">
                <View style={{ width: ANCHO_ETIQUETA }} />
                {columnas.map((p) => (
                  <View key={p.id} style={[estilos.celda, estilos.cabecera]} role="columnheader">
                    <Pulsable onPress={() => router.push(RutasWeb.ficha(p.id) as never)} accessibilityRole="link" accessibilityLabel={`Ver ${p.titulo_publico}`} style={estilos.titulo}>
                      <ThemedText style={Texto.subtitulo}>{p.titulo_publico}</ThemedText>
                    </Pulsable>
                    <Pulsable onPress={() => quitarComparar(p.id)} accessibilityRole="button" accessibilityLabel={`Quitar ${p.titulo_publico} de la comparación`} style={estilos.quitar}>
                      <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">Quitar</ThemedText>
                    </Pulsable>
                  </View>
                ))}
              </View>
              {FILAS.map((f) => (
                <View key={f.etiqueta} style={[estilos.fila, { borderTopColor: theme.filete }]} role="row">
                  <View style={{ width: ANCHO_ETIQUETA, justifyContent: 'center' }} role="rowheader">
                    <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">{f.etiqueta}</ThemedText>
                  </View>
                  {columnas.map((p) => {
                    const esMasBarato = f.etiqueta === 'Renta al mes' && hayMasBarato && p.precio_renta === minimo;
                    return (
                      <View key={p.id} style={estilos.celda} role="cell">
                        <ThemedText style={Texto.cuerpo}>{f.valor(p)}</ThemedText>
                        {esMasBarato ? <ThemedText style={[Texto.pequenoFuerte, { color: theme.bosque }]}>Más barato</ThemedText> : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
        <View style={estilos.acciones}>
          {ids.length < MAX_COMPARAR ? <BotonWeb variante="contorno" onPress={() => router.push(RutasWeb.departamentos)} accessibilityLabel="Agregar otro lugar">Agregar otro lugar</BotonWeb> : null}
          <BotonWeb variante="contorno" onPress={vaciarComparar} accessibilityLabel="Vaciar la comparación">Vaciar</BotonWeb>
        </View>
      </>
    );
  }

  return (
    <PaginaWeb activa="depas" titulo="Comparar lugares">
      <View style={estilos.cuerpo}>
        <ThemedText accessibilityRole="header" style={Texto.seccionWebCompacto}>Comparar lugares</ThemedText>
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Lo que dice la ficha pública de cada uno, lado a lado. La lista se queda en este navegador.</ThemedText>
        {cuerpo}
      </View>
    </PaginaWeb>
  );
}

const estilos = StyleSheet.create({
  cuerpo: { gap: Spacing.three },
  vacio: { gap: Spacing.three, alignItems: 'flex-start' },
  aviso: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.three },
  tabla: { gap: 0 },
  fila: { flexDirection: 'row', borderTopWidth: Filete.fino, borderTopColor: 'transparent' },
  celda: { width: ANCHO_COLUMNA, paddingVertical: Spacing.three, paddingHorizontal: Spacing.two, gap: Spacing.one, justifyContent: 'center' },
  cabecera: { justifyContent: 'flex-start' },
  titulo: { minHeight: 44, justifyContent: 'center' },
  quitar: { minHeight: 44, minWidth: 44, justifyContent: 'center', borderRadius: Radios.full },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
