import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { SelloTipo } from '@/components/ficha/SelloTipo';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TipoPublicacion } from '@/types/database.types';

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

/** En frase, no en versalitas: un lector de pantalla deletrea «DEPA» como
 *  «D-E-P-A» si lo recibe en mayúsculas sostenidas. */
const PALABRA_ACCESIBLE: Record<TipoPublicacion, string> = {
  depa: 'Departamento',
  cuarto: 'Cuarto',
  casa_compartida: 'Casa compartida',
};

export function FilaPublicacion({
  titulo,
  tipo,
  precio,
  fotoUrl,
  distanciaKm,
  score,
  similitud,
  onPress,
}: {
  titulo: string;
  /** D.11 · El tipo no aparecía en la lista, solo en la ficha. Con los chips de
   *  B.3 se podía filtrar por algo que la lista nunca decía. */
  tipo?: TipoPublicacion;
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
    <Pulsable
      onPress={onPress}
      style={[estilos.fila, { borderColor: theme.filete, backgroundColor: theme.background }]}
      accessibilityRole="button"
      // El tipo va PRIMERO en la etiqueta: quien recorre la lista con un lector
      // de pantalla lo necesita para decidir si le interesa, igual que quien la
      // recorre con la vista lo ve en el sello. La trama no se anuncia: es el
      // mismo dato, dicho para otro sentido.
      accessibilityLabel={
        `${tipo ? PALABRA_ACCESIBLE[tipo] + '. ' : ''}${titulo}. ` +
        `Ajuste ${ajuste} de 10, renta ${renta}, distancia ${distancia}.`
      }
    >
      <View>
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
        {/* Estampado sobre la foto, como el sello de un archivo sobre una
            fotografía pegada a un expediente. Ahí no compite con las columnas
            de cifras ni le roba un renglón al título. */}
        {tipo && (
          <View style={estilos.selloTipo}>
            <SelloTipo tipo={tipo} />
          </View>
        )}
      </View>

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
    </Pulsable>
  );
}

function Columna({ etiqueta, valor, atenuado = false }: { etiqueta: string; valor: string; atenuado?: boolean }) {
  return (
    <View style={estilos.columna}>
      <ThemedText
        type="etiqueta"
        themeColor="textSecondary"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
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
  foto: {
    width: 96,
    height: 96,
    borderRadius: Radios.casilla,
    borderWidth: Filete.fino,
  },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  // Al ras de la esquina inferior izquierda de la foto, como un sello puesto
  // sobre el papel y no junto a él.
  selloTipo: { position: 'absolute', left: 4, bottom: 4 },
  derecha: { flex: 1, justifyContent: 'space-between', minHeight: 96, gap: Spacing.half },
  titulo: { lineHeight: 18 },
  columnas: { flexDirection: 'row', gap: Spacing.one },
  // `flex: 1` con base 0, no un ancho fijo. Los 86 pt de antes sumaban 274 con los
  // huecos y se salían de una pantalla de 360 pt (visto en un teléfono real). Con
  // base 0 las tres columnas se reparten el MISMO ancho en todas las filas, así que
  // las cifras siguen cayendo una debajo de otra: lo que rompía la alineación era
  // un `flex` que creciera con el contenido, y con base 0 el contenido no cuenta.
  columna: { flex: 1, minWidth: 0, gap: 1 },
  cifra: { ...Texto.cifra },
});
