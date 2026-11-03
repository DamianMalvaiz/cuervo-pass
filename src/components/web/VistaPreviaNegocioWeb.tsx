import { StyleSheet, View } from 'react-native';

import type { VistaPreviaNegocio } from '@/components/FormularioNegocio';
import { ThemedText } from '@/components/themed-text';
import { TarjetaNegocioWeb } from '@/components/web/TarjetaNegocioWeb';
import { Spacing, Texto } from '@/constants/theme';
import { zonaAproximadaDe } from '@/lib/zona';
import type { NegocioExplorar } from '@/services/explorar.service';

/**
 * La vista previa de un negocio mientras se escribe: la MISMA tarjeta que verán los estudiantes en Servicios, con el nombre, la zona y la portada elegidos. Es aproximada y lo dice: la zona sale de la dirección sin su primer tramo (la calle y
 * el número no se enseñan a quien solo explora) y no se inventa lo que no se sabe: «Abierto ahora» solo existe con horario y no se adivina aquí, la calificación aparece cuando alguien reseñe.
 */
export function VistaPreviaNegocioWeb({ v }: { v: VistaPreviaNegocio | null }) {
  const nombre = v?.nombre.trim() ?? '';
  const n = {
    id: 'vista-previa',
    categoria_id: '',
    nombre: nombre || 'Tu negocio',
    descripcion: null,
    zona: zonaAproximadaDe(v?.direccion),
    latitud_aprox: null,
    longitud_aprox: null,
    horario: null,
    num_fotos: 0,
    destacado: false,
    calificacion: null,
    num_resenas: null,
    abierto_ahora: null,
    creado_en: '',
  } as NegocioExplorar;
  return (
    <View style={estilos.caja} accessibilityLabel="Vista previa de tu negocio">
      <ThemedText accessibilityRole="header" style={Texto.titulo}>Así se verá en Servicios</ThemedText>
      <TarjetaNegocioWeb n={n} ancho={240} previa={{ fotoUri: v?.fotoUri }} />
      <ThemedText style={Texto.pequeno} themeColor="textSecondary">
        Es una vista aproximada. De la dirección solo se enseña la zona (sin la calle ni el número), y «Abierto ahora» aparece según el horario que definas.
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { gap: Spacing.three },
});
