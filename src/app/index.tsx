import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet } from 'react-native';

import { BloqueEstado } from '@/components/ficha/BloqueEstado';
import { ParaTiWeb } from '@/components/web/ParaTiWeb';
import { PortadaWeb } from '@/components/web/PortadaWeb';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Texto } from '@/constants/theme';
import { destinoInicial, type PerfilActivo } from '@/lib/perfilActivo';
import { aviso } from '@/lib/registro';
import { VERSION_AVISO } from '@/lib/verificacion';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// Documento maestro v5 · §26 — el guard de sesión tiene TRES estados, no dos:
//
//   sin sesión                      → login (en la web, la portada pública, que se queda en `/`)
//   con sesión, aviso sin aceptar   → aviso (la versión vigente; migración 0059)
//   con sesión, sin cuestionario    → cuestionario
//   con sesión y cuestionario       → pestañas
//
// El tercero es el que v3 olvidaba. Un usuario con sesión pero sin cuestionario
// llega a una pantalla de sugerencias vacía y parece que la app está rota.
//
// v3 lo aproximaba con `universidad is not null`, que es una proxy frágil:
// alguien que guardó universidad y abandonó antes del presupuesto pasaba el
// filtro igual. Ahora hay una columna explícita, `cuestionario_completo`, que
// se escribe una sola vez al terminar de verdad.
type EstadoCuestionario = 'completo' | 'incompleto' | 'aviso' | 'error';

export default function Index() {
  const { session, cargando, cargarSesionInicial } = useAuthStore();
  // Qué se supo del cuestionario Y de quién. Con el id adentro, una respuesta de
  // una cuenta anterior no puede pasar por la de la actual: no hace falta
  // reiniciar nada al cambiar de usuario, solo comparar.
  const [resultado, setResultado] = useState<{ usuarioId: string; estado: EstadoCuestionario; perfil: PerfilActivo | null } | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (supabaseConfigurado) cargarSesionInicial();
  }, [cargarSesionInicial]);

  const usuarioId = session?.user.id;

  useEffect(() => {
    if (!usuarioId) return;
    let activo = true;
    const terminar = (estado: EstadoCuestionario, perfil: PerfilActivo | null = null) => {
      if (activo) setResultado({ usuarioId, estado, perfil });
    };
    supabase
      .from('usuarios')
      .select('cuestionario_completo, version_aviso_aceptada, perfil_activo')
      .eq('id', usuarioId)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          // Invariante 2 · «falló la lectura» y «no hay dato» son estados
          // distintos. Antes se ignoraba `error`: con la red caída `data` era
          // null, `Boolean(null?.…)` es false, y quien YA completó el
          // cuestionario era mandado a repetirlo —y a sobrescribir sus
          // preferencias— por un fallo de wifi.
          if (error) {
            aviso('No se pudo leer cuestionario_completo', { detalle: error.message });
            terminar('error');
            return;
          }
          // Sin fila en `usuarios` (registro interrumpido entre el signUp y el
          // alta del perfil) SÍ es «sin cuestionario»: que lo haga ahora.
          // El aviso va ANTES que el cuestionario: no se piden más datos a quien no aceptó cómo se tratan. Sin fila no hay nada que
          // aceptar todavía (el alta se interrumpió): sigue el camino de siempre. Un FALLO de lectura nunca llega aquí (se trata arriba).
          if (data && data.version_aviso_aceptada !== VERSION_AVISO) {
            terminar('aviso');
            return;
          }
          terminar(data?.cuestionario_completo ? 'completo' : 'incompleto', data?.perfil_activo === 'vendedor' ? 'vendedor' : 'estudiante');
        },
        // Sin esta rama, una excepción dejaba el indicador girando para siempre.
        (e) => {
          aviso('La lectura de cuestionario_completo no respondió', undefined, e);
          terminar('error');
        }
      );
    return () => {
      activo = false;
    };
  }, [usuarioId, intento]);

  const estado = resultado && resultado.usuarioId === usuarioId ? resultado.estado : null;

  const reintentar = () => {
    setResultado(null);
    setIntento((n) => n + 1);
  };

  if (!supabaseConfigurado) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.titulo}>
          Falta configurar Supabase
        </ThemedText>
        <ThemedText type="small">
          Copia .env.example a .env y completa EXPO_PUBLIC_SUPABASE_URL y
          EXPO_PUBLIC_SUPABASE_ANON_KEY con los datos de tu proyecto (Project Settings → API),
          luego reinicia `npx expo start`.
        </ThemedText>
      </ThemedView>
    );
  }

  if (cargando || (session && estado === null)) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  // La web se explora sin cuenta (migración 0090): quien llega sin sesión ve la portada pública EN `/` (no se redirige: la dirección del inicio es la raíz). En el teléfono, el login de siempre.
  if (!session) return Platform.OS === 'web' ? <PortadaWeb /> : <Redirect href="/(auth)/login" />;

  // Un fallo no redirige a ninguna parte: ni al cuestionario ni a las pestañas,
  // porque no se sabe a cuál toca. Se dice y se ofrece reintentar.
  if (estado === 'error') {
    return (
      <ThemedView style={styles.container}>
        <BloqueEstado
          etiqueta="No pudimos entrar"
          mensaje="No pudimos comprobar tu cuenta. Revisa tu conexión y vuelve a intentarlo."
          icono="cloud-offline-outline"
          tono="alerta"
        />
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </ThemedView>
    );
  }

  if (estado === 'aviso') return <Redirect href="/aviso-actualizado" />;

  // 0083: un vendedor entra por su panel y no pasa por el cuestionario de estudiante.
  const perfil = resultado && resultado.usuarioId === usuarioId ? resultado.perfil : null;
  // En la web, quien busca y ya hizo todo cae en «Para ti» (la portada de dentro); el vendedor y quien aún no hizo el cuestionario siguen sus caminos.
  if (Platform.OS === 'web' && perfil !== 'vendedor' && estado === 'completo') return <ParaTiWeb />;
  return <Redirect href={destinoInicial(perfil, estado === 'completo')} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  titulo: Texto.tituloMedio,
});
