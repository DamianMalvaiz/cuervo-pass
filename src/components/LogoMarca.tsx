import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

/**
 * El logo de Cuervo 360 dentro de la app: la «C» verde con el cuervo, el pin de ubicación y la órbita.
 *
 * Es una imagen con transparencia (se generó a partir del logo fuente con `scripts/marca/generar-iconos.py`),
 * así que se ve igual sobre el papel claro y sobre el carbón, sin una caja negra alrededor. Es una imagen:
 * se anuncia con su nombre para el lector de pantalla.
 */
export function LogoMarca({ tamano = 88, centrado = false }: { tamano?: number; centrado?: boolean }) {
  return (
    <Image
      source={require('../../assets/images/logo-app.png')}
      style={[estilos.logo, centrado && estilos.centrado, { width: tamano, height: tamano }]}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="Cuervo 360"
    />
  );
}

const estilos = StyleSheet.create({
  logo: { alignSelf: 'flex-start' },
  centrado: { alignSelf: 'center' },
});
