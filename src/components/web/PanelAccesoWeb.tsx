import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { Colors, Filete, Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';

const D = Colors.dark;

const GANAS: { texto: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { texto: 'Escribe a quien publica, dentro de la app.', icono: 'chatbubble-ellipses-outline' },
  { texto: 'Mira cómo encajas con cada lugar y cada roomie.', icono: 'sparkles-outline' },
  { texto: 'Guarda lo que te guste para decidir con calma.', icono: 'heart-outline' },
];

/**
 * El panel de marca de las pantallas de acceso en la web ancha: carbón (siempre oscuro) con las líneas de mapa de la portada, el logo (lleva al inicio) y lo que se gana al entrar.
 * Solo dice lo que la app sostiene: no promete nada que una cuenta no dé.
 */
export function PanelAccesoWeb() {
  return (
    <View style={estilos.panel}>
      <Image source={require('../../../assets/images/web/topografia.svg')} style={estilos.topografia} contentFit="cover" accessible={false} pointerEvents="none" />
      <Pulsable onPress={() => router.push(RutasWeb.inicio)} accessibilityRole="link" accessibilityLabel="Ir al inicio" style={estilos.marca}>
        <LogoMarca tamano={44} />
        <Text style={[Texto.subtitulo, { color: D.text }]}>Cuervo 360</Text>
      </Pulsable>
      <View style={estilos.cuerpo}>
        <Text accessibilityRole="header" style={[Texto.titularWebCompacto, { color: D.text }]}>
          Entra y encuentra dónde <Text style={{ color: D.lima }}>vivir</Text>, con quién.
        </Text>
        <View style={estilos.ganas}>
          {GANAS.map((g) => (
            <View key={g.texto} style={estilos.gana}>
              <Ionicons name={g.icono} size={22} color={D.lima} />
              <ThemedText style={[Texto.cuerpo, estilos.ganaTexto, { color: D.text }]}>{g.texto}</ThemedText>
            </View>
          ))}
        </View>
      </View>
      <ThemedText style={[Texto.pequeno, { color: D.textSecondary }]}>Proyecto académico de la UTVT</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  panel: { width: '42%', maxWidth: 640, backgroundColor: D.background, borderRightWidth: Filete.fino, borderRightColor: D.filete, padding: Spacing.six, justifyContent: 'space-between', overflow: 'hidden' },
  topografia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, alignSelf: 'flex-start' },
  cuerpo: { gap: Spacing.five },
  ganas: { gap: Spacing.three },
  gana: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  ganaTexto: { flex: 1 },
});
