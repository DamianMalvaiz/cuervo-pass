import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { LogoMarca } from '@/components/LogoMarca';
import { ThemedText } from '@/components/themed-text';
import { AnchoMaximoWeb, Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';

const D = Colors.dark;

// Las páginas informativas (contenido fijo): el pie las enseña siempre, con o sin cuenta.
const AYUDA = [
  { ruta: RutasWeb.ayuda, nombre: 'Ayuda y contacto' },
  { ruta: RutasWeb.guiaDeVisita, nombre: 'Guía para visitar un lugar' },
  { ruta: RutasWeb.contrato, nombre: 'Entiende tu contrato' },
  { ruta: RutasWeb.acuerdos, nombre: 'Acuerdos de convivencia' },
  { ruta: RutasWeb.presupuesto, nombre: '¿Qué alcanza con tu presupuesto?' },
] as const;

/** El pie de la web pública, sobre carbón: quién es Cuervo 360 y los dos documentos que explican cómo se tratan los datos. */
export function PieWeb() {
  return (
    <View style={estilos.pie}>
      <View style={estilos.interior}>
      <View style={estilos.fila}>
        <View style={estilos.marca}>
          <View style={estilos.logoYNombre}>
            <LogoMarca tamano={40} />
            <ThemedText style={[Texto.subtitulo, { color: D.text }]}>Cuervo 360</ThemedText>
          </View>
          <ThemedText style={[Texto.cuerpo, estilos.frase, { color: D.textSecondary }]}>Departamentos, roomies y servicios cerca de tu universidad.</ThemedText>
        </View>
        <View style={estilos.columna}>
          <ThemedText style={[Texto.pequenoFuerte, { color: D.lima }]}>Ayuda</ThemedText>
          {AYUDA.map((a) => (
            <Pulsable key={a.ruta} onPress={() => router.push(a.ruta as never)} accessibilityRole="link" accessibilityLabel={a.nombre} style={estilos.enlace}>
              <ThemedText style={[Texto.cuerpo, { color: D.text }]}>{a.nombre}</ThemedText>
            </Pulsable>
          ))}
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
    </View>
  );
}

const estilos = StyleSheet.create({
  // De borde a borde, como el hero: el fondo ocupa todo el ancho y el contenido se centra dentro.
  pie: { width: '100%', backgroundColor: D.background, borderTopLeftRadius: Radios.panel, borderTopRightRadius: Radios.panel },
  interior: { width: '100%', maxWidth: AnchoMaximoWeb, alignSelf: 'center', padding: Spacing.five, gap: Spacing.four },
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.five },
  marca: { gap: Spacing.three, maxWidth: 360 },
  logoYNombre: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  frase: { maxWidth: 300 },
  columna: { gap: Spacing.one },
  enlace: { minHeight: 44, justifyContent: 'center' },
  linea: { borderTopWidth: Filete.fino, borderTopColor: D.backgroundSelected, paddingTop: Spacing.three },
});
