import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';

const L = Colors.light;

/** Cada línea afirma algo que el aviso de privacidad o la app sostienen: la revisión de identidad la hace una persona, no se venden ni se usan los datos para publicidad, y existe «Eliminar mi cuenta». */
const PROMESAS: { texto: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { texto: 'Quien vende pasa por una revisión de identidad hecha por una persona.', icono: 'shield-checkmark-outline' },
  { texto: 'No vendemos tus datos ni los usamos para publicidad.', icono: 'lock-closed-outline' },
  { texto: 'Puedes borrar tu cuenta cuando quieras.', icono: 'person-remove-outline' },
];

/** El bloque de confianza: un panel lima (siempre lima, con texto carbón) y un sello. El sello es un dibujo; lo que dice va como texto, que es lo que se anuncia y se puede leer. */
export function ConfianzaWeb({ escritorio }: { escritorio: boolean }) {
  return (
    <View style={[estilos.panel, escritorio ? estilos.panelAncho : estilos.panelCompacto]}>
      <View style={escritorio ? estilos.texto : undefined}>
        <ThemedText accessibilityRole="header" style={[escritorio ? Texto.titularWebCompacto : Texto.seccionWebCompacto, { color: L.limaTexto }]}>Hecho para que confíes</ThemedText>
        <View style={estilos.promesas}>
          {PROMESAS.map((p) => (
            <View key={p.texto} style={estilos.promesa}>
              <Ionicons name={p.icono} size={26} color={L.limaTexto} />
              <ThemedText style={[Texto.subtitulo, estilos.promesaTexto, { color: L.limaTexto }]}>{p.texto}</ThemedText>
            </View>
          ))}
        </View>
      </View>
      {escritorio ? (
        <View style={estilos.sello}>
          <Image source={require('../../../assets/images/web/sello.svg')} style={estilos.selloImagen} contentFit="contain" accessible={false} />
          <ThemedText style={[Texto.pequenoFuerte, { color: L.limaTexto }]}>Identidad revisada por una persona</ThemedText>
        </View>
      ) : (
        <ThemedText style={[Texto.pequenoFuerte, { color: L.limaTexto }]}>Identidad revisada por una persona</ThemedText>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  panel: { backgroundColor: L.lima, borderRadius: Radios.panel },
  panelAncho: { flexDirection: 'row', alignItems: 'center', gap: Spacing.five, padding: Spacing.six - Spacing.one },
  panelCompacto: { padding: Spacing.four, gap: Spacing.three },
  texto: { flex: 1, minWidth: 0 },
  promesas: { gap: Spacing.three + Spacing.one, marginTop: Spacing.four },
  promesa: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  promesaTexto: { flex: 1 },
  sello: { alignItems: 'center', gap: Spacing.three },
  selloImagen: { width: 240, height: 240 },
});
