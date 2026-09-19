import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppColors, Radios, Spacing, Tipografia } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const esquema = z.object({ email: z.string().email('Correo inválido') });
type Form = z.infer<typeof esquema>;

export default function RecuperarContrasenaScreen() {
  const theme = useTheme();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(esquema) });

  const onSubmit = async (datos: Form) => {
    setEnviando(true);
    setMensaje(null);
    const { error } = await supabase.auth.resetPasswordForEmail(datos.email);
    setEnviando(false);
    setMensaje(
      error ? 'No se pudo enviar el correo, intenta de nuevo' : 'Revisa tu correo para restablecer tu contraseña'
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Recuperar contraseña</ThemedText>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Correo"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                accessibilityLabel="Correo electrónico"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.email && <ThemedText style={styles.error}>{errors.email.message}</ThemedText>}
          {mensaje && (
            <ThemedText type="small" accessibilityLiveRegion="polite">
              {mensaje}
            </ThemedText>
          )}

          <Pressable
            style={styles.boton}
            onPress={handleSubmit(onSubmit)}
            disabled={enviando}
            accessibilityRole="button"
            accessibilityLabel="Enviar enlace"
            accessibilityState={{ disabled: enviando, busy: enviando }}
          >
            {enviando ? <ActivityIndicator color={AppColors.selloTexto} /> : <ThemedText style={styles.botonTexto}>Enviar enlace</ThemedText>}
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.link} accessibilityRole="button" accessibilityLabel="Volver">
            <ThemedText type="small">Volver</ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: Radios.control, padding: Spacing.three },
  error: { color: AppColors.destructiveRed },
  boton: {
    backgroundColor: AppColors.sello,
    borderRadius: Radios.control,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonTexto: { color: AppColors.selloTexto, fontFamily: Tipografia.semibold },
  link: { alignSelf: 'center', marginTop: Spacing.one, padding: Spacing.two },
});
