import { StyleSheet, View, type ViewStyle } from 'react-native';

// Sombra de abajo hacia arriba sobre una foto, para que el texto blanco se lea encima. React Native Web deja pasar `backgroundImage` al CSS; en el teléfono (donde esta pantalla no se usa) simplemente no pinta.
const DEGRADADO = { backgroundImage: 'linear-gradient(0deg, rgba(15, 18, 16, 0.8), rgba(15, 18, 16, 0) 64%)' } as ViewStyle;

export function ScrimWeb() {
  return <View pointerEvents="none" style={[estilos.cubre, DEGRADADO]} />;
}

const estilos = StyleSheet.create({
  cubre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
