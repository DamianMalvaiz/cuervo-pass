import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;

/** Personas de EJEMPLO. Los perfiles reales solo se ven con cuenta; aquí se enseña cómo se ve una tarjeta y su compatibilidad, y cada una lo dice. */
const PERSONAS = [
  { nombre: 'Ana, 21', inicial: 'A', compat: 89, etiquetas: ['Tranquila', 'Sin mascotas'], izquierda: 0, arriba: 56, giro: '-4deg' },
  { nombre: 'Valeria, 22', inicial: 'V', compat: 94, etiquetas: ['Acepta mascotas', 'Madruga'], izquierda: 180, arriba: 0, giro: '2deg' },
  { nombre: 'Sofía, 20', inicial: 'S', compat: 82, etiquetas: ['Estudia de noche', 'Tranquila'], izquierda: 360, arriba: 96, giro: '5deg' },
] as const;

const PUNTOS = [
  { texto: 'Perfiles con foto y presentación, para decidir sin conocerse antes.', icono: 'checkmark' as const },
  { texto: 'Compatibilidad calculada con lo que tú respondiste.', icono: 'checkmark' as const },
  { texto: 'Los perfiles se ven al iniciar sesión.', icono: 'lock-closed-outline' as const },
];

function Tarjeta({ p, estilo }: { p: (typeof PERSONAS)[number]; estilo?: object }) {
  const theme = useTheme();
  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement }, estilo]}>
      <View style={estilos.retrato}>
        <Text style={[Texto.titularWeb, { color: D.lima }]}>{p.inicial}</Text>
        <View style={estilos.ejemplo}>
          <ThemedText style={[Texto.etiqueta, { color: D.text }]}>Ejemplo</ThemedText>
        </View>
      </View>
      <View style={estilos.datos}>
        <View style={estilos.linea}>
          <ThemedText style={Texto.subtitulo}>{p.nombre}</ThemedText>
          <View style={estilos.compat} accessibilityLabel={`${p.compat}% compatible`}>
            <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>{p.compat}%</ThemedText>
          </View>
        </View>
        <View style={estilos.etiquetas}>
          {p.etiquetas.map((e) => (
            <View key={e} style={[estilos.etiqueta, { backgroundColor: theme.background }]}>
              <ThemedText style={Texto.pequenoFuerte}>{e}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * La sección de Roomies de la portada: de qué trata y cómo se ve una tarjeta de compatibilidad. Sin cuenta no hay perfiles reales que enseñar, así que las tres personas son ejemplos marcados como tales;
 * El botón lo decide la página: en el inicio lleva a la página de Roomies; en la de Roomies, a entrar. En pantallas angostas se enseña una sola tarjeta, sin giro.
 */
export function RoomiesWeb({ escritorio, textoBoton, alBoton }: { escritorio: boolean; textoBoton: string; alBoton: () => void }) {
  const theme = useTheme();
  return (
    <View style={[estilos.panel, { backgroundColor: theme.tintedSurface }, escritorio ? estilos.panelAncho : estilos.panelCompacto]}>
      <View style={escritorio ? estilos.texto : undefined}>
        <ThemedText accessibilityRole="header" style={escritorio ? Texto.seccionWeb : Texto.seccionWebCompacto}>Con quién vives importa tanto como dónde</ThemedText>
        <ThemedText style={[Texto.cuerpo, estilos.parrafo]} themeColor="textSecondary">
          Compara hábitos, no solo gustos: ruido, mascotas, horarios y presupuesto. Te decimos qué tan compatible eres con cada persona.
        </ThemedText>
        <View style={estilos.puntos}>
          {PUNTOS.map((p) => (
            <View key={p.texto} style={estilos.punto}>
              <Ionicons name={p.icono} size={20} color={theme.bosque} />
              <ThemedText style={[Texto.cuerpo, estilos.puntoTexto]}>{p.texto}</ThemedText>
            </View>
          ))}
        </View>
        <View style={estilos.boton}>
          <BotonWeb variante="carbon" onPress={alBoton}>{textoBoton}</BotonWeb>
        </View>
      </View>

      {escritorio ? (
        <View style={estilos.pila}>
          {PERSONAS.map((p, i) => (
            <Tarjeta key={p.nombre} p={p} estilo={{ position: 'absolute', left: p.izquierda, top: p.arriba, zIndex: i === 1 ? 2 : 1, transform: [{ rotate: p.giro }] }} />
          ))}
        </View>
      ) : (
        <Tarjeta p={PERSONAS[1]} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  panel: { borderRadius: Radios.panel, overflow: 'hidden' },
  panelAncho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, padding: Spacing.six - Spacing.one, paddingRight: Spacing.five },
  panelCompacto: { padding: Spacing.four, gap: Spacing.four },
  texto: { flex: 1, minWidth: 0 },
  parrafo: { marginTop: Spacing.three, maxWidth: 480 },
  puntos: { gap: Spacing.three, marginTop: Spacing.four },
  punto: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  puntoTexto: { flex: 1 },
  boton: { marginTop: Spacing.four, alignItems: 'flex-start' },
  pila: { width: 560, height: 440 },
  tarjeta: { width: 190, borderRadius: Radios.hojaInferior, padding: Spacing.two, boxShadow: '0px 30px 50px -24px rgba(10, 14, 11, 0.5), 0px 2px 8px rgba(10, 14, 11, 0.08)' },
  retrato: { height: 150, borderRadius: Radios.tarjeta - Spacing.two, backgroundColor: D.background, alignItems: 'center', justifyContent: 'center' },
  ejemplo: { position: 'absolute', left: Spacing.two + Spacing.half, top: Spacing.two + Spacing.half, backgroundColor: D.backgroundSelected, borderRadius: Radios.full, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  datos: { padding: Spacing.two, paddingTop: Spacing.three, gap: Spacing.two + Spacing.one },
  linea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.one },
  compat: { backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.half, paddingHorizontal: Spacing.two },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + Spacing.half },
  etiqueta: { borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
});
