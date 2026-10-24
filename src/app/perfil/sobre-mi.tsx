import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * «Sobre mí»: la biografía, en su propia pantalla. Antes era un bloque del perfil, donde competía con la ficha de búsqueda, las funciones y los accesos.
 *
 * El sello de guardar aparece SOLO si hay algo sin guardar: un «Guardar» permanentemente encendido no distingue «ya está» de «te falta», que es justo lo
 * que uno necesita saber. Y un fallo se dice, sin dar también el aviso de éxito.
 */
export default function SobreMiScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const session = useAuthStore((s) => s.session);
  const { perfil, actualizarPerfil } = usePerfilStore();
  const [biografia, setBiografia] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza el borrador con el perfil cargado sin useEffect: «ajustar estado durante el render», para un valor que llega async y debe resetear
  // un borrador editable.
  const [sincronizada, setSincronizada] = useState<string | null | undefined>(undefined);
  if (perfil?.biografia !== sincronizada) {
    setSincronizada(perfil?.biografia);
    setBiografia(perfil?.biografia ?? '');
  }

  const cambiada = biografia !== (perfil?.biografia ?? '');

  const guardar = async () => {
    if (!session?.user.id) return;
    setError(null);
    setGuardando(true);
    try {
      await actualizarPerfil(session.user.id, { biografia });
      // Dentro del `try`, para que un fallo no dé también el aviso de éxito.
      toast.exito('Biografía guardada');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo guardar la biografía';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ThemedView style={estilos.pantalla}>
      <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Cuéntale a otros quién eres. Genera confianza para quien no puede ir a verte antes de decidir.
            </ThemedText>
            <Campo
              punteado
              etiqueta="Sobre ti"
              placeholder="Cuéntale a otros quién eres. Genera confianza para quien no puede ir a verte antes de decidir."
              multiline
              maxLength={280}
              style={estilos.biografia}
              value={biografia}
              onChangeText={setBiografia}
            />
            <View style={estilos.pie}>
              <ThemedText type="folio" themeColor="textSecondary">
                {biografia.length}/280
              </ThemedText>
              {cambiada && (
                <ThemedText type="small" themeColor="acento">
                  Sin guardar
                </ThemedText>
              )}
            </View>
            {error && (
              <View style={[estilos.errorBloque, { borderColor: theme.error }]}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
                <ThemedText type="small" style={[{ color: theme.error }, estilos.flexible]} accessibilityLiveRegion="assertive">
                  {error}
                </ThemedText>
              </View>
            )}
            {cambiada && (
              <Sello onPress={guardar} cargando={guardando} accessibilityLabel="Guardar biografía">
                Guardar biografía
              </Sello>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  flexible: { flex: 1 },
  biografia: { minHeight: 140, textAlignVertical: 'top', paddingTop: Spacing.three },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorBloque: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
});
