import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Radios, Spacing, Texto } from '@/constants/theme';
import { useAvisosNoLeidos } from '@/hooks/queries/useNotificaciones';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';

/** La campana de Inicio · 0072. La insignia lleva el número en TEXTO (no solo un punto de color) y no se pinta si no se sabe o es cero. */
export function CampanaAvisos() {
  const theme = useTheme();
  const uid = useAuthStore((s) => s.session?.user.id);
  const sinLeer = useAvisosNoLeidos(uid);
  const hay = sinLeer != null && sinLeer > 0;

  return (
    <Pulsable
      // Sin `toque()`: abrir los avisos es NAVEGAR, no un cambio. El tacto se reserva para lo que responde o compromete algo (ver `lib/tacto`).
      onPress={() => {
        router.push('/notificaciones');
      }}
      accessibilityRole="button"
      accessibilityLabel={hay ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      style={[estilos.boton, { borderColor: theme.border }]}
    >
      <Ionicons name="notifications-outline" size={22} color={theme.text} />
      {hay ? (
        <View style={[estilos.insignia, { backgroundColor: theme.error }]}>
          <ThemedText type="smallBold" style={[estilos.numero, { color: theme.errorTexto }]}>
            {sinLeer > 9 ? '9+' : String(sinLeer)}
          </ThemedText>
        </View>
      ) : null}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  boton: { width: 44, minHeight: 44, borderWidth: 1, borderRadius: Radios.control, alignItems: 'center', justifyContent: 'center' },
  insignia: {
    position: 'absolute',
    top: -Spacing.one,
    right: -Spacing.one,
    minWidth: 20,
    paddingHorizontal: Spacing.one,
    borderRadius: Radios.full,
    alignItems: 'center',
  },
  numero: { ...Texto.pesoFuerte },
});
