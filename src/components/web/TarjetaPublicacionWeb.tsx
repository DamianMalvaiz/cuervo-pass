import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { FotoLista } from '@/components/FotoLista';
import { CorazonWeb } from '@/components/web/CorazonWeb';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { animTarjeta } from '@/lib/movimientoWeb';
import { RutasWeb } from '@/lib/rutasWeb';
import { subtituloTarjeta } from '@/lib/zona';
import type { PublicacionExplorar } from '@/services/explorar.service';

const D = Colors.dark;
// El contenedor de la foto: al pasar el cursor por la tarjeta, su imagen se acerca y gana sombra (CSS global).
const FOTOZOOM = { dataSet: { fotozoom: '1' } } as object;
const precio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
// El degradado que oscurece el pie de la foto para que el texto claro se lea sobre cualquier imagen (RN no conoce `backgroundImage`; react-native-web lo deja pasar al CSS).
const DEGRADADO = { backgroundImage: 'linear-gradient(180deg, rgba(10,14,11,0) 0%, rgba(10,14,11,0.86) 100%)' } as unknown as ViewStyle;

/**
 * Una vivienda para quien explora: foto grande 4:5, la etiqueta de destacado, el corazón (pide entrar sin cuenta; con cuenta guarda de verdad), título armado, zona corta y precio.
 * Solo lo que la vista pública enseña: nada de dirección exacta ni de quién publica. Con cuenta puede llevar `etiqueta` (el ajuste en palabras, sobre la foto) y `razon` (lo que lo explica, bajo el precio, con `iconoRazon`: la palomita significa «encaja»; para un dato que no es de ajuste, como la cercanía, se pone otro); sin ellas es la de siempre.
 */
export function TarjetaPublicacionWeb({ p, ancho, compacta = false, paso, etiqueta, razon, iconoRazon = 'checkmark-circle', previa, bento }: { p: PublicacionExplorar; ancho?: number; compacta?: boolean; paso?: number; etiqueta?: string; razon?: string; iconoRazon?: keyof typeof Ionicons.glyphMap; previa?: { fotoUri?: string }; bento?: { ancho: number; alto: number; grande?: boolean } }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('publicacion', p.id, p.num_fotos, true);
  const subtitulo = subtituloTarjeta(p);
  // Vista previa (quien publica ve cómo quedará): no es una vivienda real, así que no lleva a ninguna ficha ni se puede guardar, y sin precio lo dice en vez de enseñar «$0».
  const sinPrecio = Boolean(previa) && !(p.precio_renta > 0);

  // Variante «bento» (la de «Para ti»): la foto ocupa toda la tarjeta y el texto va encima, sobre un degradado. `grande` es el destacado: más alto y con el título más grande.
  if (bento) {
    const grande = Boolean(bento.grande);
    return (
      <Pulsable
        onPress={() => router.push(RutasWeb.ficha(p.id))}
        accessibilityRole="button"
        accessibilityLabel={`${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes${etiqueta ? `, ${etiqueta}` : ''}`}
        style={[estilos.bento, { width: bento.ancho, height: bento.alto, backgroundColor: theme.backgroundSelected }]}
        {...animTarjeta(paso)}
      >
        <FotoLista completa={fotos[0]} style={estilos.bentoFoto} accessibilityLabel={p.titulo_publico} />
        <View style={[estilos.bentoDegradado, DEGRADADO]} pointerEvents="none" />
        {etiqueta ? (
          <View style={estilos.bentoEtiqueta}>
            <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>{etiqueta}</ThemedText>
          </View>
        ) : null}
        <CorazonWeb tipo="publicacion" id={p.id} compacta={!grande} />
        <View style={[estilos.bentoTexto, grande && estilos.bentoTextoGrande]} pointerEvents="none">
          <ThemedText style={[grande ? Texto.seccionWeb : Texto.pequenoFuerte, { color: D.text }]} numberOfLines={grande ? 3 : 2}>{p.titulo_publico}</ThemedText>
          {subtitulo ? <ThemedText style={[Texto.pequeno, { color: D.textSecondary }]} numberOfLines={1}>{subtitulo}</ThemedText> : null}
          {razon ? (
            <View style={estilos.bentoRazon}>
              <ThemedText style={[Texto.pequenoFuerte, { color: D.text }]} numberOfLines={1}>{razon}</ThemedText>
            </View>
          ) : null}
          <ThemedText style={[grande ? Texto.seccionWeb : Texto.pequenoFuerte, { color: D.text }]}>{`$${precio.format(p.precio_renta)}`}<ThemedText style={[Texto.pequeno, { color: D.textSecondary }]}> al mes</ThemedText></ThemedText>
        </View>
      </Pulsable>
    );
  }

  return (
    <Pulsable
      onPress={previa ? undefined : () => router.push(RutasWeb.ficha(p.id))}
      accessibilityRole={previa ? 'image' : 'button'}
      accessibilityLabel={`${p.titulo_publico}, ${precio.format(p.precio_renta)} pesos al mes${etiqueta ? `, ${etiqueta}` : ''}`}
      style={[estilos.tarjeta, ancho ? { width: ancho } : estilos.flexible]}
      {...animTarjeta(paso)}
    >
      <View style={[estilos.foto, compacta && estilos.fotoCompacta, { backgroundColor: theme.backgroundSelected }]} {...FOTOZOOM}>
        <FotoLista completa={previa ? previa.fotoUri : fotos[0]} style={estilos.imagen} accessibilityLabel={p.titulo_publico} />
        {p.destacado ? (
          <View style={[estilos.destacado, compacta && estilos.destacadoCompacto]}>
            <ThemedText style={[compacta ? Texto.etiqueta : Texto.pequenoFuerte, { color: D.limaTexto }]}>Destacado</ThemedText>
          </View>
        ) : null}
        {etiqueta ? (
          <View style={[estilos.ajuste, compacta && estilos.ajusteCompacto]}>
            <ThemedText style={[compacta ? Texto.etiqueta : Texto.pequenoFuerte, { color: D.limaTexto }]}>{etiqueta}</ThemedText>
          </View>
        ) : null}
        {previa ? null : <CorazonWeb tipo="publicacion" id={p.id} compacta={compacta} />}
      </View>

      {compacta ? (
        <>
          <ThemedText style={Texto.pequenoFuerte} numberOfLines={2}>{p.titulo_publico}</ThemedText>
          {subtitulo ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{subtitulo}</ThemedText> : null}
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
          {subtitulo ? <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{subtitulo}</ThemedText> : null}
          {sinPrecio ? (
            <ThemedText style={Texto.pequeno} themeColor="textSecondary">Falta el precio</ThemedText>
          ) : (
            <ThemedText style={Texto.pequeno}>
              <ThemedText style={Texto.precioWeb}>${precio.format(p.precio_renta)}</ThemedText> al mes
            </ThemedText>
          )}
        </>
      )}
      {razon ? (
        <View style={estilos.razon}>
          <Ionicons name={iconoRazon} size={16} color={theme.bosque} />
          <ThemedText style={[Texto.pequenoFuerte, estilos.razonTexto, { color: theme.acento }]}>{razon}</ThemedText>
        </View>
      ) : null}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  bento: { borderRadius: Radios.tarjeta, overflow: 'hidden', justifyContent: 'flex-end' },
  bentoFoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  bentoDegradado: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%' },
  bentoEtiqueta: { position: 'absolute', left: Spacing.three, top: Spacing.three, backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one + Spacing.half, paddingHorizontal: Spacing.three },
  bentoTexto: { padding: Spacing.three, gap: Spacing.half },
  bentoTextoGrande: { padding: Spacing.five, gap: Spacing.two },
  bentoRazon: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, marginTop: Spacing.one },
  tarjeta: { gap: Spacing.one },
  flexible: { flexGrow: 1, flexBasis: 240, maxWidth: 360 },
  foto: { aspectRatio: 4 / 5, borderRadius: Radios.tarjeta, overflow: 'hidden', marginBottom: Spacing.one },
  fotoCompacta: { aspectRatio: 1 },
  imagen: { width: '100%', height: '100%' },
  destacado: { position: 'absolute', left: Spacing.three, top: Spacing.three, backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one + Spacing.half, paddingHorizontal: Spacing.three },
  destacadoCompacto: { left: Spacing.two, top: Spacing.two, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  ajuste: { position: 'absolute', left: Spacing.three, bottom: Spacing.three, backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one + Spacing.half, paddingHorizontal: Spacing.three },
  ajusteCompacto: { left: Spacing.two, bottom: Spacing.two, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  razon: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one + Spacing.half, marginTop: Spacing.one },
  razonTexto: { flex: 1 },
  precioFila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  linea: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  titulo: { flex: 1 },
  calificacion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
