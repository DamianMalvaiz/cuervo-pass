import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
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
import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/useAuthStore';

const esquemaLogin = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormLogin = z.infer<typeof esquemaLogin>;

export default function LoginScreen() {
  const theme = useTheme();
  const iniciarSesion = useAuthStore((s) => s.iniciarSesion);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormLogin>({ resolver: zodResolver(esquemaLogin) });

  const onSubmit = async (datos: FormLogin) => {
    setErrorServidor(null);
    setEnviando(true);
    try {
      await iniciarSesion(datos.email, datos.password);
      router.replace('/(tabs)/inicio');
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Cuervo Pass</ThemedText>
          <ThemedText type="small" style={styles.subtitulo}>
            Inicia sesión para ver tus sugerencias
          </ThemedText>

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
          {errors.email && (
            <ThemedText style={styles.error} accessibilityLiveRegion="polite">
              {errors.email.message}
            </ThemedText>
          )}

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Contraseña"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                accessibilityLabel="Contraseña"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.password && (
            <ThemedText style={styles.error} accessibilityLiveRegion="polite">
              {errors.password.message}
            </ThemedText>
          )}

          {errorServidor && (
            <ThemedText style={styles.error} accessibilityLiveRegion="assertive">
              {errorServidor}
            </ThemedText>
          )}

          <Pressable
            style={styles.boton}
            onPress={handleSubmit(onSubmit)}
            disabled={enviando}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
            accessibilityState={{ disabled: enviando, busy: enviando }}
          >
            {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Entrar</ThemedText>}
          </Pressable>

          <Link href="/(auth)/registro" style={styles.link} accessibilityRole="link">
            <ThemedText type="small">¿No tienes cuenta? Regístrate</ThemedText>
          </Link>
          <Link href="/(auth)/recuperar-contrasena" style={styles.link} accessibilityRole="link">
            <ThemedText type="small">Olvidé mi contraseña</ThemedText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  subtitulo: { marginBottom: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  error: { color: AppColors.destructiveRed },
  boton: {
    backgroundColor: AppColors.primary,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonTexto: { color: '#fff', fontWeight: '600' },
  link: { alignSelf: 'center', marginTop: Spacing.one, padding: Spacing.two },
});
