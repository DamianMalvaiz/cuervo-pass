import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FilaLugarPublico } from '@/components/FilaLugarPublico';
import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { ListaEsqueleto } from '@/components/ficha/FichaEsqueleto';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Texto } from '@/constants/theme';
import { usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { useComparar } from '@/hooks/use-comparar';
import { useVistos } from '@/hooks/use-vistos';
import { vaciarComparar } from '@/lib/comparar';
import { borrarVistos } from '@/lib/vistos';
import type { PublicacionExplorar } from '@/services/explorar.service';

// Las dos listas de «Guardados» que viven SOLO en este teléfono (no viajan al servidor ni se ligan a la cuenta): Vistos y Comparar. Se leen de la vista pública por sus ids, así que enseñan lo mismo que la ficha pública (zona, no dirección exacta).
// Cuatro estados distintos cada una (END-11): nada, cargando, FALLÓ la lectura y la lista. Un lugar de la lista que ya no es visible se DICE y no se esconde.

/** Los lugares de `ids` en ese orden y cuántos ya no están disponibles. */
function ordenar(ids: string[], publicaciones: PublicacionExplorar[]) {
  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  const lista = ids.map((id) => porId.get(id)).filter((p): p is PublicacionExplorar => p !== undefined);
  return { lista, ausentes: ids.length - lista.length };
}

function Ausentes({ n }: { n: number }) {
  if (n === 0) return null;
  return <ThemedText type="small" themeColor="textSecondary">{n === 1 ? '1 lugar de esta lista ya no está disponible.' : `${n} lugares de esta lista ya no están disponibles.`}</ThemedText>;
}

function Vacio({ icono, mensaje }: { icono: 'time-outline' | 'git-compare-outline'; mensaje: string }) {
  return <BloqueEstado icono={icono} etiqueta="Sin resultados" mensaje={mensaje} />;
}

export function ListaVistos() {
  const ids = useVistos();
  const { publicaciones, cargando, fallo, reintentar } = usePublicacionesPorIds(ids);
  if (ids.length === 0) return <Vacio icono="time-outline" mensaje="Todavía no has abierto ningún lugar. Los que veas aparecerán aquí; se guardan solo en este teléfono." />;
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar lo que viste" onReintentar={reintentar} />;
  if (cargando) return <ListaEsqueleto variante="renglon" filas={3} />;
  const { lista, ausentes } = ordenar(ids, publicaciones);
  return (
    <View style={estilos.cuerpo}>
      <View style={estilos.acciones}>
        <Sello variante="contorno" onPress={borrarVistos} accessibilityLabel="Borrar el historial de vistos">Borrar historial</Sello>
      </View>
      <Ausentes n={ausentes} />
      <View style={estilos.filas}>{lista.map((p) => <FilaLugarPublico key={p.id} p={p} />)}</View>
    </View>
  );
}

export function ListaComparar() {
  const { ids } = useComparar();
  const { publicaciones, cargando, fallo, reintentar } = usePublicacionesPorIds(ids);
  if (ids.length === 0) return <Vacio icono="git-compare-outline" mensaje="Aún no eliges nada para comparar. En la ficha de un lugar toca «Comparar» (hasta 3)." />;
  if (fallo) return <ErrorDeCarga etiqueta="No pudimos cargar lo que quieres comparar" onReintentar={reintentar} />;
  if (cargando) return <ListaEsqueleto variante="renglon" filas={Math.min(ids.length, 3)} />;
  const { lista, ausentes } = ordenar(ids, publicaciones);
  return (
    <View style={estilos.cuerpo}>
      <View style={estilos.acciones}>
        {ids.length >= 2 ? (
          <Sello onPress={() => router.push('/comparar')} accessibilityLabel="Comparar lado a lado">Comparar lado a lado</Sello>
        ) : (
          <ThemedText style={Texto.pequeno} themeColor="textSecondary">Agrega al menos un lugar más para compararlos.</ThemedText>
        )}
        <Sello variante="contorno" onPress={vaciarComparar} accessibilityLabel="Vaciar la lista de comparar">Vaciar</Sello>
      </View>
      <Ausentes n={ausentes} />
      <View style={estilos.filas}>{lista.map((p) => <FilaLugarPublico key={p.id} p={p} />)}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cuerpo: { gap: Spacing.three },
  acciones: { gap: Spacing.two },
  filas: { gap: Spacing.two },
});
