import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';
import { zonaCorta } from '@/lib/zona';
import type { PublicacionExplorar } from '@/services/explorar.service';

const D = Colors.dark;
const L = Colors.light;
const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * Una vivienda para quien explora sin cuenta: foto grande 4:5, la etiqueta de destacado, el corazón (que pide entrar: sin cuenta no se guarda nada), título armado, zona corta y precio.
 * Solo lo que la vista pública enseña: nada de dirección exacta ni de quién publica.
 */
export function TarjetaPublicacionWeb({ p, ancho }: { p: PublicacionExplorar; ancho?: number }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('publicacion', p.id, p.num_fotos);
  const zona = zonaCorta(p.zona);

  return (
    <Pulsable
      onPress={() => router.push(RutasWeb.ficha(p.id))}
      accessibilityRole="button"
      accessibilityLabel={`${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes`}
      style={[estilos.tarjeta, ancho ? { width: ancho } : estilos.flexible]}
    >
      <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
        <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={p.titulo_publico} />
        {p.destacado ? (
          <View style={estilos.destacado}>
            <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>Destacado</ThemedText>
          </View>
        ) : null}
        <Pulsable
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Guardar: inicia sesión para guardar"
          style={estilos.corazon}
        >
          <Ionicons name="heart-outline" size={22} color={L.text} />
        </Pulsable>
      </View>

      <View style={estilos.linea}>
        <ThemedText style={[Texto.pequenoFuerte, estilos.titulo]} numberOfLines={1}>{p.titulo_publico}</ThemedText>
        {p.calificacion ? (
          <View style={estilos.calificacion} accessibilityLabel={`Calificación ${p.calificacion.toFixed(1)} de 5`}>
            <Ionicons name="star" size={14} color={theme.text} />
            <ThemedText style={Texto.pequenoFuerte}>{p.calificacion.toFixed(1)}</ThemedText>
          </View>
        ) : null}
      </View>
      {zona ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{zona}</ThemedText> : null}
      <ThemedText style={Texto.pequeno}>
        <ThemedText style={Texto.precioWeb}>${precio.format(p.precio_renta)}</ThemedText> al mes
      </ThemedText>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: Spacing.one },
  flexible: { flexGrow: 1, flexBasis: 240, maxWidth: 360 },
  foto: { aspectRatio: 4 / 5, borderRadius: Radios.tarjeta, overflow: 'hidden', marginBottom: Spacing.one },
  imagen: { width: '100%', height: '100%' },
  destacado: { position: 'absolute', left: Spacing.three, top: Spacing.three, backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one + Spacing.half, paddingHorizontal: Spacing.three },
  corazon: { position: 'absolute', right: Spacing.three, top: Spacing.three, width: 44, height: 44, borderRadius: Radios.full, backgroundColor: L.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flex: 1 },
  calificacion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
