import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const esquemaRegistro = z
  .object({
    nombreCompleto: z.string().min(2, 'Escribe tu nombre'),
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
        const { error: errorInsert } = await supabase.from('usuarios').insert({
          id: sesion.user.id,
          nombre_usuario: datos.nombreUsuario,
          nombre_completo: datos.nombreCompleto,
        });
        if (errorInsert) throw errorInsert;
      }
      router.replace('/(tabs)/inicio');
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Crear cuenta</ThemedText>

      <Controller
        control={control}
        name="nombreCompleto"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput style={styles.input} placeholder="Nombre completo" onBlur={onBlur} onChangeText={onChange} value={value} />
        )}
      />
      {errors.nombreCompleto && <ThemedText style={styles.error}>{errors.nombreCompleto.message}</ThemedText>}

      <Controller
        control={control}
        name="nombreUsuario"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Nombre de usuario"
            autoCapitalize="none"
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
          <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} />
        )}
      />
      {errors.password && <ThemedText style={styles.error}>{errors.password.message}</ThemedText>}

      <Controller
        control={control}
        name="confirmarPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.confirmarPassword && <ThemedText style={styles.error}>{errors.confirmarPassword.message}</ThemedText>}

      {errorServidor && <ThemedText style={styles.error}>{errorServidor}</ThemedText>}

      <Pressable style={styles.boton} onPress={handleSubmit(onSubmit)} disabled={enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Crear cuenta</ThemedText>}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        <ThemedText type="small">Ya tengo cuenta, entrar</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: Spacing.two, padding: Spacing.three },
  error: { color: '#d92d20' },
  boton: { backgroundColor: '#208AEF', borderRadius: Spacing.two, padding: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
  botonTexto: { color: '#fff', fontWeight: '600' },
  link: { alignSelf: 'center', marginTop: Spacing.one },
});
