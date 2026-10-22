import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import '@/lib/zodEs';

import { Campo } from '@/components/Campo';
import { Casilla } from '@/components/Casilla';
import { Sello } from '@/components/ficha/Sello';
import { Seccion } from '@/components/ficha/Seccion';
import { RequisitosPassword } from '@/components/RequisitosPassword';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto, escalarTexto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { MENSAJE_CORREO_NO_UNIVERSITARIO, esCorreoUniversitario } from '@/lib/correoUniversitario';
import { evaluarPassword } from '@/lib/password';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { aviso } from '@/lib/registro';
import { VERSION_AVISO } from '@/lib/verificacion';
import { LONGITUD_CODIGO, verificarCodigo } from '@/lib/codigoCorreo';
import { reenviarConfirmacion } from '@/lib/confirmacionCorreo';

// Documento maestro v5 · §25 y §29. El aviso se lee DENTRO de la app
// (src/app/aviso-privacidad.tsx), no en un enlace externo: pedir que se acepte
// un documento que vive detrás de la red —o de un repositorio privado— es pedir
// un consentimiento que no se puede informar.

const esquemaRegistro = z
  .object({
    nombre: z.string().min(2, 'Escribe tu nombre'),
    apellidoPaterno: z.string().min(2, 'Escribe tu apellido paterno'),
    apellidoMaterno: z.string().optional(),
    nombreUsuario: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .regex(/^[a-z0-9_]+$/i, 'Solo letras, números y guion bajo'),
    // §12 · A.7 — correo institucional. No verifica identidad; encarece crear
    // cuentas desechables, que es lo que hacia barato el brigading de reportes
    // (3 reportes ocultan una publicacion o suspenden una cuenta).
    email: z
      .string()
      .email('Correo inválido')
      .refine(esCorreoUniversitario, MENSAJE_CORREO_NO_UNIVERSITARIO),
    password: z.string(),
    confirmarPassword: z.string(),
    // §29: la casilla NO viene premarcada y el registro no avanza sin ella. La
    // marca de tiempo que se guarda en acepto_aviso_privacidad_en es la
    // evidencia del consentimiento; sin columna no hay forma de demostrarlo.
    aceptoAviso: z.literal(true, { message: 'Necesitamos tu consentimiento para crear la cuenta' }),
  })
  .refine((datos) => datos.password === datos.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  })
  // La contraseña se valida contra el OBJETO entero, no de forma aislada: dos de
  // las reglas (no contener el correo, el usuario ni el nombre) necesitan los
  // otros campos. Por eso vive en un superRefine y no en el `z.string()`.
  //
  // Se reporta una sola incumplida: la lista completa está en pantalla marcándose
  // mientras se escribe, y repetir seis errores bajo el campo solo estorba.
  .superRefine((datos, ctx) => {
    const { incumplidas } = evaluarPassword(datos.password, {
      email: datos.email,
      nombreUsuario: datos.nombreUsuario,
      nombre: datos.nombre,
    });
    if (incumplidas.length) {
      ctx.addIssue({ code: 'custom', message: incumplidas[0].etiqueta, path: ['password'] });
    }
  });

type FormRegistro = z.infer<typeof esquemaRegistro>;

// Cada estado de `verificarCodigo` se pinta distinto: un fallo de red NUNCA se dice «código incorrecto».
const MENSAJE_CODIGO = {
  invalido: 'Código incorrecto o vencido. Revísalo o pide uno nuevo.',
  limite: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  fallo: 'No pudimos verificar el código. Revisa tu conexión e inténtalo de nuevo.',
} as const;

export default function RegistroScreen() {
  const theme = useTheme();
  const { anchoContenido, clase, escalaTitulo } = useTamanoPantalla();
  const registrarse = useAuthStore((s) => s.registrarse);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Correo al que se mandó la confirmación; mientras tenga valor se enseña «Revisa tu correo».
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [reenvio, setReenvio] = useState<'ninguno' | 'enviado' | 'fallo'>('ninguno');
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<keyof typeof MENSAJE_CODIGO | null>(null);
  // Un ref y no solo el estado: dos toques en el mismo fotograma pasan antes de que el estado se actualice, y
  // el código sirve una sola vez (el segundo envío diría «incorrecto» justo después de un éxito).
  const verificandoAhora = useRef(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormRegistro>({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { aceptoAviso: false as unknown as true },
  });

  // Para que los requisitos se marquen mientras se escribe, no al enviar.
  const passwordActual = watch('password') ?? '';
  const contextoPassword = {
    email: watch('email'),
    nombreUsuario: watch('nombreUsuario'),
    nombre: watch('nombre'),
  };

  // Lo que sigue a tener sesión: la marca de consentimiento y el cuestionario. Lo comparten el alta con sesión
  // (confirmación apagada) y la confirmación con código.
  const entrar = async () => {
    const { data: sesion } = await supabase.auth.getUser();
    if (sesion.user) {
      // La evidencia del consentimiento. Si esto falla no se tumba el
      // registro, pero sí se registra: una cuenta sin marca de aceptación es
      // un problema de cumplimiento que hay que poder detectar.
      const { error: errorConsentimiento } = await supabase
        .from('usuarios')
        .update({ acepto_aviso_privacidad_en: new Date().toISOString(), version_aviso_aceptada: VERSION_AVISO })
        .eq('id', sesion.user.id);
      if (errorConsentimiento) aviso('No se guardó la marca de consentimiento', undefined, errorConsentimiento);
    }
    router.replace('/(auth)/cuestionario-inicial');
  };

  const onSubmit = async (datos: FormRegistro) => {
    setErrorServidor(null);
    setEnviando(true);
    try {
      const nombreCompleto = [datos.nombre, datos.apellidoPaterno, datos.apellidoMaterno]
        .filter(Boolean)
        .join(' ');

      // §12: la fila de `usuarios` ya NO la inserta el cliente. La crea el
      // trigger handle_new_user con estos metadatos, así que no existe la
      // ventana en la que hay cuenta de Auth sin perfil.
      const { requiereConfirmacion } = (await registrarse({
        email: datos.email,
        password: datos.password,
        nombreUsuario: datos.nombreUsuario,
        nombreCompleto,
        aceptoAviso: datos.aceptoAviso,
      })) ?? { requiereConfirmacion: false };

      // Sin sesión no se puede seguir: ni el consentimiento (lo escribe el trigger) ni el cuestionario
      // (necesita a la persona autenticada). Se espera a que abra el enlace del correo.
      if (requiereConfirmacion) {
        setPendiente(datos.email);
        return;
      }

      await entrar();
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  };

  const onConfirmarCodigo = async () => {
    if (!pendiente || verificandoAhora.current) return;
    verificandoAhora.current = true;
    setVerificando(true);
    setErrorCodigo(null);
    try {
      const r = await verificarCodigo(pendiente, codigo, 'signup');
      if (r.estado === 'ok') await entrar();
      else setErrorCodigo(r.estado);
    } catch {
      setErrorCodigo('fallo');
    } finally {
      verificandoAhora.current = false;
      setVerificando(false);
    }
  };

  const onReenviar = async () => {
    if (!pendiente) return;
    setReenvio((await reenviarConfirmacion(pendiente)) ? 'enviado' : 'fallo');
  };

  if (pendiente) {
    return (
      <ThemedView style={estilos.pantalla}>
        <ScrollView contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}>
          <View style={[estilos.columna, { maxWidth: anchoContenido }]}>
            <Ionicons name="mail-outline" size={48} color={theme.text} />
            <ThemedText type="title" style={escalarTexto(Texto.tituloHoja, escalaTitulo)}>
              Revisa tu correo
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Te mandamos un correo a {pendiente}. Escribe aquí el código de {LONGITUD_CODIGO} dígitos que trae para
              activar tu cuenta, o abre el enlace y después entra con tu contraseña. Si no lo ves, mira en spam.
            </ThemedText>
            <Campo
              etiqueta={`Código de ${LONGITUD_CODIGO} dígitos`}
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={LONGITUD_CODIGO}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            {errorCodigo && (
              <View style={[estilos.errorServidor, { borderColor: theme.error }]}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
                <ThemedText
                  type="small"
                  style={[{ color: theme.error }, estilos.textoError]}
                  accessibilityLiveRegion="assertive"
                >
                  {MENSAJE_CODIGO[errorCodigo]}
                </ThemedText>
              </View>
            )}
            <Sello
              onPress={onConfirmarCodigo}
              cargando={verificando}
              deshabilitado={codigo.length !== LONGITUD_CODIGO}
              accessibilityLabel="Confirmar código"
            >
              Confirmar código
            </Sello>
            {reenvio === 'enviado' && <ThemedText type="small">Listo, te lo mandamos otra vez.</ThemedText>}
            {reenvio === 'fallo' && (
              <ThemedText type="small" style={{ color: theme.errorTexto }}>
                No pudimos reenviarlo. Espera unos minutos e inténtalo de nuevo.
              </ThemedText>
            )}
            <Sello
              variante="contorno"
              onPress={() => router.replace('/(auth)/login')}
              accessibilityLabel="Ya confirmé, entrar"
            >
              Ya confirmé · Entrar
            </Sello>
            <Pressable
              onPress={onReenviar}
              accessibilityRole="button"
              accessibilityLabel="Reenviar correo"
              style={estilos.enlace}
            >
              <ThemedText type="small" themeColor="acento">
                Reenviar correo
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

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
                ALTA DE USUARIO
              </ThemedText>
              <ThemedText type="title" style={escalarTexto(Texto.tituloMedio, escalaTitulo)}>
                Crear cuenta
              </ThemedText>
              <View style={[estilos.filete, { backgroundColor: theme.text }]} />
            </View>

            {/* Seis campos seguidos no se leen: se agrupan. Es lo mismo que hace
                cualquier formulario oficial y, de paso, lo que hace Airbnb con
                sus formularios largos. */}
            <Seccion titulo="Datos personales">
              <Controller
                control={control}
                name="nombre"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    etiqueta="Nombre"
                    placeholder="Angel Damian"
                    autoComplete="given-name"
                    error={errors.nombre?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              <Controller
                control={control}
                name="apellidoPaterno"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    etiqueta="Apellido paterno"
                    placeholder="Malvaiz"
                    autoComplete="family-name"
                    error={errors.apellidoPaterno?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              <Controller
                control={control}
                name="apellidoMaterno"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    etiqueta="APELLIDO MATERNO (OPCIONAL)"
                    placeholder="Gonzalez"
                    error={errors.apellidoMaterno?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </Seccion>

            <Seccion titulo="Datos de acceso">
              <Controller
                control={control}
                name="nombreUsuario"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    etiqueta="Nombre de usuario"
                    placeholder="damianml"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    error={errors.nombreUsuario?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
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
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    contrasena
                    etiqueta="Contraseña"
                    placeholder="Al menos 10 caracteres"
                    autoComplete="new-password"
                    error={errors.password?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              <RequisitosPassword password={passwordActual} contexto={contextoPassword} />
              <Controller
                control={control}
                name="confirmarPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    contrasena
                    etiqueta="Confirmar contraseña"
                    placeholder="Escríbela otra vez"
                    autoComplete="new-password"
                    error={errors.confirmarPassword?.message}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </Seccion>

            <Seccion titulo="Consentimiento">
              <Controller
                control={control}
                name="aceptoAviso"
                render={({ field: { onChange, value } }) => (
                  <Casilla
                    valor={Boolean(value)}
                    onCambiar={onChange}
                    etiqueta="Acepto el aviso de privacidad"
                    ayuda="Explica qué datos guardamos, para qué, y cómo pedir que los borremos."
                  />
                )}
              />
              <Pressable
                onPress={() => router.push('/aviso-privacidad')}
                style={estilos.enlaceAviso}
                accessibilityRole="link"
                accessibilityLabel="Leer el aviso de privacidad"
              >
                <Ionicons name="document-text-outline" size={16} color={theme.acento} />
                <ThemedText type="small" themeColor="acento" style={estilos.textoEnlaceAviso}>
                  Leer el aviso de privacidad
                </ThemedText>
              </Pressable>
              {errors.aceptoAviso && (
                <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="polite">
                  {errors.aceptoAviso.message}
                </ThemedText>
              )}
            </Seccion>

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

            <Sello onPress={handleSubmit(onSubmit)} cargando={enviando} accessibilityLabel="Crear cuenta">
              Crear cuenta
            </Sello>

            <Link href="/(auth)/login" accessibilityRole="link" style={estilos.enlace}>
              <ThemedText type="small" themeColor="acento">
                Ya tengo cuenta · Entrar
              </ThemedText>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}


const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, paddingBottom: Spacing.five },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.four },
  membrete: { gap: Spacing.one },
  filete: { height: Filete.grueso, marginTop: Spacing.two },
  enlaceAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  textoEnlaceAviso: { textDecorationLine: 'underline' },
  // Borde completo y un icono, no un filete de color a la izquierda: ese
  // recurso es decoración disfrazada de semántica.
  errorServidor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
  textoError: { flex: 1, lineHeight: 20 },
  enlace: { alignSelf: 'center', paddingVertical: Spacing.two },
});
