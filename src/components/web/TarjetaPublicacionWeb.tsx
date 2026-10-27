import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { FotoLista } from '@/components/FotoLista';
import { CorazonWeb } from '@/components/web/CorazonWeb';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { animTarjeta } from '@/lib/movimientoWeb';
import { RutasWeb } from '@/lib/rutasWeb';
import { zonaCorta } from '@/lib/zona';
import type { PublicacionExplorar } from '@/services/explorar.service';

const D = Colors.dark;
// El contenedor de la foto: al pasar el cursor por la tarjeta, su imagen se acerca y gana sombra (CSS global).
const FOTOZOOM = { dataSet: { fotozoom: '1' } } as object;
const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * Una vivienda para quien explora: foto grande 4:5, la etiqueta de destacado, el corazón (pide entrar sin cuenta; con cuenta guarda de verdad), título armado, zona corta y precio.
 * Solo lo que la vista pública enseña: nada de dirección exacta ni de quién publica.
 */
export function TarjetaPublicacionWeb({ p, ancho, compacta = false, paso }: { p: PublicacionExplorar; ancho?: number; compacta?: boolean; paso?: number }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('publicacion', p.id, p.num_fotos);
  const zona = zonaCorta(p.zona);

  return (
    <Pulsable
      onPress={() => router.push(RutasWeb.ficha(p.id))}
      accessibilityRole="button"
      accessibilityLabel={`${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes`}
      style={[estilos.tarjeta, ancho ? { width: ancho } : estilos.flexible]}
      {...animTarjeta(paso)}
    >
      <View style={[estilos.foto, compacta && estilos.fotoCompacta, { backgroundColor: theme.backgroundSelected }]} {...FOTOZOOM}>
        <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={p.titulo_publico} />
        {p.destacado ? (
          <View style={[estilos.destacado, compacta && estilos.destacadoCompacto]}>
            <ThemedText style={[compacta ? Texto.etiqueta : Texto.pequenoFuerte, { color: D.limaTexto }]}>Destacado</ThemedText>
          </View>
        ) : null}
        <CorazonWeb tipo="publicacion" id={p.id} compacta={compacta} />
      </View>

      {compacta ? (
        <>
          <ThemedText style={Texto.pequenoFuerte} numberOfLines={2}>{p.titulo_publico}</ThemedText>
          {zona ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{zona}</ThemedText> : null}
          <View style={estilos.precioFila}>
            <ThemedText style={Texto.pequeno}>
              <ThemedText style={Texto.pequenoFuerte}>${precio.format(p.precio_renta)}</ThemedText> al mes
            </ThemedText>
            {p.calificacion ? (
              <View style={estilos.calificacion} accessibilityLabel={`Calificación ${p.calificacion.toFixed(1)} de 5`}>
                <Ionicons name="star" size={12} color={theme.text} />
                <ThemedText style={Texto.pequeno}>{p.calificacion.toFixed(1)}</ThemedText>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <>
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
        </>
      )}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { gap: Spacing.one },
  flexible: { flexGrow: 1, flexBasis: 240, maxWidth: 360 },
  foto: { aspectRatio: 4 / 5, borderRadius: Radios.tarjeta, overflow: 'hidden', marginBottom: Spacing.one },
  fotoCompacta: { aspectRatio: 1 },
  imagen: { width: '100%', height: '100%' },
  destacado: { position: 'absolute', left: Spacing.three, top: Spacing.three, backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one + Spacing.half, paddingHorizontal: Spacing.three },
  destacadoCompacto: { left: Spacing.two, top: Spacing.two, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  precioFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flex: 1 },
  calificacion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
