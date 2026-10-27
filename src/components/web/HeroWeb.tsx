import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { BarraWeb } from '@/components/web/BarraWeb';
import { BuscadorWeb } from '@/components/web/BuscadorWeb';
import { AnchoMaximoWeb, Colors, Radios, Spacing, Texto } from '@/constants/theme';
import type { FiltrosWeb } from '@/lib/filtrosWeb';

const D = Colors.dark;
const L = Colors.light;

const PROMESAS: { texto: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { texto: 'Vendedores verificados', icono: 'shield-checkmark-outline' },
  { texto: 'No vendemos tus datos', icono: 'lock-closed-outline' },
  { texto: 'Gratis para estudiantes', icono: 'checkmark-circle-outline' },
];

/** Los tres huecos del collage: posición y tamaño dentro de un lienzo de 568 × 548. */
const HUECOS = [
  { left: 0, top: 26, width: 284, height: 480 },
  { left: 304, top: 0, width: 264, height: 232 },
  { left: 304, top: 252, width: 264, height: 254 },
] as const;

/**
 * El hero de la portada: un panel de carbón (siempre oscuro) con líneas de mapa muy suaves, el titular, las tres promesas y, a la derecha, un collage con las fotos de lo más reciente.
 * El buscador cabalga el borde de abajo. La tarjeta de ajuste es un EJEMPLO y lo dice: el ajuste real depende de lo que la persona respondió y solo existe con cuenta.
 */
export function HeroWeb({
  escritorio,
  filtros,
  onCambiar,
  onBuscar,
  fotos,
}: {
  escritorio: boolean;
  filtros: FiltrosWeb;
  onCambiar: (f: FiltrosWeb) => void;
  onBuscar: () => void;
  /** URL ya firmadas de las primeras fotos, una por hueco del collage; un hueco sin foto queda vacío. */
  fotos: (string | undefined)[];
}) {
  return (
    <View style={escritorio ? estilos.envoltura : undefined}>
      <View style={[estilos.panel, escritorio ? estilos.panelAncho : undefined]}>
        <Image source={require('../../../assets/images/web/topografia.svg')} style={estilos.topografia} contentFit="cover" accessible={false} pointerEvents="none" />

        <View style={[estilos.interior, escritorio ? estilos.interiorAncho : estilos.interiorCompacto]}>
        <BarraWeb escritorio={escritorio} />

        <View style={escritorio ? estilos.cuerpoAncho : estilos.cuerpoCompacto}>
          <View style={escritorio ? estilos.texto : undefined}>
            <Text accessibilityRole="header" style={[escritorio ? Texto.titularWeb : Texto.titularWebCompacto, { color: D.text }]}>
              Encuentra dónde <Text style={{ color: D.lima }}>vivir</Text>, con quién y qué hay cerca.
            </Text>
            <ThemedText style={[Texto.subtituloWeb, estilos.subtitulo, { color: D.textSecondary }]}>
              Departamentos y cuartos a minutos de tu universidad, roomies compatibles contigo y los negocios que necesitas en tu día a día.
            </ThemedText>
            <View style={estilos.promesas}>
              {PROMESAS.map((p) => (
                <View key={p.texto} style={estilos.promesa}>
                  <Ionicons name={p.icono} size={20} color={D.lima} />
                  <ThemedText style={[Texto.pequenoFuerte, { color: D.text }]}>{p.texto}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {escritorio ? (
            <View style={estilos.collage}>
              {HUECOS.map((h, i) => (
                <View key={i} style={[estilos.foto, h]}>
                  {fotos[i] ? <FotoLista completa={fotos[i]} style={estilos.fotoImagen} accessibilityLabel="Foto de un lugar publicado" /> : <Ionicons name="image-outline" size={32} color={D.textSecondary} />}
                </View>
              ))}
              <View style={estilos.ajuste}>
                <ThemedText style={[Texto.etiqueta, estilos.ejemplo]}>Ejemplo</ThemedText>
                <View style={estilos.ajusteCabeza}>
                  <View style={estilos.ajusteNumero}>
                    <Text style={[Texto.ajusteWeb, { color: D.limaTexto }]}>94</Text>
                  </View>
                  <View style={estilos.ajusteTexto}>
                    <ThemedText style={[Texto.pequenoFuerte, { color: L.text }]}>de ajuste contigo</ThemedText>
                    <ThemedText style={[Texto.pequeno, { color: L.textSecondary }]}>según tu presupuesto y tus hábitos</ThemedText>
                  </View>
                </View>
                <View style={estilos.ajusteChips}>
                  {['Presupuesto', 'Distancia', 'Mascotas'].map((c) => (
                    <View key={c} style={estilos.ajusteChip}>
                      <Ionicons name="checkmark" size={14} color={L.acento} />
                      <ThemedText style={[Texto.pequenoFuerte, { color: L.text }]}>{c}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {!escritorio ? <BuscadorWeb compacto filtros={filtros} onCambiar={onCambiar} onBuscar={onBuscar} /> : null}
        </View>
      </View>

      {escritorio ? (
        <View style={estilos.buscador}>
          <BuscadorWeb filtros={filtros} onCambiar={onCambiar} onBuscar={onBuscar} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  envoltura: { position: 'relative', marginBottom: 56 },
  // De borde a borde: el panel ocupa todo el ancho de la ventana (solo se redondean las esquinas de abajo) y su contenido se centra dentro, acotado a `AnchoMaximoWeb`.
  panel: { width: '100%', backgroundColor: D.background, borderBottomLeftRadius: Radios.panel, borderBottomRightRadius: Radios.panel, overflow: 'hidden' },
  panelAncho: { paddingTop: Spacing.four, paddingBottom: 124 },
  interior: { width: '100%', maxWidth: AnchoMaximoWeb, alignSelf: 'center' },
  interiorAncho: { paddingHorizontal: Spacing.five },
  interiorCompacto: { padding: Spacing.three, gap: Spacing.four },
  topografia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cuerpoAncho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, paddingTop: Spacing.five },
  cuerpoCompacto: { gap: Spacing.three },
  texto: { flex: 1, minWidth: 0 },
  subtitulo: { marginTop: Spacing.four, maxWidth: 520 },
  promesas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.four },
  promesa: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  collage: { width: 568, height: 548 },
  foto: { position: 'absolute', borderRadius: Radios.hojaInferior, overflow: 'hidden', backgroundColor: D.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  fotoImagen: { width: '100%', height: '100%' },
  ajuste: {
    position: 'absolute',
    left: -40,
    top: 392,
    width: 300,
    padding: Spacing.three,
    gap: Spacing.two + Spacing.one,
    backgroundColor: L.backgroundElement,
    borderRadius: Radios.tarjeta,
    boxShadow: '0px 22px 40px -16px rgba(0, 0, 0, 0.55)',
  },
  ejemplo: { position: 'absolute', right: Spacing.three, top: Spacing.three, color: L.textSecondary, textTransform: 'uppercase' },
  ajusteCabeza: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.three },
  ajusteNumero: { backgroundColor: D.lima, borderRadius: Radios.control, minWidth: 64, height: 56, alignItems: 'center', justifyContent: 'center' },
  ajusteTexto: { flex: 1, minWidth: 0 },
  ajusteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  ajusteChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, backgroundColor: L.background, borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  buscador: { position: 'absolute', left: 0, right: 0, bottom: -44, alignItems: 'center', paddingHorizontal: Spacing.five },
});
