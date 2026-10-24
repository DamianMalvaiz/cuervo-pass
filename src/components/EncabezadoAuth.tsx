import { StyleSheet, View } from 'react-native';

import { LogoMarca } from '@/components/LogoMarca';
import { Entrada, FileteQueSeTraza } from '@/components/ficha/EntradaAuth';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Texto, escalarTexto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';

/**
 * El membrete de las pantallas de acceso: el mismo en login, registro y recuperar contraseña, para que se lean como una sola
 * familia. Centrado: logo, etiqueta, título y un filete que se traza al entrar.
 *
 * En pantallas de poco alto el logo y el subtítulo se recortan primero (lo prescindible antes que lo esencial).
 */
export function EncabezadoAuth({
  etiqueta,
  titulo,
  subtitulo,
  tamanoLogo = 96,
}: {
  etiqueta: string;
  titulo: string;
  subtitulo?: string;
  tamanoLogo?: number;
}) {
  const { altoApretado, escalaTitulo } = useTamanoPantalla();

  return (
    <View style={estilos.membrete}>
      <Entrada orden={0} style={estilos.centrado}>
        {!altoApretado && <LogoMarca tamano={tamanoLogo} centrado />}
        <ThemedText type="etiqueta" themeColor="textSecondary" style={estilos.texto}>
          {etiqueta}
        </ThemedText>
        <ThemedText type="title" style={[estilos.texto, escalarTexto(Texto.tituloHoja, escalaTitulo)]}>
          {titulo}
        </ThemedText>
        {!!subtitulo && !altoApretado && (
          <ThemedText type="small" themeColor="textSecondary" style={estilos.texto}>
            {subtitulo}
          </ThemedText>
        )}
      </Entrada>
      <FileteQueSeTraza />
    </View>
  );
}

const estilos = StyleSheet.create({
  membrete: { gap: Spacing.three, marginBottom: Spacing.two },
  centrado: { alignItems: 'center', gap: Spacing.one },
  texto: { textAlign: 'center' },
});
