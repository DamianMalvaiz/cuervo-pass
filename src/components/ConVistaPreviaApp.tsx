import { useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Spacing, Texto } from '@/constants/theme';
import { useMargenSuperior } from '@/hooks/use-margen-superior';
import { useTheme } from '@/hooks/use-theme';

/**
 * La vista previa de lo que se está publicando, EN LA APP. En la web va al lado del formulario; en el teléfono no hay lugar al lado, así que el formulario se queda a pantalla completa y una barra fija arriba ofrece «Ver cómo se verá», que abre la
 * misma vista previa en una hoja.
 *
 * El formulario cuenta lo que se va escribiendo con `alVistaPrevia` (un `setState`, estable, como en el marco de la web); la hoja se pinta con lo último. Es una vista aproximada y su propio texto lo dice.
 */
export function ConVistaPreviaApp<T>({
  boton,
  titulo,
  vista,
  children,
}: {
  /** Lo que dice el botón de la barra («Ver cómo se verá»). */
  boton: string;
  /** El título de la hoja. */
  titulo: string;
  /** La vista previa que se pinta en la hoja: la que ya usa la web. */
  vista: (v: T | null) => ReactNode;
  children: (alVistaPrevia: (v: T) => void) => ReactNode;
}) {
  const theme = useTheme();
  const margen = useMargenSuperior();
  const [ultima, alVistaPrevia] = useState<T | null>(null);
  const [abierta, setAbierta] = useState(false);

  return (
    <ThemedView style={estilos.raiz}>
      <View style={[estilos.barra, { borderBottomColor: theme.filete }]}>
        <Sello
          variante="contorno"
          icono="eye-outline"
          onPress={() => setAbierta(true)}
          accessibilityLabel={boton}
        >
          {boton}
        </Sello>
      </View>
      <View style={estilos.formulario}>{children(alVistaPrevia)}</View>
      <Modal visible={abierta} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAbierta(false)}>
        <ThemedView style={[estilos.hoja, { paddingTop: Math.max(margen, Spacing.three) }]}>
          <View style={estilos.cabeceraHoja}>
            <ThemedText accessibilityRole="header" style={[Texto.titulo, estilos.tituloHoja]}>{titulo}</ThemedText>
            <Pulsable onPress={() => setAbierta(false)} accessibilityRole="button" accessibilityLabel="Cerrar la vista previa" style={estilos.cerrar}>
              <ThemedText style={Texto.pequenoFuerte}>Cerrar</ThemedText>
            </Pulsable>
          </View>
          <ScrollView contentContainerStyle={estilos.contenidoHoja} showsVerticalScrollIndicator={false}>
            {vista(ultima)}
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  barra: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: Filete.fino },
  formulario: { flex: 1 },
  hoja: { flex: 1 },
  cabeceraHoja: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  tituloHoja: { flex: 1, minWidth: 0 },
  cerrar: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  contenidoHoja: { padding: Spacing.three, paddingBottom: Spacing.six },
});
