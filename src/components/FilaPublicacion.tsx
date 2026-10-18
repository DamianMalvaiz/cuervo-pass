import { BotonFavorito } from '@/components/BotonFavorito';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { SelloTipo } from '@/components/ficha/SelloTipo';
import { ThemedText } from '@/components/themed-text';
import { AltoFotoTarjeta, Radios, Spacing, Texto } from '@/constants/theme';
import { FotoLista } from '@/components/FotoLista';
import type { FuenteFoto } from '@/lib/miniaturas';
import { useTheme } from '@/hooks/use-theme';
import type { TipoPublicacion } from '@/types/database.types';

/**
 * Tarjeta de una publicación · Cuervo 360.
 *
 * Hasta el 17/10/2026 esto era un renglón de tabla de 132 pt con tres columnas (AJUSTE · RENTA · DISTANCIA),
 * pensado para comparar (END-33). Probado en un iPhone real se leía como un formulario: muchos números
 * técnicos y una foto de 96 pt. Ahora manda la FOTO (grande, de esquinas redondeadas), con el tipo como
 * píldora abajo a la izquierda y el corazón arriba a la derecha; debajo, el título y una línea con el precio
 * y la distancia.
 *
 * El orden de la lista sigue siendo el ajuste; solo dejó de enseñarse como cifra. El nombre del componente se
 * conserva para no mover a sus llamadores.
 */

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** En frase, no en versalitas: un lector de pantalla deletrea «DEPA» como «D-E-P-A» si lo recibe en
 *  mayúsculas sostenidas. */
const PALABRA_ACCESIBLE: Record<TipoPublicacion, string> = {
  depa: 'Departamento',
  cuarto: 'Cuarto',
  casa_compartida: 'Casa compartida',
};

export function FilaPublicacion({
  publicacionId,
  titulo,
  tipo,
  precio,
  fotoUrl,
  fotoMini,
  distanciaKm,
  onPress,
}: {
  /** Con el id, la tarjeta pinta el corazón de Favoritos; sin él (solo lectura), no. */
  publicacionId?: string;
  titulo: string;
  tipo?: TipoPublicacion;
  precio: number;
  fotoUrl?: string | null;
  /** La miniatura (lib/miniaturas.ts): pesa ~60 % menos; si falla, se usa `fotoUrl`. */
  fotoMini?: FuenteFoto | null;
  distanciaKm?: number | null;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const renta = `$${formateadorPrecio.format(precio)} al mes`;
  // Sin dato no hay línea: no se inventa un «—». Una publicación cuyo geocoding falló se muestra igual.
  const distancia =
    distanciaKm != null && Number.isFinite(distanciaKm) ? `a ${distanciaKm.toFixed(1)} km` : null;

  return (
    <Pulsable
      onPress={onPress}
      style={estilos.tarjeta}
      accessibilityRole="button"
      // El tipo va PRIMERO: quien recorre la lista con un lector de pantalla lo necesita para decidir si le
      // interesa, igual que quien la recorre con la vista lo ve en la píldora.
      accessibilityLabel={
        `${tipo ? PALABRA_ACCESIBLE[tipo] + '. ' : ''}${titulo}. Renta ${renta}` +
        `${distancia ? ', ' + distancia : ''}.`
      }
    >
      <View>
        {fotoUrl || fotoMini ? (
          <FotoLista miniatura={fotoMini} completa={fotoUrl} style={estilos.foto} />
        ) : (
          <View
            style={[estilos.foto, estilos.sinFoto, { backgroundColor: theme.backgroundElement }]}
            accessibilityLabel="Sin fotografía"
          >
            <Ionicons name="image-outline" size={28} color={theme.textSecondary} />
          </View>
        )}
        {tipo && (
          <View style={estilos.selloTipo}>
            <SelloTipo tipo={tipo} />
          </View>
        )}
        {publicacionId ? (
          // Círculo opaco: el corazón va encima de una foto cualquiera y sobre una foto clara o muy
          // cargada se perdería.
          <View style={[estilos.corazon, { backgroundColor: theme.background }]}>
            <BotonFavorito publicacionId={publicacionId} />
          </View>
        ) : null}
      </View>

      <View style={estilos.texto}>
        <ThemedText numberOfLines={2} style={[Texto.cuerpo, Texto.pesoFuerte]}>
          {titulo}
        </ThemedText>
        <View style={estilos.linea}>
          <ThemedText type="small" style={Texto.pesoFuerte}>
            {renta}
          </ThemedText>
          {distancia ? (
            <ThemedText type="small" themeColor="textSecondary">
              {distancia}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  // Sin margen lateral propio: lo pone quien la monta (Inicio por bloque, Favoritos en la lista), igual que el resto
  // de los bloques de la pantalla; si lo llevara también la tarjeta, quedaría sangrada el doble.
  tarjeta: { gap: Spacing.two, paddingBottom: Spacing.three },
  foto: { width: '100%', height: AltoFotoTarjeta, borderRadius: Radios.tarjeta },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  selloTipo: { position: 'absolute', left: Spacing.two, bottom: Spacing.two },
  corazon: { position: 'absolute', top: Spacing.two, right: Spacing.two, borderRadius: Radios.full },
  texto: { gap: Spacing.half },
  linea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
