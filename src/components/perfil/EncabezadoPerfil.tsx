import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** «Perfil» y el engranaje de Configuración: igual en el perfil de estudiante y en el de vendedor. */
export function EncabezadoPerfil() {
  const theme = useTheme();
  return (
    <View style={estilos.fila}>
      <ThemedText style={Texto.tituloHoja}>Perfil</ThemedText>
      <Pulsable
        onPress={() => router.push('/configuracion')}
        accessibilityRole="button"
        accessibilityLabel="Configuración"
        style={[estilos.boton, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}
      >
        <Ionicons name="settings-outline" size={22} color={theme.text} />
      </Pulsable>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boton: { width: 44, height: 44, borderRadius: Radios.full, borderWidth: Filete.fino, alignItems: 'center', justifyContent: 'center' },
});
