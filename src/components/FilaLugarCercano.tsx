import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FotoLista } from '@/components/FotoLista';
import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { textoDeCercania } from '@/lib/cerca';
import { subtituloTarjeta } from '@/lib/zona';
import type { PublicacionExplorar } from '@/services/explorar.service';

const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const LADO_FOTO = 92;

/**
 * Un lugar de «Cerca de tu universidad» en la app: foto cuadrada a la izquierda; a la derecha título, zona, precio y, con su icono, lo que dice la cercanía («a menos de 1 km · ~6 min a pie»). Solo lo que la vista pública enseña: nada de
 * dirección exacta ni de quién publica. La distancia es aproximada y el tiempo, una estimación en línea recta: `textoDeCercania` lo redacta así.
 */
export function FilaLugarCercano({ p, km }: { p: PublicacionExplorar; km: number }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('publicacion', p.id, p.num_fotos, true);
  const subtitulo = subtituloTarjeta(p);
  const cercania = textoDeCercania(km);
  return (
    <Pulsable
      onPress={() => router.push(`/publicacion/${p.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes, ${cercania}`}
      style={[estilos.fila, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
    >
      <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.imagen} />
      </View>
      <View style={estilos.textos}>
        <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]} numberOfLines={2}>{p.titulo_publico}</ThemedText>
        {subtitulo ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{subtitulo}</ThemedText> : null}
        <ThemedText style={Texto.pequenoFuerte}>{`$${precio.format(p.precio_renta)} al mes`}</ThemedText>
        <View style={estilos.cercania}>
          <Ionicons name="location-outline" size={16} color={theme.bosque} />
          <ThemedText style={[Texto.pequeno, estilos.textoCercania]} themeColor="textSecondary">{cercania}</ThemedText>
        </View>
      </View>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.two, borderWidth: Filete.fino, borderRadius: Radios.tarjeta, minHeight: 44 },
  foto: { width: LADO_FOTO, height: LADO_FOTO, borderRadius: Radios.control, overflow: 'hidden' },
  imagen: { width: '100%', height: '100%' },
  textos: { flex: 1, minWidth: 0, gap: Spacing.half, justifyContent: 'center' },
  cercania: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  textoCercania: { flex: 1, minWidth: 0 },
});
