import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FotoLista } from '@/components/FotoLista';
import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas, usePublicacionesPorIds } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { useVistos } from '@/hooks/use-vistos';
import { borrarVistos } from '@/lib/vistos';
import { zonaCorta } from '@/lib/zona';
import type { PublicacionExplorar } from '@/services/explorar.service';

const ANCHO_TARJETA = 156;
const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * «Vistos recientemente» en la app: las fichas que esta persona abrió en ESTE teléfono, la más reciente primero. No viaja al servidor ni se liga a la cuenta. Sin nada visto no ocupa lugar. Una vivienda que ya no es visible
 * simplemente no sale (la lista se lee del servidor); si la lectura FALLA se dice, no se esconde (END-11). Es la misma lista que la de la web, leída de lo guardado en el teléfono.
 */
export function VistosRecientes() {
  const ids = useVistos();
  const { publicaciones, cargando, fallo, reintentar } = usePublicacionesPorIds(ids);

  if (ids.length === 0) return null;
  const porId = new Map(publicaciones.map((p) => [p.id, p]));
  const ordenadas = ids.map((id) => porId.get(id)).filter((p): p is PublicacionExplorar => p !== undefined);

  return (
    <View style={estilos.bloque}>
      <View style={estilos.cabecera}>
        <ThemedText type="subtitle" accessibilityRole="header">Vistos recientemente</ThemedText>
        <Pulsable onPress={borrarVistos} accessibilityRole="button" accessibilityLabel="Borrar vistos recientemente" style={estilos.borrar}>
          <ThemedText type="small" themeColor="textSecondary">Borrar</ThemedText>
        </Pulsable>
      </View>
      {fallo ? (
        <ErrorDeCarga etiqueta="No pudimos cargar lo que viste" onReintentar={reintentar} />
      ) : cargando ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.carril}>
          {ordenadas.map((p) => (
            <TarjetaVista key={p.id} p={p} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TarjetaVista({ p }: { p: PublicacionExplorar }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('publicacion', p.id, p.num_fotos, true);
  const zona = zonaCorta(p.zona);
  return (
    <Pulsable
      onPress={() => router.push(`/publicacion/${p.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes`}
      style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
    >
      <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={p.titulo_publico} />
      </View>
      <View style={estilos.textos}>
        <ThemedText style={Texto.pequenoFuerte} numberOfLines={2}>{p.titulo_publico}</ThemedText>
        {zona ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{zona}</ThemedText> : null}
        <ThemedText style={Texto.pequenoFuerte}>{`$${precio.format(p.precio_renta)}`}</ThemedText>
      </View>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: Spacing.two },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  borrar: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  carril: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  tarjeta: { width: ANCHO_TARJETA, borderWidth: Filete.fino, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  foto: { height: 110 },
  imagen: { width: '100%', height: '100%' },
  textos: { padding: Spacing.two, gap: Spacing.half },
});
