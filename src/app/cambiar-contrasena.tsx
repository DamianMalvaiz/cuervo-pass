import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { RequisitosPassword } from '@/components/RequisitosPassword';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { evaluarPassword } from '@/lib/password';
import { fallo } from '@/lib/registro';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/useAuthStore';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * Cambiar contraseña, dentro de la app (antes solo existía «Olvidé mi contraseña», que manda un código al correo).
 *
 * Pide la ACTUAL y la comprueba contra el servidor ANTES de tocar nada: quien deja el teléfono desbloqueado no debe poder cambiar la contraseña de otra
 * persona. La nueva cumple los mismos requisitos que al registrarse (los de `lib/password`) y tiene que ser distinta de la actual. Al cambiarla se cierran
 * las OTRAS sesiones (`signOut({ scope: 'others' })`): es lo que la pantalla promete, y si esa parte falla, la contraseña igual ya cambió y se sigue.
 */
export default function CambiarContrasenaScreen() {
  const theme = useTheme();
  const { anchoContenido, clase } = useTamanoPantalla();
  const email = useAuthStore((s) => s.session?.user.email);
  const { perfil } = usePerfilStore();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Un ref y no solo el estado: dos toques en el mismo fotograma pasan antes de que el estado se actualice.
  const enCurso = useRef(false);

  const { valida } = evaluarPassword(nueva, { email, nombreUsuario: perfil?.nombre_usuario, nombre: perfil?.nombre_completo });
  const igualALaActual = nueva.length > 0 && nueva === actual;
  const noCoincide = repite.length > 0 && repite !== nueva;
  const listo = actual.length > 0 && valida && !igualALaActual && repite === nueva && Boolean(email);

  const guardar = async () => {
    if (!listo || enCurso.current || !email) return;
    enCurso.current = true;
    setGuardando(true);
    setError(null);
    try {
      // 1 · La actual, contra el servidor. Sin esto, cualquiera con el teléfono desbloqueado cambiaría la contraseña.
      const { error: eActual } = await supabase.auth.signInWithPassword({ email, password: actual });
      if (eActual) return setError('La contraseña actual no es correcta.');

      // 2 · El cambio.
      const { error: eCambio } = await supabase.auth.updateUser({ password: nueva });
      if (eCambio) return setError('No pudimos cambiar la contraseña. Inténtalo de nuevo.');

      // 3 · Las otras sesiones. Si falla, la contraseña YA cambió: no se tumba el éxito, se registra.
      const { error: eSesiones } = await supabase.auth.signOut({ scope: 'others' });
      if (eSesiones) fallo('No se cerraron las otras sesiones tras cambiar la contraseña', { detalle: eSesiones.message });

      toast.exito('Contraseña actualizada');
      router.back();
    } catch {
      setError('No pudimos cambiar la contraseña. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      enCurso.current = false;
      setGuardando(false);
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
            <ThemedText type="small" themeColor="textSecondary">
              Por seguridad, primero escribe la que usas ahora.
            </ThemedText>

            <Campo etiqueta="Contraseña actual" contrasena autoComplete="current-password" value={actual} onChangeText={setActual} />
            <Campo
              etiqueta="Contraseña nueva"
              contrasena
              autoComplete="new-password"
              value={nueva}
              onChangeText={setNueva}
              error={igualALaActual ? 'La contraseña nueva debe ser distinta de la actual' : undefined}
            />
            <RequisitosPassword
              password={nueva}
              contexto={{ email, nombreUsuario: perfil?.nombre_usuario, nombre: perfil?.nombre_completo }}
            />
            <Campo
              etiqueta="Repite la contraseña nueva"
              contrasena
              autoComplete="new-password"
              value={repite}
              onChangeText={setRepite}
              error={noCoincide ? 'Las contraseñas no coinciden' : undefined}
            />

            {error ? (
              <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="assertive">
                {error}
              </ThemedText>
            ) : null}

            <Sello onPress={guardar} cargando={guardando} deshabilitado={!listo} accessibilityLabel="Guardar contraseña">
              Guardar contraseña
            </Sello>
            <ThemedText type="small" themeColor="textSecondary" style={estilos.nota}>
              Al cambiarla, cerramos tu sesión en los demás dispositivos.
            </ThemedText>
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
  nota: { textAlign: 'center' },
});
