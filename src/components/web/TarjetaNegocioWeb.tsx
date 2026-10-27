import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { FotoLista } from '@/components/FotoLista';
import { CorazonWeb } from '@/components/web/CorazonWeb';
import { ThemedText } from '@/components/themed-text';
import { Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';
import { zonaCorta } from '@/lib/zona';
import type { NegocioExplorar } from '@/services/explorar.service';

/** Un negocio: la foto redondeada con su corazón (pide entrar sin cuenta; con cuenta guarda), el nombre debajo, la zona corta y si está abierto (solo si se sabe), como las tarjetas de un carrusel. */
export function TarjetaNegocioWeb({ n, ancho }: { n: NegocioExplorar; ancho: number }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('negocio', n.id, n.num_fotos);
  const zona = zonaCorta(n.zona);
  const estado = n.abierto_ahora === null ? null : n.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora';
  return (
    <Pulsable onPress={() => router.push(RutasWeb.negocio(n.id))} accessibilityRole="button" accessibilityLabel={estado ? `${n.nombre}, ${estado}` : n.nombre} style={[estilos.tarjeta, { width: ancho }]}>
      <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={n.nombre} />
        <CorazonWeb tipo="negocio" id={n.id} compacta />
      </View>
      <ThemedText style={Texto.pequenoFuerte} numberOfLines={2}>{n.nombre}</ThemedText>
      {zona ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{zona}</ThemedText> : null}
      {estado ? <ThemedText style={[Texto.pequeno, { color: n.abierto_ahora ? theme.exito : theme.textSecondary }]}>{estado}</ThemedText> : null}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: Spacing.one },
  foto: { aspectRatio: 1, borderRadius: Radios.tarjeta, overflow: 'hidden', marginBottom: Spacing.one },
  imagen: { width: '100%', height: '100%' },
});
