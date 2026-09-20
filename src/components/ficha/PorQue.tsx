import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/**
 * Por qué esta publicación tiene ese ajuste · END-30
 *
 * Una cifra sola pide que te fíes. El mismo número con sus tres razones al lado
 * se puede discutir: «1.2 km · $500 bajo tu tope · afinidad 0.87» dice de dónde
 * sale, y quien lo lee puede estar en desacuerdo, que es justo lo que una
 * recomendación honesta permite.
 *
 * Es además la respuesta a la objeción más dura de END-30: una calificación de
 * kardex es un número GANADO y auditable, y la metáfora le prestaba a este una
 * credibilidad que no tenía. Mostrar el desglose devuelve esa credibilidad al
 * dato en vez de tomarla prestada de la forma.
 *
 * La afinidad se OMITE cuando no la hay, en lugar de escribir «afinidad —». Un
 * guion invita a preguntar qué falta; su ausencia simplemente no promete nada.
 */
export function PorQue({
  distanciaKm,
  precio,
  presupuestoMax,
  similitud,
}: {
  distanciaKm?: number | null;
  precio: number;
  presupuestoMax?: number | null;
  /** Afinidad semántica en [0,1]. Null cuando esta fila es de Nivel 1. */
  similitud?: number | null;
}) {
  const partes: string[] = [];

  if (distanciaKm != null && Number.isFinite(distanciaKm)) {
    partes.push(`${distanciaKm.toFixed(1)} km`);
  }

  // La diferencia contra TU tope, no el precio a secas: el precio ya está en la
  // ficha, y repetirlo no explicaría nada. Lo que explica el ajuste es la
  // holgura — y por eso también se dice cuando está POR ENCIMA, que ocurre: el
  // filtro duro admite hasta un 10% de más (migración 0015).
  if (presupuestoMax != null && Number.isFinite(presupuestoMax)) {
    const holgura = presupuestoMax - precio;
    const monto = Math.abs(holgura).toLocaleString('es-MX');
    partes.push(holgura >= 0 ? `$${monto} bajo tu tope` : `$${monto} sobre tu tope`);
  }

  if (similitud != null && Number.isFinite(similitud)) {
    partes.push(`afinidad ${similitud.toFixed(2)}`);
  }

  if (partes.length === 0) return null;

  return (
    <ThemedText type="folio" themeColor="textSecondary" style={estilos.linea} numberOfLines={1}>
      {partes.join(' · ')}
    </ThemedText>
  );
}

const estilos = StyleSheet.create({
  linea: { marginTop: 2 },
});
