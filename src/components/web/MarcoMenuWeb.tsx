import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { VistaPreviaMenu } from '@/components/EditorMenu';
import { VistaPreviaMenuWeb } from '@/components/web/VistaPreviaMenuWeb';
import { Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';

/**
 * El marco de web del editor de menú: el editor en una columna de ancho razonable (en una ventana de escritorio la lista de productos se estiraba a todo lo ancho, con renglones de mil píxeles) y, en ventanas de 1000 px o más, la vista
 * previa del menú al lado. El editor recibe `alVistaPrevia` para contarle lo que se va editando; en una ventana angosta se omite la previa y es `undefined`.
 */
export function MarcoMenuWeb({ children }: { children: (alVistaPrevia: ((v: VistaPreviaMenu) => void) | undefined) => ReactNode }) {
  const { ancho } = useTamanoPantalla();
  const [previa, setPrevia] = useState<VistaPreviaMenu | null>(null);
  const conPrevia = ancho >= 1000;
  return (
    <View style={[estilos.fila, conPrevia && estilos.enFila]}>
      <View style={estilos.editor}>{children(conPrevia ? setPrevia : undefined)}</View>
      {conPrevia ? (
        <View style={estilos.previa}>
          <VistaPreviaMenuWeb v={previa} />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flex: 1, width: '100%', alignSelf: 'center' },
  enFila: { flexDirection: 'row', maxWidth: 1180 },
  editor: { flex: 1, minWidth: 0, maxWidth: 760, alignSelf: 'center', width: '100%' },
  previa: { width: 380, padding: Spacing.four, paddingTop: Spacing.five },
});
