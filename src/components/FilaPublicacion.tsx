import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Un renglón de tabla, no una tarjeta · END-33
 *
 * `FichaPublicacion` mide 420–450 px: **una tarjeta y media por pantalla**. Y
 * PRODUCT.md dice: «Airbnb ordena por deseo […] esto ordena por AJUSTE».
 *
 * El ajuste se evalúa COMPARANDO, y comparar exige ver varias opciones a la
 * vez. Una tarjeta y media por pantalla es la densidad de un catálogo de deseo
 * —donde cada objeto quiere tu atención entera— y no la de una tabla de
 * decisión. La forma contradecía la tesis del producto.
 *
 * Tres decisiones que hacen que esto sea una tabla y no una lista bonita:
 *
 *   · **Columnas de ancho FIJO.** Si la columna de renta se ensancha con el
 *     número, las cifras dejan de alinearse verticalmente y el ojo tiene que
 *     buscar cada una. Un ancho fijo las pone una debajo de otra.
 *   · **`tabular-nums`**, que ya viene en los tokens de cifra. Sin él, "1" y
 *     "8" ocupan anchos distintos y la columna se tambalea aunque el contenedor
 *     no lo haga.
 *   · **Las etiquetas se repiten en cada fila.** Un encabezado de tabla único
 *     arriba se pierde al desplazar, y entonces hay que recordar qué columna
 *     era cuál. En un documento impreso cada renglón se lee solo.
 *
 * `FichaPublicacion` se conserva para «Mis publicaciones», donde no se compara
 * nada: ahí la pregunta es «cómo va la mía», no «cuál de estas».
 */

/**
 * Alto MÍNIMO del renglón. Es un piso, no una medida fija: con el escalado de
 * texto del sistema activado la fila crece, y eso es correcto (END-34).
 */
export const ALTO_FILA = 132;

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export function FilaPublicacion({
  titulo,
  precio,
  fotoUrl,
  distanciaKm,
  score,
  similitud,
  onPress,
}: {
  titulo: string;
  precio: number;
  fotoUrl?: string | null;
  distanciaKm?: number | null;
  score?: number | null;
  /** Afinidad semántica en [0,1]. Null cuando esta fila es de Nivel 1 (END-08). */
  similitud?: number | null;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const hayScore = typeof score === 'number' && Number.isFinite(score);
  // Medios puntos, la misma regla que END-30 fijó para toda la app: el cálculo
  // no tiene una décima de resolución y presentarla la inventaría.
  const ajuste = hayScore ? (Math.round(Math.min(10, Math.max(0, score * 10)) * 2) / 2).toFixed(1) : '—';
  const renta = `$${formateadorPrecio.format(precio)}`;
  const distancia = distanciaKm != null && Number.isFinite(distanciaKm) ? `${distanciaKm.toFixed(1)} km` : '—';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        estilos.fila,
        { borderColor: theme.filete, backgroundColor: theme.background },
        pressed && estilos.presionada,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. Ajuste ${ajuste} de 10, renta ${renta}, distancia ${distancia}.`}
    >
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={[estilos.foto, { borderColor: theme.filete }]} contentFit="cover" transition={160} />
      ) : (
        <View
          style={[estilos.foto, estilos.sinFoto, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          accessibilityLabel="Sin fotografía"
        >
          <Ionicons name="image-outline" size={20} color={theme.textSecondary} />
        </View>
      )}

      <View style={estilos.derecha}>
        <ThemedText type="small" numberOfLines={2} style={estilos.titulo}>
          {titulo}
        </ThemedText>

        {/* END-30 · La afinidad NO va en una columna: no todas las filas la
            tienen, y una columna medio vacía se lee como un dato perdido en vez
            de como un dato ausente. Va como nota bajo las cifras, y cuando no
            hay simplemente no está — que es lo mismo que hace `PorQue` en la
            ficha grande. La distancia y la renta no se repiten aquí: ya son
            columnas. */}
        <View style={estilos.columnas}>
          <Columna etiqueta="AJUSTE" valor={ajuste} atenuado={!hayScore} />
          <Columna etiqueta="RENTA" valor={renta} />
          <Columna etiqueta="DISTANCIA" valor={distancia} atenuado={distancia === '—'} />
        </View>

        {similitud != null && Number.isFinite(similitud) && (
          <ThemedText type="folio" themeColor="textSecondary" numberOfLines={1}>
            afinidad {similitud.toFixed(2)}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

function Columna({ etiqueta, valor, atenuado = false }: { etiqueta: string; valor: string; atenuado?: boolean }) {
  return (
    <View style={estilos.columna}>
      <ThemedText type="etiqueta" themeColor="textSecondary" numberOfLines={1}>
        {etiqueta}
      </ThemedText>
      <ThemedText
        style={estilos.cifra}
        themeColor={atenuado ? 'textSecondary' : 'text'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    // END-34 · `minHeight` y no `height`. Con una altura FIJA, el título
    // recortaba en cuanto el sistema escalaba el texto: la fila seguía midiendo
    // 132 px y el contenido no cabía. Con un piso, la tabla mantiene su ritmo
    // en el caso normal y CEDE cuando alguien necesita letra más grande —que es
    // el orden correcto de prioridades, aunque cueste la alineación perfecta.
    minHeight: ALTO_FILA,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: Filete.fino,
    alignItems: 'center',
  },
  presionada: { opacity: 0.7 },
  foto: {
    width: 96,
    height: 96,
    borderRadius: Radios.casilla,
    borderWidth: Filete.fino,
  },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  derecha: { flex: 1, justifyContent: 'space-between', minHeight: 96, gap: Spacing.half },
  titulo: { lineHeight: 18 },
  columnas: { flexDirection: 'row', gap: Spacing.two },
  // Ancho FIJO, no `flex`. Con flex, la columna se ensancha con su contenido y
  // las cifras de filas distintas dejan de caer una debajo de otra — que es
  // exactamente lo que esta pantalla existe para permitir.
  columna: { width: 86, gap: 1 },
  cifra: { ...Texto.cifra },
});
