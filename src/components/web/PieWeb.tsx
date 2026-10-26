import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';

const D = Colors.dark;

/** El pie de la web pública, sobre carbón: quién es Cuervo 360 y los dos documentos que explican cómo se tratan los datos. */
export function PieWeb() {
  return (
    <View style={estilos.pie}>
      <View style={estilos.fila}>
        <View style={estilos.marca}>
          <View style={estilos.logoYNombre}>
            <LogoMarca tamano={40} />
            <ThemedText style={[Texto.subtitulo, { color: D.text }]}>Cuervo 360</ThemedText>
          </View>
          <ThemedText style={[Texto.cuerpo, estilos.frase, { color: D.textSecondary }]}>Departamentos, roomies y servicios cerca de tu universidad.</ThemedText>
        </View>
        <View style={estilos.columna}>
          <ThemedText style={[Texto.pequenoFuerte, { color: D.lima }]}>Legal</ThemedText>
          <Pulsable onPress={() => router.push('/aviso-privacidad')} accessibilityRole="link" accessibilityLabel="Aviso de privacidad" style={estilos.enlace}>
            <ThemedText style={[Texto.cuerpo, { color: D.text }]}>Aviso de privacidad</ThemedText>
          </Pulsable>
          <Pulsable onPress={() => router.push('/terminos')} accessibilityRole="link" accessibilityLabel="Términos y condiciones" style={estilos.enlace}>
            <ThemedText style={[Texto.cuerpo, { color: D.text }]}>Términos y condiciones</ThemedText>
          </Pulsable>
        </View>
      </View>
      <ThemedText style={[Texto.pequeno, estilos.linea, { color: D.textSecondary }]}>© Cuervo 360 · Proyecto académico de la UTVT</ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  pie: { backgroundColor: D.background, borderTopLeftRadius: Radios.panel, borderTopRightRadius: Radios.panel, padding: Spacing.five, gap: Spacing.four },
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.five },
  marca: { gap: Spacing.three, maxWidth: 360 },
  logoYNombre: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  frase: { maxWidth: 300 },
  columna: { gap: Spacing.one },
  enlace: { minHeight: 44, justifyContent: 'center' },
  linea: { borderTopWidth: Filete.fino, borderTopColor: D.backgroundSelected, paddingTop: Spacing.three },
});
