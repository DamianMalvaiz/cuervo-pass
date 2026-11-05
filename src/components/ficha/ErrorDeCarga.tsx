import { StyleSheet, View } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { Sello } from '@/components/ficha/Sello';
import { Spacing } from '@/constants/theme';

/**
 * «No pudimos leer esto»: el estado de FALLO de una lectura, con salida. «Falló la conexión» y «no hay datos» son cosas distintas (END-11): pintar el fallo como
 * «sin datos», «sin verificar» o un cero le dice a la persona algo falso y alarmante (una cuenta recién creada que parece borrada).
 */
export function ErrorDeCarga({
  etiqueta,
  mensaje = 'Revisa tu conexión e intenta de nuevo.',
  onReintentar,
}: {
  etiqueta: string;
  mensaje?: string;
  onReintentar: () => void;
}) {
  return (
    <View style={estilos.contenedor}>
      <BloqueEstado tono="alerta" icono="cloud-offline-outline" etiqueta={etiqueta} mensaje={mensaje} />
      <Sello variante="contorno" icono="refresh" onPress={onReintentar} accessibilityLabel="Reintentar">
        Reintentar
      </Sello>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Spacing.three },
});
