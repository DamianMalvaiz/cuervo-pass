import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { AppColors, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

interface Props {
  numero: string;
  mensaje?: string;
  onContactar?: () => void;
}

// Deep link a WhatsApp con mensaje prellenado (ver Glosario, sección 3, y flujo de la sección 4).
export function BotonWhatsApp({ numero, mensaje = 'Hola, vi tu publicación en Cuervo Pass', onContactar }: Props) {
  const abrirWhatsApp = () => {
    onContactar?.();
    const numeroLimpio = numero.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`);
  };

  return (
    <Pressable
      style={styles.boton}
      onPress={abrirWhatsApp}
      accessibilityRole="button"
      accessibilityLabel="Contactar por WhatsApp"
      accessibilityHint="Abre WhatsApp con un mensaje ya escrito"
    >
      <Ionicons name="logo-whatsapp" size={20} color="#fff" />
      <ThemedText style={styles.texto}>Contactar por WhatsApp</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: AppColors.whatsappGreen,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 44,
  },
  texto: { color: '#fff', fontWeight: '600' },
});
