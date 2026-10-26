import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;

const PASOS = [
  { titulo: 'Cuéntanos qué buscas', texto: 'Presupuesto, distancia a tu universidad y cómo vives. Tarda un minuto.' },
  { titulo: 'Ordenamos por ajuste', texto: 'Lo que mejor encaja contigo aparece primero, y te decimos por qué.' },
  { titulo: 'Escribe dentro de la app', texto: 'La conversación se queda aquí: sin dar tu teléfono antes de tiempo.' },
];

/** Criterios de EJEMPLO: frases sin cifras concretas (no hay presupuesto ni universidad de nadie que comparar). La barra solo ilustra qué tanto cumple. */
const CRITERIOS = [
  { nombre: 'Presupuesto', frase: 'Dentro de tu tope', llena: 0.78 },
  { nombre: 'Distancia', frase: 'Cerca de tu universidad', llena: 0.92 },
  { nombre: 'Mascotas', frase: 'Las aceptan', llena: 1 },
  { nombre: 'Ruido', frase: 'Tranquilo, como tú', llena: 0.84 },
];

/**
 * «Cómo funciona»: los tres pasos y, al lado, cómo se ve el ajuste con un lugar. La tarjeta es un EJEMPLO y lo dice: el ajuste de verdad se calcula con las respuestas de cada persona y solo existe con cuenta.
 * `foto` y `titulo` son los de un lugar publicado, para que se reconozca; si no hay, queda el recuadro y un título genérico.
 */
export function ComoFuncionaWeb({ escritorio, foto, titulo = 'Cuarto cerca de tu universidad' }: { escritorio: boolean; foto?: string; titulo?: string }) {
  const theme = useTheme();
  return (
    <View style={escritorio ? estilos.fila : estilos.columna}>
      <View style={escritorio ? estilos.pasosAncho : undefined}>
        <ThemedText accessibilityRole="header" style={[escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto, estilos.titulo]}>Cómo funciona, sin adivinar</ThemedText>
        {PASOS.map((p, i) => (
          <View key={p.titulo} style={estilos.paso}>
            <View style={estilos.numeroCol}>
              <View style={estilos.numero}>
                <Text style={[Texto.subtitulo, { color: D.lima }]}>{i + 1}</Text>
              </View>
              {i < PASOS.length - 1 ? <View style={[estilos.conector, { backgroundColor: theme.filete }]} /> : null}
            </View>
            <View style={estilos.pasoTexto}>
              <ThemedText style={Texto.subtitulo}>{p.titulo}</ThemedText>
              <ThemedText style={[Texto.cuerpo, estilos.pasoDetalle]} themeColor="textSecondary">{p.texto}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={[estilos.demo, { backgroundColor: theme.backgroundElement }, escritorio && estilos.demoAncha]}>
        <View style={[estilos.foto, { backgroundColor: theme.backgroundSelected }]}>
          <FotoLista completa={foto} style={estilos.imagen} accessibilityLabel={titulo} />
          <View style={estilos.ejemplo}>
            <ThemedText style={[Texto.etiqueta, { color: D.text }]}>Ejemplo</ThemedText>
          </View>
        </View>
        <View style={estilos.cuerpo}>
          <View style={estilos.cabeza}>
            <ThemedText style={[Texto.subtitulo, estilos.tituloDemo]} numberOfLines={2}>{titulo}</ThemedText>
            <View style={estilos.ajuste}>
              <Text style={[Texto.ajusteWeb, { color: D.limaTexto }]}>92</Text>
              <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>de ajuste</ThemedText>
            </View>
          </View>
          {CRITERIOS.map((c) => (
            <View key={c.nombre} style={estilos.criterio}>
              <View style={estilos.criterioLinea}>
                <Ionicons name="checkmark" size={20} color={theme.bosque} />
                <ThemedText style={[Texto.pequenoFuerte, estilos.criterioNombre]}>{c.nombre}</ThemedText>
                <ThemedText style={Texto.pequeno} themeColor="textSecondary">{c.frase}</ThemedText>
              </View>
              <View style={[estilos.barra, { backgroundColor: theme.backgroundSelected }]}>
                <View style={[estilos.relleno, { width: `${c.llena * 100}%`, backgroundColor: theme.bosque }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.six },
  columna: { gap: Spacing.five },
  pasosAncho: { flex: 1, minWidth: 0 },
  titulo: { marginBottom: Spacing.five },
  paso: { flexDirection: 'row', gap: Spacing.three + Spacing.one },
  numeroCol: { alignItems: 'center' },
  numero: { width: 52, height: 52, borderRadius: Radios.full, backgroundColor: D.background, alignItems: 'center', justifyContent: 'center' },
  conector: { width: 2, flex: 1, minHeight: 36, marginVertical: Spacing.one },
  pasoTexto: { flex: 1, paddingBottom: Spacing.four, paddingTop: Spacing.one },
  pasoDetalle: { marginTop: Spacing.one, maxWidth: 420 },
  demo: { borderRadius: Radios.panel - Spacing.one, padding: Spacing.three - Spacing.half, boxShadow: '0px 40px 70px -30px rgba(10, 14, 11, 0.45), 0px 3px 10px rgba(10, 14, 11, 0.08)' },
  demoAncha: { flex: 1, minWidth: 0, maxWidth: 540 },
  foto: { height: 230, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  imagen: { width: '100%', height: '100%' },
  ejemplo: { position: 'absolute', right: Spacing.three, top: Spacing.three, backgroundColor: D.background, borderRadius: Radios.full, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  cuerpo: { padding: Spacing.three, gap: Spacing.three },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  tituloDemo: { flex: 1 },
  ajuste: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: D.lima, borderRadius: Radios.control, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  criterio: { gap: Spacing.one + Spacing.half },
  criterioLinea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  criterioNombre: { flex: 1 },
  barra: { height: 7, borderRadius: Radios.full, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: Radios.full },
});
