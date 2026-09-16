import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const esquema = z.object({ email: z.string().email('Correo inválido') });
type Form = z.infer<typeof esquema>;

export default function RecuperarContrasenaScreen() {
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
    <ThemedView style={styles.container}>
      <ThemedText type="title">Recuperar contraseña</ThemedText>
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
      {mensaje && <ThemedText type="small">{mensaje}</ThemedText>}

      <Pressable style={styles.boton} onPress={handleSubmit(onSubmit)} disabled={enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Enviar enlace</ThemedText>}
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.link}>
        <ThemedText type="small">Volver</ThemedText>
      </Pressable>
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
