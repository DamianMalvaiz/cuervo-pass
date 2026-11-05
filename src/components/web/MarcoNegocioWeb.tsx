import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { VistaPreviaNegocio } from '@/components/FormularioNegocio';
import { MarcoSesionWeb } from '@/components/web/MarcoSesionWeb';
import { VistaPreviaNegocioWeb } from '@/components/web/VistaPreviaNegocioWeb';
import { Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';

/**
 * El marco de web de las pantallas del formulario de negocio (publicar y editar): el encabezado de la web y, en ventanas de 1000 px o más, la vista previa de la tarjeta al lado del formulario. El formulario recibe `alVistaPrevia`
 * para contarle lo que se va escribiendo. En una ventana angosta se omite la previa (el formulario es lo que importa) y `alVistaPrevia` es `undefined`.
 */
export function MarcoNegocioWeb({ children }: { children: (alVistaPrevia: ((v: VistaPreviaNegocio) => void) | undefined) => ReactNode }) {
  const { ancho } = useTamanoPantalla();
  const [previa, setPrevia] = useState<VistaPreviaNegocio | null>(null);
  const conPrevia = ancho >= 1000;
  return (
    <MarcoSesionWeb>
      <View style={[estilos.fila, conPrevia && estilos.enFila]}>
        <View style={estilos.formulario}>{children(conPrevia ? setPrevia : undefined)}</View>
        {conPrevia ? (
          <View style={estilos.previa}>
            <VistaPreviaNegocioWeb v={previa} />
          </View>
        ) : null}
      </View>
    </MarcoSesionWeb>
  );
}

const estilos = StyleSheet.create({
  fila: { flex: 1 },
  enFila: { flexDirection: 'row' },
  formulario: { flex: 1 },
  previa: { width: 320, padding: Spacing.four, paddingTop: Spacing.five },
});
