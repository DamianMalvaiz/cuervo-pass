import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotoPerfil } from '@/hooks/use-foto-perfil';
import { useTheme } from '@/hooks/use-theme';
import { usePerfilStore } from '@/store/usePerfilStore';

/**
 * La tarjeta de identidad del perfil: foto (con la cámara SOBRE ella), nombre, usuario y, si la hay, la universidad. Es la misma para el perfil de
 * estudiante y el de vendedor; lo que cambia es lo que va debajo (`children`) y la etiqueta de estado (`insignia`).
 *
 * Cambiar la foto vive aquí, con sus tres caminos: sin permiso se explica (con «Ajustes» si el sistema ya no volverá a preguntar), cancelar el
 * selector no hace nada, y subir guarda la RUTA, no la uri local. Un fallo se dice y el botón vuelve a su estado: sin el `finally`, un fallo
 * lo dejaba deshabilitado hasta reiniciar la app.
 */
export function TarjetaIdentidad({ insignia, children }: { insignia?: string; children?: ReactNode }) {
  const theme = useTheme();
  const { perfil } = usePerfilStore();
  const { urlFoto, subiendoFoto, error, cambiarFoto: onCambiarFoto } = useFotoPerfil();

  return (
    <>
      <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
        <View style={estilos.identidad}>
          <Pulsable
            onPress={onCambiarFoto}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel={urlFoto ? 'Cambiar tu foto de perfil' : 'Agregar una foto de perfil'}
            accessibilityState={{ busy: subiendoFoto }}
            style={estilos.envolturaFoto}
          >
            {urlFoto ? (
              <Image source={{ uri: urlFoto }} style={[estilos.foto, { borderColor: theme.filete }]} />
            ) : (
              <View style={[estilos.foto, estilos.sinFoto, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Ionicons name="person-outline" size={34} color={theme.textSecondary} />
              </View>
            )}
            {/* La afordancia va SOBRE la foto, no como texto debajo: ahí es donde la mano espera encontrarla. */}
            <View style={[estilos.insigniaCamara, { backgroundColor: theme.bosque, borderColor: theme.background }]}>
              {subiendoFoto ? (
                <ActivityIndicator size="small" color={theme.bosqueTexto} />
              ) : (
                <Ionicons name="camera" size={16} color={theme.bosqueTexto} />
              )}
            </View>
          </Pulsable>

          <View style={estilos.datosIdentidad}>
            <ThemedText type="subtitle" numberOfLines={2}>
              {perfil?.nombre_completo ?? 'Sin nombre'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              @{perfil?.nombre_usuario ?? '—'}
            </ThemedText>
            {perfil?.universidad ? (
              <View style={estilos.universidad}>
                <Ionicons name="business-outline" size={16} color={theme.textSecondary} style={estilos.iconoUniversidad} />
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={estilos.flexible}>
                  {perfil.universidad}
                </ThemedText>
              </View>
            ) : null}
            {insignia ? (
              <View style={[estilos.insignia, { backgroundColor: theme.tintedSurface, borderColor: theme.tintedBorder }]}>
                <ThemedText type="small" style={Texto.pesoFuerte}>
                  {insignia}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        {children}
      </View>

      {error && (
        <View style={[estilos.errorBloque, { borderColor: theme.error }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
          <ThemedText type="small" style={[{ color: theme.error }, estilos.flexible]} accessibilityLiveRegion="assertive">
            {error}
          </ThemedText>
        </View>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.three, gap: Spacing.three },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  envolturaFoto: { width: 88, height: 88 },
  foto: { width: 88, height: 88, borderRadius: 44, borderWidth: Filete.fino },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  insigniaCamara: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datosIdentidad: { flex: 1, gap: Spacing.half },
  // El icono se alinea con la PRIMERA línea (no flota entre dos) y es simétrico: el gorro de graduación se veía inclinado.
  universidad: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one, marginTop: Spacing.half },
  iconoUniversidad: { marginTop: 2 },
  insignia: {
    alignSelf: 'flex-start',
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    marginTop: Spacing.one,
  },
  flexible: { flex: 1 },
  errorBloque: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
    padding: Spacing.three,
  },
});
