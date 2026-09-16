import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

const esquemaLogin = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormLogin = z.infer<typeof esquemaLogin>;

export default function LoginScreen() {
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
    <ThemedView style={styles.container}>
      <ThemedText type="title">Cuervo Pass</ThemedText>
      <ThemedText type="small" style={styles.subtitulo}>
        Inicia sesión para ver tus sugerencias
      </ThemedText>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Correo"
            autoCapitalize="none"
            keyboardType="email-address"
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
            style={styles.input}
            placeholder="Contraseña"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      {errorServidor && <ThemedText style={styles.error}>{errorServidor}</ThemedText>}

      <Pressable style={styles.boton} onPress={handleSubmit(onSubmit)} disabled={enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Entrar</ThemedText>}
      </Pressable>

      <Link href="/(auth)/registro" style={styles.link}>
        <ThemedText type="small">¿No tienes cuenta? Regístrate</ThemedText>
      </Link>
      <Link href="/(auth)/recuperar-contrasena" style={styles.link}>
        <ThemedText type="small">Olvidé mi contraseña</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  subtitulo: { marginBottom: Spacing.three },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  error: { color: '#d92d20' },
  boton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  botonTexto: { color: '#fff', fontWeight: '600' },
  link: { alignSelf: 'center', marginTop: Spacing.one },
});
