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
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const esquemaRegistro = z
  .object({
    nombre: z.string().min(2, 'Escribe tu nombre'),
    apellidoPaterno: z.string().min(2, 'Escribe tu apellido paterno'),
    apellidoMaterno: z.string().optional(),
    nombreUsuario: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .regex(/^[a-z0-9_]+$/i, 'Solo letras, números y guion bajo'),
    email: z.string().email('Correo inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmarPassword: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  });

type FormRegistro = z.infer<typeof esquemaRegistro>;

export default function RegistroScreen() {
  const theme = useTheme();
  const registrarse = useAuthStore((s) => s.registrarse);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormRegistro>({ resolver: zodResolver(esquemaRegistro) });

  const onSubmit = async (datos: FormRegistro) => {
    setErrorServidor(null);
    setEnviando(true);
    try {
      await registrarse(datos.email, datos.password);
      const { data: sesion } = await supabase.auth.getUser();
      if (sesion.user) {
        // Fila inicial en `usuarios` — la policy "solo el dueno inserta su fila inicial" (sección 8)
        // exige que auth.uid() = id, por eso se hace justo después del signUp, con sesión ya activa.
        const nombreCompleto = [datos.nombre, datos.apellidoPaterno, datos.apellidoMaterno]
          .filter(Boolean)
          .join(' ');
        const { error: errorInsert } = await supabase.from('usuarios').insert({
          id: sesion.user.id,
          nombre_usuario: datos.nombreUsuario,
          nombre_completo: nombreCompleto,
        });
        if (errorInsert) throw errorInsert;
      }
      router.replace('/(auth)/cuestionario-inicial');
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  };

  const estiloInput = [styles.input, { borderColor: theme.border, color: theme.text }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Crear cuenta</ThemedText>

          <Controller
            control={control}
            name="nombre"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
                placeholder="Nombre(s)"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Nombre"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.nombre && <ThemedText style={styles.error}>{errors.nombre.message}</ThemedText>}

          <Controller
            control={control}
            name="apellidoPaterno"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
                placeholder="Apellido paterno"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Apellido paterno"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.apellidoPaterno && <ThemedText style={styles.error}>{errors.apellidoPaterno.message}</ThemedText>}

          <Controller
            control={control}
            name="apellidoMaterno"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
                placeholder="Apellido materno (opcional)"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Apellido materno, opcional"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.apellidoMaterno && <ThemedText style={styles.error}>{errors.apellidoMaterno.message}</ThemedText>}

          <Controller
            control={control}
            name="nombreUsuario"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
                placeholder="Nombre de usuario"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                accessibilityLabel="Nombre de usuario"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.nombreUsuario && <ThemedText style={styles.error}>{errors.nombreUsuario.message}</ThemedText>}

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
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

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
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
          {errors.password && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

          <Controller
            control={control}
            name="confirmarPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estiloInput}
                placeholder="Confirmar contraseña"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                accessibilityLabel="Confirmar contraseña"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.confirmarPassword && <ThemedText style={styles.error}>{errors.confirmarPassword.message}</ThemedText>}

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
            accessibilityLabel="Crear cuenta"
            accessibilityState={{ disabled: enviando, busy: enviando }}
          >
            {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Crear cuenta</ThemedText>}
          </Pressable>

          <Link href="/(auth)/login" style={styles.link} accessibilityRole="link">
            <ThemedText type="small">Ya tengo cuenta, entrar</ThemedText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
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
