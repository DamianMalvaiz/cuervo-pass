import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Spacing, Tramas, type NombreTrama } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TipoPublicacion } from '@/types/database.types';

/**
 * D.11 · Qué clase de sitio es, legible de un vistazo.
 *
 * Hasta aquí el tipo de publicación NO APARECÍA en la lista: solo en la ficha de
 * detalle. Con los chips de B.3 se podía filtrar por algo que la lista nunca
 * decía, y con «Todo» seleccionado no había forma de distinguir un cuarto de una
 * casa compartida.
 *
 * Se estampa sobre la fotografía, en la esquina inferior izquierda, como el sello
 * de un archivo sobre una foto pegada a un expediente. Ahí no compite con las
 * columnas de cifras ni roba un renglón al título.
 *
 * LA PALABRA Y LA TRAMA, las dos. La trama —continua, guiones, puntos— es para
 * recorrer la lista con la vista y notar que algo cambia. La palabra es para
 * saber qué. Si estuviera solo la trama sería una clave sin leyenda; si estuviera
 * solo la palabra habría que leer treinta veces para comparar.
 */

/** Exportado para que la prueba pueda comprobar que los tres tipos usan tres
 *  tramas DISTINTAS. Sin eso, mapear dos tipos a la misma trama —por descuido o
 *  por «simplificar»— dejaría el código sin codificar nada y no fallaría nada. */
export const TRAMA_DE: Record<TipoPublicacion, NombreTrama> = {
  // Continua para el caso más común: lo frecuente es el fondo sobre el que se
  // notan los otros dos. Tramar lo que abunda haría que la lista entera pareciera
  // marcada y ninguna marca destacaría.
  depa: 'solido',
  cuarto: 'rayado',
  casa_compartida: 'punteado',
};

const PALABRA_DE: Record<TipoPublicacion, string> = {
  depa: 'DEPA',
  cuarto: 'CUARTO',
  casa_compartida: 'CASA',
};

export function SelloTipo({ tipo }: { tipo: TipoPublicacion }) {
  const theme = useTheme();
  const trama = TRAMA_DE[tipo] ?? 'solido';
  const palabra = PALABRA_DE[tipo] ?? String(tipo).toUpperCase();

  return (
    <View
      style={[
        estilos.sello,
        Tramas[trama],
        // Fondo OPACO y no translúcido: esto se estampa encima de una fotografía
        // cualquiera, y sobre una foto clara un texto a media opacidad deja de
        // leerse. El par background/text ya está medido por el verificador de
        // contraste; con transparencia dejaría de estarlo.
        { backgroundColor: theme.background, borderColor: theme.text },
      ]}
      // El tipo ya viaja en la etiqueta accesible de la fila entera, así que
      // aquí sobra: un lector de pantalla que anuncie «CUARTO» y acto seguido
      // «Cuarto amplio… tipo cuarto» repite lo mismo dos veces.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ThemedText type="etiqueta" numberOfLines={1}>
        {palabra}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  // SIN `borderRadius`. En Android, `borderStyle` de guiones y puntos se degrada
  // a línea continua en cuanto hay radio, y las tres tramas se volverían una.
  sello: {
    borderWidth: Filete.grueso,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
  },
});
