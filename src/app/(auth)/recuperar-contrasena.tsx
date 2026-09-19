import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Campo } from '@/components/Campo';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const esquema = z.object({ email: z.string().email('Correo inválido') });
type Form = z.infer<typeof esquema>;

export default function RecuperarContrasenaScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
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
    <ThemedView style={estilos.pantalla}>
      <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
            <View style={estilos.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                RECUPERACIÓN DE ACCESO
              </ThemedText>
              <ThemedText type="title">Olvidé mi contraseña</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.explicacion}>
                Te mandamos un enlace al correo de tu cuenta. Con él podrás elegir una
                contraseña nueva.
              </ThemedText>
              <View style={[estilos.filete, { backgroundColor: theme.text }]} />
            </View>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Campo
                  etiqueta="CORREO ELECTRÓNICO"
                  placeholder="tucorreo@ejemplo.mx"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  error={errors.email?.message}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            {/* Se confirma SIN decir si el correo existe: responder "esa cuenta no
                existe" convierte esta pantalla en un comprobador de correos
                registrados para cualquiera que la abra. */}
            {mensaje && (
              <View style={[estilos.acuse, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={estilos.textoAcuse}
                  accessibilityLiveRegion="polite"
                >
                  {mensaje}
                </ThemedText>
              </View>
            )}

            <Sello onPress={handleSubmit(onSubmit)} cargando={enviando} accessibilityLabel="Enviar enlace">
              Enviar enlace
            </Sello>

            <Pressable
              onPress={() => router.back()}
              style={estilos.volver}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="chevron-back" size={16} color={theme.acento} />
              <ThemedText type="small" themeColor="acento">
                Volver
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  membrete: { gap: Spacing.one, marginBottom: Spacing.two },
  explicacion: { lineHeight: 20 },
  filete: { height: Filete.grueso, marginTop: Spacing.three },
  acuse: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
  textoAcuse: { flex: 1, lineHeight: 20 },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    minHeight: 48,
  },
});
