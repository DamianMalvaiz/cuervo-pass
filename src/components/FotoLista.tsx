import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import type { StyleProp } from 'react-native';

import type { FuenteFoto } from '@/lib/miniaturas';

/**
 * La foto de una tarjeta de lista: pide primero la MINIATURA (≈ −78 % de bytes, ver `lib/miniaturas.ts`) y, si esa petición falla —el endpoint de
 * transformación no responde, la sesión caducó a mitad de la lista, el plan cambió—, cae a la foto COMPLETA que ya se firmó. Una foto que no se ve
 * por un fallo de la optimización sería peor que la lenta.
 *
 * Quien la use decide qué pintar cuando no hay ninguna de las dos (su propio marcador de «sin fotografía»).
 */
export function FotoLista({
  miniatura,
  completa,
  style,
  transition = 160,
  accessibilityLabel,
}: {
  miniatura?: FuenteFoto | null;
  /** URL firmada de la foto completa (la que ya se pedía en lote). */
  completa?: string | null;
  style?: StyleProp<ImageStyle>;
  transition?: number;
  accessibilityLabel?: string;
}) {
  const [fallo, setFallo] = useState(false);
  const fuente = !fallo && miniatura ? miniatura : completa ? { uri: completa } : null;
  if (!fuente) return null;
  return (
    <Image
      source={fuente}
      style={style}
      contentFit="cover"
      transition={transition}
      accessibilityLabel={accessibilityLabel}
      // Solo la miniatura tiene un respaldo; si falla la completa no hay a dónde caer.
      onError={miniatura && !fallo ? () => setFallo(true) : undefined}
    />
  );
}
