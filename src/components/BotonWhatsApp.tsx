import { Linking, Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

interface Props {
  numero: string;
  mensaje?: string;
}

// Deep link a WhatsApp con mensaje prellenado (ver Glosario, sección 3, y flujo de la sección 4).
export function BotonWhatsApp({ numero, mensaje = 'Hola, vi tu publicación en Cuervo Pass' }: Props) {
  const abrirWhatsApp = () => {
    const numeroLimpio = numero.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`);
  };

  return (
    <Pressable style={styles.boton} onPress={abrirWhatsApp}>
      <ThemedText style={styles.texto}>Contactar por WhatsApp</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    backgroundColor: '#25D366',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
  },
  texto: { color: '#fff', fontWeight: '600' },
});
