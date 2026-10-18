import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TipoPublicacion } from '@/types/database.types';

/**
 * Qué clase de sitio es, legible de un vistazo · Cuervo 360.
 *
 * Una píldora limpia sobre la fotografía, en la esquina inferior izquierda, con un icono y la palabra. Hasta
 * el 17/10/2026 los tres tipos se distinguían con tres BORDES (continuo, de guiones y de puntos), un recurso
 * del sistema de «documento oficial» que, visto en un iPhone real, se veía mal.
 *
 * EL ICONO Y LA PALABRA, los dos. El icono sirve para recorrer la lista con la vista y notar que algo cambia;
 * la palabra, para saber qué. Si estuviera solo el icono sería una clave sin leyenda; si estuviera solo la
 * palabra habría que leer treinta veces para comparar. Nada depende del color.
 */

/** Exportado para que la prueba pueda comprobar que los tres tipos usan tres iconos DISTINTOS. Sin eso,
 *  mapear dos tipos al mismo icono —por descuido o por «simplificar»— dejaría el código sin codificar nada y
 *  no fallaría nada. */
export const ICONO_DE: Record<TipoPublicacion, keyof typeof Ionicons.glyphMap> = {
  depa: 'business-outline',
  cuarto: 'bed-outline',
  casa_compartida: 'people-outline',
};

// «Casa» y no «Casa compartida»: la fila tiene una foto de 96 y la píldora no puede pasar de su ancho.
const PALABRA_DE: Record<TipoPublicacion, string> = {
  depa: 'Depa',
  cuarto: 'Cuarto',
  casa_compartida: 'Casa',
};

export function SelloTipo({ tipo }: { tipo: TipoPublicacion }) {
  const theme = useTheme();
  const icono = ICONO_DE[tipo] ?? 'home-outline';
  const palabra = PALABRA_DE[tipo] ?? String(tipo);

  return (
    <View
      // Fondo OPACO y no translúcido: esto va encima de una fotografía cualquiera, y sobre una foto clara un
      // texto a media opacidad deja de leerse. El par background/text ya está medido por el verificador de
      // contraste; con transparencia dejaría de estarlo.
      style={[estilos.pildora, { backgroundColor: theme.background }]}
      // El tipo ya viaja en la etiqueta accesible de la fila entera, así que aquí sobra: un lector de
      // pantalla que anuncie «Cuarto» y acto seguido «Cuarto amplio… tipo cuarto» repite lo mismo dos veces.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icono} size={14} color={theme.text} />
      <ThemedText type="small" numberOfLines={1} style={Texto.pesoFuerte}>
        {palabra}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radios.full,
  },
});
