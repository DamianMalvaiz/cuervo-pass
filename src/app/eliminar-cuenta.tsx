import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { eliminarMiCuenta } from '@/services/usuarios.service';
import { useAuthStore } from '@/store/useAuthStore';

const SE_PIERDE = [
  'Tu perfil y tus preferencias',
  'Tus publicaciones, negocios y fotos',
  'Tus mensajes y tus favoritos',
  'Tu plan, si tienes uno',
];

/**
 * «Eliminar mi cuenta», en su propia pantalla (antes era el bloque rojo más grande de Configuración). Es el derecho de CANCELACIÓN (§29): irreversible y en
 * cascada, así que se dice exactamente qué desaparece (eso hace informado el consentimiento; un «¿estás seguro?» a secas no) y se pide la contraseña.
 *
 * Si el borrado falla NO se navega al login: la persona se iría creyendo que ejerció su derecho sin haberlo ejercido. Entre el 16 y el 19 de septiembre
 * esta llamada falló de verdad en producción.
 */
export default function EliminarCuentaScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const email = useAuthStore((s) => s.session?.user.email);
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  // Un ref y no solo el estado: dos toques en el mismo fotograma pasan antes de que el estado se actualice.
  const enCurso = useRef(false);

  const listo = clave.length > 0 && Boolean(email);

  const eliminar = async () => {
    if (!listo || enCurso.current || !email) return;
    enCurso.current = true;
    setBorrando(true);
    setError(null);
    try {
      // La contraseña, contra el servidor, ANTES de borrar: un teléfono desbloqueado en otras manos no debe poder borrar la cuenta.
      const { error: eClave } = await supabase.auth.signInWithPassword({ email, password: clave });
      if (eClave) return setError('La contraseña no es correcta.');

      await eliminarMiCuenta();
      router.replace('/(auth)/login');
    } catch (e) {
      setError(`No se pudo eliminar la cuenta. ${e instanceof Error ? e.message : 'Intenta de nuevo.'}`);
    } finally {
      enCurso.current = false;
      setBorrando(false);
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
            <ThemedText type="small" themeColor="textSecondary">Antes de seguir, esto es lo que pasará.</ThemedText>

            <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Se borrará para siempre</ThemedText>
              {SE_PIERDE.map((cosa) => (
                <View key={cosa} style={estilos.fila}>
                  <Ionicons name="close" size={18} color={theme.error} />
                  <ThemedText type="small" style={estilos.crece}>{cosa}</ThemedText>
                </View>
              ))}
              <ThemedText type="small" themeColor="textSecondary">No se puede deshacer y no conservamos copia.</ThemedText>
            </View>

            <Campo etiqueta="Tu contraseña" contrasena autoComplete="current-password" value={clave} onChangeText={setClave} />
            {error ? (
              <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="assertive">
                {error}
              </ThemedText>
            ) : null}

            <View style={estilos.botones}>
              <Sello variante="peligro" onPress={eliminar} cargando={borrando} deshabilitado={!listo} accessibilityLabel="Eliminar mi cuenta para siempre">
                Eliminar mi cuenta para siempre
              </Sello>
              <Sello variante="contorno" onPress={() => router.back()} accessibilityLabel="Mejor no, conservar mi cuenta">
                Mejor no, conservar mi cuenta
              </Sello>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  tarjeta: { padding: Spacing.three, gap: Spacing.two, borderWidth: Filete.fino, borderRadius: Radios.hoja },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  crece: { flex: 1 },
  botones: { gap: Spacing.two },
});
