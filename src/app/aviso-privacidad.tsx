import { Fragment } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Tipografia } from '@/constants/theme';
import { AVISO_ACTUALIZACION, AVISO_INTRO, SECCIONES, type Bloque } from '@/lib/avisoPrivacidad';

// Documento maestro v5 · §29 — el aviso, dentro de la app.
//
// Antes esto era un Linking.openURL a GitHub desde la pantalla de registro. Dos
// fallas: el repositorio es privado (404 para cualquiera que no sea el autor) y,
// aun siendo público, depender de la red para LEER lo que se está aceptando
// significa que sin señal el consentimiento se da a ciegas. Aquí el texto viaja
// dentro del bundle y se lee siempre.

/** Interpreta **negritas** al estilo markdown. Nada más: ver el comentario de
 *  avisoPrivacidad.ts sobre por qué el formato es deliberadamente mínimo. */
function TextoConNegritas({ texto, tipo = 'default' }: { texto: string; tipo?: 'default' | 'small' }) {
  // Los índices impares del split son lo que iba entre pares de `**`.
  const partes = texto.split('**');
  return (
    <ThemedText type={tipo}>
      {partes.map((parte, i) =>
        i % 2 === 1 ? (
          <ThemedText key={i} type={tipo} style={styles.negrita}>
            {parte}
          </ThemedText>
        ) : (
          <Fragment key={i}>{parte}</Fragment>
        )
      )}
    </ThemedText>
  );
}

function BloqueAviso({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case 'parrafo':
      return (
        <View style={styles.bloque}>
          <TextoConNegritas texto={bloque.texto} />
        </View>
      );

    // Los `###` del .md. Sin ellos, secciones como la 9 (tres bloques temáticos
    // distintos) se leen como un muro.
    case 'subtitulo':
      return (
        <ThemedText type="smallBold" style={styles.subtitulo}>
          {bloque.texto}
        </ThemedText>
      );

    case 'lista':
      return (
        <View style={styles.bloque}>
          {bloque.puntos.map((punto, i) => (
            <View key={i} style={styles.punto}>
              <ThemedText style={styles.vineta} themeColor="textSecondary">
                •
              </ThemedText>
              <View style={styles.puntoTexto}>
                <TextoConNegritas texto={punto} />
              </View>
            </View>
          ))}
        </View>
      );

    // Una tabla del .md. En un teléfono se apila: encabezado y detalle, con un
    // filete lateral que agrupa visualmente la fila sin dibujar una rejilla.
    case 'filas':
      return (
        <View style={styles.bloque}>
          {bloque.filas.map((fila, i) => (
            <ThemedView key={i} type="backgroundElement" style={styles.fila}>
              <ThemedText type="smallBold" style={styles.filaTitulo}>
                {fila.titulo}
              </ThemedText>
              <TextoConNegritas texto={fila.detalle} tipo="small" />
            </ThemedView>
          ))}
        </View>
      );

    case 'enlace':
      return (
        <Pressable
          style={styles.bloque}
          onPress={() => Linking.openURL(bloque.url)}
          accessibilityRole="link"
          accessibilityLabel={bloque.texto}>
          {({ pressed }) => (
            <ThemedText type="linkPrimary" style={pressed && styles.presionado}>
              {bloque.texto}
            </ThemedText>
          )}
        </Pressable>
      );
  }
}

export default function AvisoPrivacidadScreen() {
  return (
    <ThemedView style={styles.pantalla}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.fecha}>
          {AVISO_ACTUALIZACION}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {AVISO_INTRO}
        </ThemedText>

        {SECCIONES.map((seccion) => (
          <View key={seccion.numero} style={styles.seccion}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.numero}>
              {seccion.numero}
            </ThemedText>
            <ThemedText style={styles.tituloSeccion}>{seccion.titulo}</ThemedText>
            {seccion.bloques.map((bloque, i) => (
              <BloqueAviso key={i} bloque={bloque} />
            ))}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Spacing.four, paddingBottom: Spacing.six },
  fecha: { marginBottom: Spacing.two, fontFamily: Tipografia.semibold },
  intro: { marginBottom: Spacing.five },
  subtitulo: { marginTop: Spacing.two, marginBottom: Spacing.two },
  seccion: { marginBottom: Spacing.five },
  // El número como dato pequeño encima del título, en vez de "1." pegado al
  // texto: deja el título como la línea que el ojo encuentra al hojear.
  numero: { marginBottom: Spacing.half },
  tituloSeccion: { fontSize: 22, lineHeight: 28, fontFamily: Tipografia.semibold, marginBottom: Spacing.three },
  bloque: { marginBottom: Spacing.three },
  negrita: { fontFamily: Tipografia.bold },
  punto: { flexDirection: 'row', marginBottom: Spacing.two },
  vineta: { width: Spacing.three, lineHeight: 24 },
  puntoTexto: { flex: 1 },
  fila: { padding: Spacing.three, borderRadius: Spacing.two, marginBottom: Spacing.two },
  filaTitulo: { marginBottom: Spacing.one },
  presionado: { opacity: 0.6 },
});
