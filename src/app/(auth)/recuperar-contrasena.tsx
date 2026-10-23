import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import '@/lib/zodEs';

import { Campo } from '@/components/Campo';
import { Sello } from '@/components/ficha/Sello';
import { RequisitosPassword } from '@/components/RequisitosPassword';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { LONGITUD_CODIGO, MENSAJE_CODIGO, verificarCodigo } from '@/lib/codigoCorreo';
import { evaluarPassword } from '@/lib/password';
import { fallo } from '@/lib/registro';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';

const esquema = z.object({ email: z.string().email('Correo inválido') });
type Form = z.infer<typeof esquema>;

export default function RecuperarContrasenaScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Correo al que se mandó el código; con valor se enseña el segundo paso (código y contraseña nueva).
  const [correo, setCorreo] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<keyof typeof MENSAJE_CODIGO | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  // Un ref y no solo el estado: dos toques en el mismo fotograma pasan antes de que el estado se actualice, y
  // el código sirve una sola vez.
  const enCurso = useRef(false);
  // Verificar el código abre sesión. Mientras sea true, esa sesión existe y la contraseña sigue sin cambiarse.
  const sesionAbierta = useRef(false);

  // Quien verifica el código y se va sin cambiar la contraseña no se queda dentro de la cuenta.
  useEffect(
    () => () => {
      if (sesionAbierta.current) {
        cerrarSesion().catch((e) => fallo('No se cerró la sesión al salir de la recuperación', undefined, e));
      }
    },
    [cerrarSesion]
  );

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
      error
        ? 'No se pudo enviar el correo, intenta de nuevo'
        : `Revisa tu correo: te mandamos un código de ${LONGITUD_CODIGO} dígitos.`
    );
    if (!error) setCorreo(datos.email);
  };

  const onCambiar = async () => {
    if (!correo || enCurso.current) return;
    setErrorCampo(null);
    setErrorCodigo(null);
    // Antes de gastar el código: una contraseña que no cumple no debe quemarlo.
    const { incumplidas } = evaluarPassword(nueva, { email: correo });
    if (incumplidas.length) return setErrorCampo(incumplidas[0].etiqueta);
    if (nueva !== repite) return setErrorCampo('Las contraseñas no coinciden');

    enCurso.current = true;
    setCambiando(true);
    try {
      // Si ya se verificó y cambiar la contraseña falló, se reintenta SIN verificar: el código ya se gastó.
      if (!sesionAbierta.current) {
        const r = await verificarCodigo(correo, codigo, 'recovery');
        if (r.estado !== 'ok') return setErrorCodigo(r.estado);
        sesionAbierta.current = true;
      }
      const { error } = await supabase.auth.updateUser({ password: nueva });
      if (error) return setErrorCampo('No pudimos cambiar la contraseña. Inténtalo de nuevo.');

      sesionAbierta.current = false;
      try {
        await cerrarSesion();
      } catch (e) {
        fallo('No se cerró la sesión tras cambiar la contraseña', undefined, e);
      }
      toast.exito('Contraseña cambiada. Inicia sesión con la nueva.');
      router.replace('/(auth)/login');
    } catch {
      setErrorCampo('No pudimos cambiar la contraseña. Inténtalo de nuevo.');
    } finally {
      enCurso.current = false;
      setCambiando(false);
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
            <View style={estilos.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                RECUPERACIÓN DE ACCESO
              </ThemedText>
              <ThemedText type="title">Olvidé mi contraseña</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={estilos.explicacion}>
                Te mandamos un código de {LONGITUD_CODIGO} dígitos al correo de tu cuenta. Escríbelo aquí y elige
                una contraseña nueva.
              </ThemedText>
              <View style={[estilos.filete, { backgroundColor: theme.text }]} />
            </View>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Campo
                  etiqueta="Correo electrónico"
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

            <Sello
              onPress={handleSubmit(onSubmit)}
              cargando={enviando}
              variante={correo ? 'contorno' : 'sello'}
              accessibilityLabel={correo ? 'Reenviar código' : 'Enviar código'}
            >
              {correo ? 'Reenviar código' : 'Enviar código'}
            </Sello>

            {correo && (
              <>
                <Campo
                  etiqueta={`Código de ${LONGITUD_CODIGO} dígitos`}
                  value={codigo}
                  onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={LONGITUD_CODIGO}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
                <Campo
                  etiqueta="Contraseña nueva"
                  contrasena
                  autoComplete="new-password"
                  value={nueva}
                  onChangeText={setNueva}
                />
                <RequisitosPassword password={nueva} contexto={{ email: correo }} />
                <Campo
                  etiqueta="Repite la contraseña nueva"
                  contrasena
                  autoComplete="new-password"
                  value={repite}
                  onChangeText={setRepite}
                />
                {(errorCodigo || errorCampo) && (
                  <View style={[estilos.error, { borderColor: theme.error }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
                    <ThemedText
                      type="small"
                      style={[{ color: theme.error }, estilos.textoAcuse]}
                      accessibilityLiveRegion="assertive"
                    >
                      {errorCodigo ? MENSAJE_CODIGO[errorCodigo] : errorCampo}
                    </ThemedText>
                  </View>
                )}
                <Sello
                  onPress={onCambiar}
                  cargando={cambiando}
                  deshabilitado={codigo.length !== LONGITUD_CODIGO}
                  accessibilityLabel="Cambiar contraseña"
                >
                  Cambiar contraseña
                </Sello>
              </>
            )}

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
  error: {
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
