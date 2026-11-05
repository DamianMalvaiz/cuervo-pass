import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Bloque, Seccion } from '@/lib/avisoPrivacidad';

/**
 * Un documento legal en pantalla · Cuervo 360 (aviso de privacidad y términos).
 *
 * Arriba, la fecha y una caja «Lo esencial» con lo que la mayoría necesita saber; debajo, cada sección plegada: se abre al tocar su título. El
 * texto completo sigue ahí, solo que no es un muro. Interpreta **negritas** y nada más (ver avisoPrivacidad.ts).
 */

function TextoConNegritas({ texto, tipo = 'default' }: { texto: string; tipo?: 'default' | 'small' }) {
  // Los índices impares del split son lo que iba entre pares de `**`.
  return (
    <ThemedText type={tipo}>
      {texto.split('**').map((parte, i) =>
        i % 2 === 1 ? (
          <ThemedText key={i} type={tipo} style={estilos.negrita}>
            {parte}
          </ThemedText>
        ) : (
          <Fragment key={i}>{parte}</Fragment>
        ),
      )}
    </ThemedText>
  );
}

function BloqueLegal({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case 'parrafo':
      return (
        <View style={estilos.bloque}>
          <TextoConNegritas texto={bloque.texto} />
        </View>
      );
    case 'subtitulo':
      return (
        <ThemedText type="smallBold" style={estilos.subtitulo}>
          {bloque.texto}
        </ThemedText>
      );
    case 'lista':
      return (
        <View style={estilos.bloque}>
          {bloque.puntos.map((punto, i) => (
            <View key={i} style={estilos.punto}>
              <ThemedText style={estilos.vineta} themeColor="textSecondary">
                •
              </ThemedText>
              <View style={estilos.puntoTexto}>
                <TextoConNegritas texto={punto} />
              </View>
            </View>
          ))}
        </View>
      );
    case 'filas':
      return (
        <View style={estilos.bloque}>
          {bloque.filas.map((fila, i) => (
            <ThemedView key={i} type="backgroundElement" style={estilos.fila}>
              <ThemedText type="smallBold" style={estilos.filaTitulo}>
                {fila.titulo}
              </ThemedText>
              <TextoConNegritas texto={fila.detalle} tipo="small" />
            </ThemedView>
          ))}
        </View>
      );
    case 'enlace':
      return (
        <Pulsable
          style={[estilos.bloque, estilos.enlace]}
          onPress={() => Linking.openURL(bloque.url)}
          accessibilityRole="link"
          accessibilityLabel={bloque.texto}>
          <ThemedText type="linkPrimary">{bloque.texto}</ThemedText>
        </Pulsable>
      );
  }
}

function SeccionPlegable({ seccion }: { seccion: Seccion }) {
  const theme = useTheme();
  const [abierta, setAbierta] = useState(false);
  return (
    <View style={[estilos.seccion, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
      <Pulsable
        onPress={() => setAbierta((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`${seccion.numero}. ${seccion.titulo}`}
        style={estilos.cabecera}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={estilos.numero}>
          {seccion.numero}
        </ThemedText>
        <ThemedText type="smallBold" style={estilos.tituloSeccion}>
          {seccion.titulo}
        </ThemedText>
        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pulsable>
      {abierta ? (
        <View style={estilos.cuerpo}>
          {seccion.bloques.map((bloque, i) => (
            <BloqueLegal key={i} bloque={bloque} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function DocumentoLegal({
  actualizacion,
  intro,
  esencial,
  secciones,
}: {
  actualizacion: string;
  intro: string;
  esencial: string[];
  secciones: Seccion[];
}) {
  const theme = useTheme();
  return (
    <ThemedView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <ThemedText type="small" themeColor="textSecondary" style={estilos.fecha}>
          {actualizacion}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={estilos.intro}>
          {intro}
        </ThemedText>

        <View style={[estilos.esencial, { borderColor: theme.tintedBorder, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="etiqueta" themeColor="textSecondary">
            LO ESENCIAL
          </ThemedText>
          {esencial.map((punto, i) => (
            <View key={i} style={estilos.punto}>
              <Ionicons name="checkmark" size={18} color={theme.bosque} style={estilos.palomita} />
              <View style={estilos.puntoTexto}>
                <TextoConNegritas texto={punto} />
              </View>
            </View>
          ))}
        </View>

        <ThemedText type="smallBold" themeColor="textSecondary" style={estilos.titulo}>
          El texto completo
        </ThemedText>
        {secciones.map((s) => (
          <SeccionPlegable key={s.numero} seccion={s} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.three },
  fecha: { ...Texto.pesoFuerte },
  intro: {},
  esencial: { borderWidth: Filete.fino, borderRadius: Radios.hoja, padding: Spacing.three, gap: Spacing.two },
  titulo: { marginTop: Spacing.two },
  seccion: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  cabecera: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three },
  numero: { width: Spacing.four },
  tituloSeccion: { flex: 1 },
  cuerpo: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  bloque: { marginBottom: Spacing.three },
  subtitulo: { marginTop: Spacing.two, marginBottom: Spacing.two },
  negrita: { ...Texto.pesoNegrita },
  punto: { flexDirection: 'row', marginBottom: Spacing.one },
  vineta: { width: Spacing.three, lineHeight: 24 },
  palomita: { width: Spacing.four, marginTop: 3 },
  puntoTexto: { flex: 1 },
  fila: { padding: Spacing.three, borderRadius: Spacing.two, marginBottom: Spacing.two },
  filaTitulo: { marginBottom: Spacing.one },
  enlace: { minHeight: 44, justifyContent: 'center' },
});
