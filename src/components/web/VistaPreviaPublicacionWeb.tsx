import { StyleSheet, View } from 'react-native';

import type { VistaPreviaPublicacion } from '@/components/FormularioPublicacion';
import { ThemedText } from '@/components/themed-text';
import { TarjetaPublicacionWeb } from '@/components/web/TarjetaPublicacionWeb';
import { Spacing, Texto } from '@/constants/theme';
import type { PublicacionExplorar } from '@/services/explorar.service';

const NOMBRE_TIPO: Record<string, string> = { depa: 'Departamento', cuarto: 'Cuarto', casa_compartida: 'Casa compartida' };

/** El título público como lo arma la base (0092): el tipo y la colonia, sin texto libre. Sin colonia todavía, solo el tipo. */
export function tituloPublicoDe(v: Pick<VistaPreviaPublicacion, 'tipo' | 'colonia'>): string {
  const colonia = v.colonia.trim();
  return `${NOMBRE_TIPO[v.tipo] ?? v.tipo}${colonia ? ` en ${colonia}` : ''}`;
}

/**
 * La vista previa de una publicación mientras se escribe: la MISMA tarjeta que verán los estudiantes en la lista, con lo que va escrito y la primera foto elegida. Es aproximada y lo dice: el título público lo arma Cuervo 360 con el
 * tipo y la colonia (no con el título que escribes), la dirección exacta nunca se enseña y no se inventa lo que falta (sin precio dice «Falta el precio»; la calificación y «Destacado» no existen hasta que alguien reseñe o haya un plan).
 */
export function VistaPreviaPublicacionWeb({ v }: { v: VistaPreviaPublicacion | null }) {
  const colonia = v?.colonia.trim() ?? '';
  const municipio = v?.municipio.trim() ?? '';
  const recamaras = Number(v?.recamaras);
  const p = {
    id: 'vista-previa',
    titulo_publico: v ? tituloPublicoDe(v) : 'Tu publicación',
    tipo: v?.tipo ?? 'depa',
    precio_renta: Number(v?.precioRenta) || 0,
    recamaras: Number.isInteger(recamaras) && recamaras > 0 ? recamaras : null,
    amueblado: v?.amueblado ? true : null,
    permite_mascotas: null,
    servicios_incluidos: null,
    zona: [colonia, municipio].filter(Boolean).join(', ') || null,
    latitud_aprox: null,
    longitud_aprox: null,
    num_fotos: 0,
    destacado: false,
    calificacion: null,
    num_resenas: null,
    creado_en: '',
  } as PublicacionExplorar;

  return (
    <View style={estilos.caja} accessibilityLabel="Vista previa de tu publicación">
      <ThemedText accessibilityRole="header" style={Texto.titulo}>Así se verá en la lista</ThemedText>
      <TarjetaPublicacionWeb p={p} ancho={300} previa={{ fotoUri: v?.fotoUri }} />
      <ThemedText style={Texto.pequeno} themeColor="textSecondary">
        Es una vista aproximada. El título lo arma Cuervo 360 con el tipo y la colonia, y la dirección exacta no se enseña a quien solo explora.
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { gap: Spacing.three },
});
