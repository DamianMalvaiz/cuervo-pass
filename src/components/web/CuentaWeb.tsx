import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { usePerfilActivo } from '@/hooks/queries/usePerfilActivo';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useTheme } from '@/hooks/use-theme';
import { puedePublicar } from '@/lib/funciones';
import { pestanasVisibles } from '@/lib/perfilActivo';
import { useAuthStore } from '@/store/useAuthStore';

const D = Colors.dark;
// Una capa que cubre la ventana para cerrar el menú al tocar fuera (RN no tiene `position: fixed`; React Native Web sí lo deja pasar al CSS).
const CAPA = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 } as unknown as ViewStyle;
const MENU = { 'aria-haspopup': 'menu' } as object;

type Ruta = '/(tabs)/favoritos' | '/(tabs)/chats' | '/(tabs)/perfil' | '/(tabs)/panel' | '/(tabs)/publicar' | '/configuracion';

/**
 * El grupo de cuenta de los encabezados de la web. Sin sesión: «Iniciar sesión» y «Crear cuenta» (en el teléfono, solo la primera). Con sesión: Favoritos y Chats a la mano (solo en pantalla ancha: en el
 * teléfono los lleva la barra de abajo) y el menú de la cuenta, con la inicial de la persona. Lo que el menú ofrece lo decide el perfil de la cuenta: un vendedor ve su panel; un estudiante, sus favoritos.
 * `tono="oscuro"` es para sobre el carbón del hero (que no cambia con el modo).
 */
export function CuentaWeb({ escritorio, telefono = false, tono }: { escritorio: boolean; telefono?: boolean; tono: 'claro' | 'oscuro' }) {
  const sesion = useAuthStore((s) => s.session);
  if (!sesion) {
    return (
      <View style={estilos.fila}>
        <BotonWeb compacto={!escritorio} variante={tono === 'oscuro' ? 'contornoClaro' : 'contorno'} onPress={() => router.push('/(auth)/login')}>Iniciar sesión</BotonWeb>
        {telefono ? null : <BotonWeb compacto={!escritorio} variante={tono === 'oscuro' ? 'lima' : 'carbon'} onPress={() => router.push('/(auth)/registro')}>Crear cuenta</BotonWeb>}
      </View>
    );
  }
  return <CuentaConSesion usuarioId={sesion.user.id} nombre={nombreDe(sesion.user)} escritorio={escritorio} telefono={telefono} tono={tono} />;
}

function nombreDe(u: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const meta = u.user_metadata ?? {};
  const candidato = [meta.nombre_completo, meta.nombre_usuario, u.email].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  return candidato?.trim() ?? '?';
}

function CuentaConSesion({ usuarioId, nombre, escritorio, telefono, tono }: { usuarioId: string; nombre: string; escritorio: boolean; telefono: boolean; tono: 'claro' | 'oscuro' }) {
  const theme = useTheme();
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [abierto, setAbierto] = useState(false);
  const { roles } = useMisRoles(usuarioId);
  const { perfil } = usePerfilActivo(usuarioId);
  const visibles = pestanasVisibles(perfil, puedePublicar(roles));
  const color = tono === 'oscuro' ? D.text : theme.text;

  useEffect(() => {
    if (!abierto || Platform.OS !== 'web') return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [abierto]);

  const ir = (ruta: Ruta) => {
    setAbierto(false);
    router.push(ruta);
  };
  const salir = () => {
    setAbierto(false);
    void cerrarSesion();
  };
  const entradas: { ruta: Ruta; texto: string; icono: keyof typeof Ionicons.glyphMap }[] = [
    { ruta: '/(tabs)/perfil', texto: 'Perfil', icono: 'person-circle-outline' },
    // Donde no cabe arriba (pantalla angosta), Favoritos vive en el menú (Chats ya está en la barra de abajo).
    ...(!escritorio && visibles.includes('favoritos') ? [{ ruta: '/(tabs)/favoritos' as const, texto: 'Favoritos', icono: 'heart-outline' as const }] : []),
    ...(visibles.includes('panel') ? [{ ruta: '/(tabs)/panel' as const, texto: 'Mi panel', icono: 'grid-outline' as const }] : []),
    ...(visibles.includes('publicar') ? [{ ruta: '/(tabs)/publicar' as const, texto: 'Publicar', icono: 'add-circle-outline' as const }] : []),
    { ruta: '/configuracion', texto: 'Configuración', icono: 'settings-outline' },
  ];

  return (
    <View style={estilos.fila}>
      {escritorio && visibles.includes('favoritos') ? <Acceso etiqueta="Favoritos" icono="heart-outline" color={color} onPress={() => ir('/(tabs)/favoritos')} /> : null}
      {escritorio && visibles.includes('chats') ? <Acceso etiqueta="Chats" icono="chatbubble-outline" color={color} onPress={() => ir('/(tabs)/chats')} /> : null}
      <View>
        <Pulsable
          onPress={() => setAbierto((a) => !a)}
          accessibilityRole="button"
          accessibilityLabel="Menú de la cuenta"
          {...MENU}
          aria-expanded={abierto}
          style={[estilos.avatar, { backgroundColor: tono === 'oscuro' ? D.lima : theme.sello }]}
        >
          <Text style={[Texto.subtitulo, { color: tono === 'oscuro' ? D.limaTexto : theme.selloTexto }]}>{nombre.charAt(0).toUpperCase()}</Text>
        </Pulsable>
        {abierto ? (
          <>
            <Pulsable onPress={() => setAbierto(false)} accessibilityLabel="Cerrar el menú" style={CAPA} />
            <View role="menu" style={[estilos.menu, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
              {telefono ? null : (
                <View style={[estilos.cabecera, { borderBottomColor: theme.filete }]}>
                  <ThemedText style={Texto.pequenoFuerte} numberOfLines={1}>{nombre}</ThemedText>
                </View>
              )}
              {entradas.map((e) => (
                <Pulsable key={e.texto} onPress={() => ir(e.ruta)} accessibilityRole="menuitem" accessibilityLabel={e.texto} style={estilos.entrada}>
                  <Ionicons name={e.icono} size={20} color={theme.text} />
                  <ThemedText style={Texto.pequenoFuerte}>{e.texto}</ThemedText>
                </Pulsable>
              ))}
              <Pulsable onPress={salir} accessibilityRole="menuitem" accessibilityLabel="Cerrar sesión" style={[estilos.entrada, estilos.separada, { borderTopColor: theme.filete }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.text} />
                <ThemedText style={Texto.pequenoFuerte}>Cerrar sesión</ThemedText>
              </Pulsable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function Acceso({ etiqueta, icono, color, onPress }: { etiqueta: string; icono: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }) {
  return (
    <Pulsable onPress={onPress} accessibilityRole="link" accessibilityLabel={etiqueta} style={estilos.acceso}>
      <Ionicons name={icono} size={24} color={color} />
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  acceso: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute',
    top: 52,
    right: 0,
    minWidth: 240,
    zIndex: 30,
    borderWidth: Filete.fino,
    borderRadius: Radios.tarjeta,
    paddingVertical: Spacing.two,
    boxShadow: '0px 24px 48px -20px rgba(10, 14, 11, 0.5)',
  },
  cabecera: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, marginBottom: Spacing.one, borderBottomWidth: Filete.fino },
  entrada: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 44, paddingHorizontal: Spacing.four },
  separada: { borderTopWidth: Filete.fino, marginTop: Spacing.one },
});
