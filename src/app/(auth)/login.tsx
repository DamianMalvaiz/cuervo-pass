import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Campo } from '@/components/Campo';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// Al ENTRAR no se valida la fuerza de la contraseña, solo que exista.
//
// Validarla aquí tendría dos defectos: le contaría la regla a quien todavía no
// ha entrado, y bloquearía a las cuentas creadas antes de que la regla
// existiera. La fuerza se exige donde se ELIGE la contraseña —registro y
// cambio—, y el servidor la vuelve a exigir ahí.
const esquemaLogin = z.object({
  email: z.string().email('Ese correo no parece válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

type FormLogin = z.infer<typeof esquemaLogin>;

export default function LoginScreen() {
  const theme = useTheme();
  const { anchoContenido, clase, altoApretado, escalaTitulo } = useTamanoPantalla();
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
      const { data: sesion } = await supabase.auth.getUser();
      // Si esta cuenta se quedó a medias del cuestionario inicial (ej. salió de
      // la app antes de terminarlo), regresarla ahí en vez de mandarla directo a
      // Sugerencias sin universidad ni presupuesto configurados.
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('universidad')
        .eq('id', sesion.user?.id ?? '')
        .single();
      router.replace(perfil?.universidad ? '/(tabs)/inicio' : '/(auth)/cuestionario-inicial');
    } catch (e) {
      // El mensaje de Supabase viene en inglés y dice "Invalid login
      // credentials", que no le sirve a nadie. Se traduce lo único que de
      // verdad puede estar pasando.
      const crudo = e instanceof Error ? e.message : '';
      setErrorServidor(
        /invalid login credentials/i.test(crudo)
          ? 'El correo o la contraseña no coinciden. Revísalos e intenta otra vez.'
          : crudo || 'No se pudo iniciar sesión. Revisa tu conexión e intenta otra vez.'
      );
    } finally {
      setEnviando(false);
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
            {/* Membrete. En pantallas de poco alto el subtítulo sobra: lo que
                no cabe se recorta por lo prescindible, no por lo esencial. */}
            <View style={estilos.membrete}>
              <ThemedText type="etiqueta" themeColor="textSecondary">
                UNIVERSIDAD TECNOLÓGICA DEL VALLE DE TOLUCA
              </ThemedText>
              <ThemedText type="title" style={{ fontSize: 34 * escalaTitulo, lineHeight: 38 * escalaTitulo }}>
                Cuervo Pass
              </ThemedText>
              {!altoApretado && (
                <ThemedText type="small" themeColor="textSecondary">
                  Encuentra dónde vivir cerca de tu campus.
                </ThemedText>
              )}
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Campo
                  contrasena
                  etiqueta="CONTRASEÑA"
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            {errorServidor && (
              <View style={[estilos.errorServidor, { borderColor: theme.error }]}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
                <ThemedText
                  type="small"
                  style={[{ color: theme.error }, estilos.textoError]}
                  accessibilityLiveRegion="assertive"
                >
                  {errorServidor}
                </ThemedText>
              </View>
            )}

            <View style={estilos.accion}>
              <Sello onPress={handleSubmit(onSubmit)} cargando={enviando} accessibilityLabel="Entrar">
                Entrar
              </Sello>
            </View>

            <View style={estilos.enlaces}>
              <Link href="/(auth)/registro" accessibilityRole="link" style={estilos.enlace}>
                <ThemedText type="small" themeColor="acento">
                  Crear una cuenta
                </ThemedText>
              </Link>
              <ThemedText type="small" themeColor="textSecondary">
                ·
              </ThemedText>
              <Link href="/(auth)/recuperar-contrasena" accessibilityRole="link" style={estilos.enlace}>
                <ThemedText type="small" themeColor="acento">
                  Olvidé mi contraseña
                </ThemedText>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four },
  // En pantalla amplia la columna se acota y se centra en vez de estirarse:
  // una línea de ciento veinte caracteres no se lee, se recorre.
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  membrete: { gap: Spacing.one, marginBottom: Spacing.two },
  filete: { height: Filete.grueso, marginTop: Spacing.three },
  // Borde completo y un icono, no un filete de color a la izquierda: ese
  // recurso es decoración disfrazada de semántica, y quien no distingue el
  // color no recibe ninguna señal.
  errorServidor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
  accion: { marginTop: Spacing.two },
  enlaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  enlace: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.one },
  textoError: { flex: 1, lineHeight: 20 },
});
