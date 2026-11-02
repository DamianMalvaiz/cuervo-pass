import { useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Spacing, Texto } from '@/constants/theme';
import { usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { HUECO_WEB } from '@/lib/medidasWeb';
import { borrarVistos, leerVistos, suscribirVistos, vistosCrudos } from '@/lib/vistos';

/**
 * «Vistos recientemente»: las fichas que esta persona abrió en este navegador, la más reciente primero. No pide cuenta y no sale del navegador. Sin nada visto no ocupa lugar. Una vista que ya no es visible simplemente no sale (la lista
 * se lee del servidor); si la lectura FALLA se dice, no se esconde (END-11).
 */
export function VistosRecientesWeb({ columnas, anchoTarjeta, compacta }: { columnas: number; anchoTarjeta: number; compacta: boolean }) {
  // La página se genera sin navegador: ahí (y en la primera pintura) no hay vistos; el almacenamiento solo existe en el navegador.
  const crudo = useSyncExternalStore(suscribirVistos, vistosCrudos, () => '');
  const ids = useMemo(() => leerVistos(crudo), [crudo]);
  const { publicaciones, cargando, fallo, reintentar } = usePublicacionesPorIds(ids);

  if (ids.length === 0) return null;
  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  const ordenadas = ids.map((id) => porId.get(id)).filter((p) => p !== undefined).slice(0, columnas);

  return (
    <View style={estilos.bloque}>
      <View style={estilos.cabecera}>
        <ThemedText accessibilityRole="header" style={Texto.titulo}>Vistos recientemente</ThemedText>
        <Pulsable
          onPress={borrarVistos}
          accessibilityRole="button"
          accessibilityLabel="Borrar vistos recientemente"
          style={estilos.borrar}
        >
          <ThemedText style={Texto.pequenoFuerte} themeColor="textSecondary">Borrar</ThemedText>
        </Pulsable>
      </View>
      {fallo ? (
        <ErrorDeCarga etiqueta="No pudimos cargar lo que viste" onReintentar={reintentar} />
      ) : cargando ? null : (
        <View style={estilos.cuadricula}>
          {ordenadas.map((p, i) => <TarjetaPublicacionWeb key={p.id} p={p} ancho={anchoTarjeta} compacta={compacta} paso={i % columnas} />)}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: Spacing.three },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  borrar: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
});
