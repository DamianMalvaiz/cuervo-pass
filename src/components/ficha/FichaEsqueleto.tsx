import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AltoFotoTarjeta, Filete, Radios, Spacing } from '@/constants/theme';
import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { useTheme } from '@/hooks/use-theme';

/**
 * END-38 · Catorce spinners, cero esqueletos.
 *
 * Un `ActivityIndicator` centrado dice «espera» y nada más. Peor: en `inicio`
 * era un `return` temprano que BORRABA la pantalla —encabezado, resumen de
 * filtros y chips incluidos—, así que al llegar los datos todo volvía a aparecer
 * y saltaba. Cargar no es motivo para quitar de la vista lo que ya estaba.
 *
 * Un esqueleto con la forma de la ficha hace tres cosas que el spinner no:
 * reserva el espacio exacto —así no hay salto—, dice CUÁNTAS filas vienen, y
 * enseña ya la estructura de lo que llega.
 *
 * Y las ETIQUETAS van de verdad, no como bloques grises. «AJUSTE», «RENTA» y
 * «DISTANCIA» no dependen de la respuesta: se saben antes de preguntar. Pintar
 * como incógnita algo que ya se sabe es hacer la espera más pobre de lo
 * necesario. Lo único que se pinta en gris es lo que de verdad falta: los
 * valores.
 */

const DURACION_PULSO = 900;
const OPACIDAD_MINIMA = 0.45;
const OPACIDAD_MAXIMA = 1;
/** Sin movimiento, un valor fijo a media luz: se lee como «pendiente» sin latir. */
const OPACIDAD_QUIETA = 0.6;

/** El pulso vive en la FILA y no en cada bloque: una fila entera respirando a la
 *  vez se lee como un objeto; doce bloques latiendo por su cuenta, como ruido.
 *  Además son seis animaciones en vez de cuarenta. */
function useEstiloPulso(indice: number) {
  const reducido = useMovimientoReducido();
  const opacidad = useSharedValue(OPACIDAD_QUIETA);

  useEffect(() => {
    // `null` es «todavía no sé». No se anima hasta saberlo: arrancar el pulso y
    // apagarlo un tick después le enseña un destello de movimiento justo a quien
    // pidió no verlo.
    if (reducido !== false) {
      opacidad.value = OPACIDAD_QUIETA;
      return;
    }
    opacidad.value = OPACIDAD_MINIMA;
    opacidad.value = withDelay(
      indice * 120,
      withRepeat(
        withTiming(OPACIDAD_MAXIMA, { duration: DURACION_PULSO, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [reducido, indice, opacidad]);

  return useAnimatedStyle(() => ({ opacity: opacidad.value }));
}

/** Un valor que todavía no llegó. */
export function BloqueEsqueleto({
  ancho,
  alto = 12,
  radio = Radios.casilla,
}: {
  ancho: number | `${number}%`;
  alto?: number;
  radio?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={{ width: ancho, height: alto, borderRadius: radio, backgroundColor: theme.backgroundElement }}
    />
  );
}

/** Espeja `FilaPublicacion` (la tarjeta): foto grande de esquinas redondeadas, un título y la línea de precio. */
export function FilaEsqueleto({ indice = 0 }: { indice?: number }) {
  const theme = useTheme();
  const pulso = useEstiloPulso(indice);

  return (
    <Animated.View
      style={[estilos.fila, pulso]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[estilos.foto, { backgroundColor: theme.backgroundElement }]} />
      <View style={estilos.titulo}>
        <BloqueEsqueleto ancho="70%" alto={14} />
        <BloqueEsqueleto ancho="45%" alto={12} />
      </View>
    </Animated.View>
  );
}

/** Espeja el renglón de `chats`: avatar de 44, nombre y último mensaje. */
export function RenglonEsqueleto({ indice = 0 }: { indice?: number }) {
  const theme = useTheme();
  const pulso = useEstiloPulso(indice);

  return (
    <Animated.View
      style={[estilos.renglon, pulso]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[estilos.avatar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]} />
      <View style={estilos.centro}>
        <BloqueEsqueleto ancho="56%" alto={12} />
        <BloqueEsqueleto ancho="86%" alto={11} />
      </View>
    </Animated.View>
  );
}

/** Espeja una hoja: `FichaPublicacion` y `TarjetaRoomie` comparten borde, radio
 *  y estructura. Las etiquetas llegan por parámetro porque son lo ÚNICO que
 *  cambia entre las dos, y son justo lo que no hay que inventar. */
export function HojaEsqueleto({
  indice = 0,
  conFoto = true,
  etiquetas,
}: {
  indice?: number;
  conFoto?: boolean;
  etiquetas: string[];
}) {
  const theme = useTheme();
  const pulso = useEstiloPulso(indice);

  return (
    <Animated.View
      style={[estilos.hoja, { borderColor: theme.filete, backgroundColor: theme.background }, pulso]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={estilos.tiraFolio}>
        <BloqueEsqueleto ancho={72} alto={10} />
        <BloqueEsqueleto ancho={48} alto={10} />
      </View>
      {conFoto && (
        <View style={[estilos.fotoHoja, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]} />
      )}
      <View style={estilos.cuerpo}>
        <BloqueEsqueleto ancho="78%" alto={16} />
        <View style={estilos.campos}>
          {etiquetas.map((etiqueta) => (
            <View key={etiqueta} style={estilos.campo}>
              <ThemedText type="etiqueta" themeColor="textSecondary" numberOfLines={1}>
                {etiqueta}
              </ThemedText>
              <BloqueEsqueleto ancho={72} alto={18} />
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Varias piezas, con su cuenta.
 *
 * `filas` no es decorativo: es una promesa sobre cuánto va a ocupar lo que
 * viene. Cinco filas de 132 px llenan una pantalla de teléfono, que es lo que
 * hace que al llegar los datos no salte nada.
 */
export function ListaEsqueleto({
  variante = 'fila',
  filas = 5,
  conFoto = true,
  etiquetas = ['RENTA MENSUAL', 'DISTANCIA'],
}: {
  variante?: 'fila' | 'renglon' | 'hoja';
  filas?: number;
  /** `TarjetaRoomie` lleva avatar y no fotografía de 3:2. Espejar una foto que
   *  no existe crearía el salto que el esqueleto viene a evitar. */
  conFoto?: boolean;
  etiquetas?: string[];
}) {
  return (
    <View
      style={variante === 'hoja' ? estilos.listaHojas : undefined}
      accessibilityLabel="Cargando"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: filas }, (_, i) =>
        variante === 'fila' ? (
          <FilaEsqueleto key={i} indice={i} />
        ) : variante === 'renglon' ? (
          <RenglonEsqueleto key={i} indice={i} />
        ) : (
          <HojaEsqueleto key={i} indice={i} conFoto={conFoto} etiquetas={etiquetas} />
        )
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  foto: { width: '100%', height: AltoFotoTarjeta, borderRadius: Radios.tarjeta },
  titulo: { gap: Spacing.one },

  renglon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 72,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: Filete.fino },
  centro: { flex: 1, gap: Spacing.one },

  listaHojas: { gap: Spacing.three },
  hoja: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  tiraFolio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  fotoHoja: { width: '100%', aspectRatio: 3 / 2, borderTopWidth: Filete.fino, borderBottomWidth: Filete.fino },
  cuerpo: { padding: Spacing.three, gap: Spacing.two },
  campos: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  campo: { gap: Spacing.half },
});
