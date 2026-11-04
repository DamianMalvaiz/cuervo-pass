import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorDeCarga } from '@/components/ficha/ErrorDeCarga';
import { Pulsable } from '@/components/ficha/Pulsable';
import { descripcionDe, insigniaDe } from '@/components/perfil/PerfilVendedor';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { PaginaSesionWeb } from '@/components/web/PaginaSesionWeb';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotoPerfil } from '@/hooks/use-foto-perfil';
import { usePerfilVendedor } from '@/hooks/use-perfil-vendedor';
import { useTheme } from '@/hooks/use-theme';
import { tituloDeLoPropio } from '@/lib/panelVendedor';
import { describirSuscripcion } from '@/lib/planes';

const D = Colors.dark;

/**
 * El perfil de un vendedor en la web: su identidad (con la foto que se cambia desde el avatar y el estado REAL de la verificación) y cuatro tarjetas a lo suyo: lo que ofrece, su verificación, su plan y cómo lo ven. Los mismos datos que el perfil de la app
 * (`usePerfilVendedor`), repartidos en una página ancha. Si no se pudieron leer las funciones no se afirma ningún paso («ni “sin verificar” ni filas que suponen una función»), y un fallo al leer el perfil se dice y se reintenta (END-11).
 */
export function PerfilVendedorWeb() {
  const theme = useTheme();
  const { urlFoto, subiendoFoto, error: errorFoto, cambiarFoto } = useFotoPerfil();
  const { miId, perfil, errorPerfil, cargarPerfil, roles, falloRoles, reintentarRoles, paso, rolDeVerificacion, suscripcion, aEstudiante, cambiando } = usePerfilVendedor();

  const nombre = perfil?.nombre_completo?.trim();
  const inicial = (nombre ?? '?').charAt(0).toUpperCase();
  const insignia = falloRoles ? undefined : insigniaDe(paso);

  const hero =
    !perfil && errorPerfil ? (
      // Falló la lectura y no hay nada que enseñar: se dice, no se pinta «Sin nombre».
      <ErrorDeCarga etiqueta="No pudimos cargar tu perfil" onReintentar={() => miId && void cargarPerfil(miId)} />
    ) : (
      <View style={[estilos.hero, { backgroundColor: theme.background === D.background ? D.backgroundElement : D.background }]}>
        <Pulsable
          onPress={() => void cambiarFoto()}
          disabled={subiendoFoto}
          accessibilityRole="button"
          accessibilityLabel={urlFoto ? 'Cambiar tu foto de perfil' : 'Agregar una foto de perfil'}
          accessibilityState={{ busy: subiendoFoto }}
          style={estilos.envolturaFoto}
        >
          {urlFoto ? (
            <Image source={{ uri: urlFoto }} style={estilos.foto} />
          ) : (
            <View style={[estilos.foto, estilos.sinFoto]}>
              <Text style={[Texto.titulo, { color: D.limaTexto }]}>{inicial}</Text>
            </View>
          )}
          <View style={[estilos.camara, { backgroundColor: theme.bosque, borderColor: D.background }]}>
            <Ionicons name="camera" size={14} color={D.text} />
          </View>
        </Pulsable>
        <View style={estilos.datos}>
          <Text accessibilityRole="header" style={[Texto.seccionWebCompacto, { color: D.text }]} numberOfLines={2}>{nombre ?? 'Tu cuenta'}</Text>
          {perfil?.nombre_usuario ? <ThemedText style={[Texto.cuerpo, { color: D.textSecondary }]}>{`@${perfil.nombre_usuario}`}</ThemedText> : null}
          {insignia ? (
            <View style={[estilos.insignia, { backgroundColor: D.lima }]}>
              <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>{insignia}</ThemedText>
            </View>
          ) : null}
          {errorFoto ? <ThemedText style={[Texto.pequeno, { color: D.textSecondary }]} accessibilityRole="alert">{errorFoto}</ThemedText> : null}
        </View>
      </View>
    );

  return (
    <PaginaSesionWeb titulo="Mi perfil" subtitulo="Tu cuenta de vendedor: lo que ofreces, tu verificación y tu plan.">
      <View style={estilos.cuerpo}>
        {hero}
        {falloRoles ? (
          // No se sabe en qué paso va: ni «Sin verificar» ni tarjetas que suponen una función.
          <ErrorDeCarga etiqueta="No pudimos comprobar tu verificación" onReintentar={reintentarRoles} />
        ) : (
          <View style={estilos.rejilla}>
            <Tarjeta icono="storefront-outline" titulo={tituloDeLoPropio(roles)} texto="Datos, fotos y lo que publicas." boton="Abrir" etiqueta={`Abrir ${tituloDeLoPropio(roles)}`} alPulsar={() => router.push('/(tabs)/publicar')} />
            <Tarjeta icono="shield-checkmark-outline" titulo="Verificación de identidad" texto={descripcionDe(paso)} boton="Ver" etiqueta="Ver mi verificación de identidad" alPulsar={() => router.push({ pathname: '/verificacion/[rol]', params: { rol: rolDeVerificacion } })} />
            <Tarjeta icono="card-outline" titulo="Mi plan y pagos" texto={suscripcion ? describirSuscripcion(suscripcion) : 'Consultando…'} boton="Ver" etiqueta="Ver mi plan y pagos" alPulsar={() => router.push('/pagos')} />
            <Tarjeta
              icono="eye-outline"
              titulo="Cómo me ven"
              texto="Lo que ve otra persona cuando entra a tu ficha."
              boton="Ver"
              etiqueta="Ver cómo me ven"
              alPulsar={miId ? () => router.push({ pathname: '/perfil/[usuarioId]', params: { usuarioId: miId } }) : undefined}
            />
          </View>
        )}
        <View style={[estilos.estudiante, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
          <View style={estilos.estudianteTexto}>
            <ThemedText style={Texto.subtitulo}>Activar mi perfil de estudiante</ThemedText>
            <ThemedText style={Texto.cuerpo} themeColor="textSecondary">¿También buscas depa o roomie? Tu cuenta es la misma. Cambiar de perfil no borra nada de lo que tienes.</ThemedText>
          </View>
          <BotonWeb variante="contorno" onPress={cambiando ? undefined : () => void aEstudiante()} accessibilityLabel="Activar mi perfil de estudiante">{cambiando ? 'Cambiando…' : 'Activar'}</BotonWeb>
        </View>
      </View>
    </PaginaSesionWeb>
  );
}

function Tarjeta({ icono, titulo, texto, boton, etiqueta, alPulsar }: { icono: keyof typeof Ionicons.glyphMap; titulo: string; texto: string; boton: string; etiqueta: string; alPulsar?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[estilos.tarjeta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
      <View style={[estilos.icono, { backgroundColor: theme.tintedSurface }]}>
        <Ionicons name={icono} size={24} color={theme.bosque} />
      </View>
      <ThemedText style={Texto.subtitulo}>{titulo}</ThemedText>
      <ThemedText style={[Texto.cuerpo, estilos.texto]} themeColor="textSecondary">{texto}</ThemedText>
      <View style={estilos.accion}>
        <BotonWeb compacto variante="contorno" onPress={alPulsar} accessibilityLabel={etiqueta}>{boton}</BotonWeb>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cuerpo: { gap: Spacing.four },
  hero: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.four, padding: Spacing.five, borderRadius: Radios.panel },
  envolturaFoto: { width: 104, height: 104 },
  foto: { width: 104, height: 104, borderRadius: Radios.full },
  sinFoto: { backgroundColor: D.lima, alignItems: 'center', justifyContent: 'center' },
  camara: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: Radios.full, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, minWidth: 220, gap: Spacing.one },
  insignia: { alignSelf: 'flex-start', borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, marginTop: Spacing.one },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tarjeta: { flexGrow: 1, flexBasis: 300, minWidth: 0, borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.four, gap: Spacing.two },
  icono: { width: 48, height: 48, borderRadius: Radios.control, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  texto: { flexGrow: 1 },
  accion: { alignItems: 'flex-start', marginTop: Spacing.two },
  estudiante: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.four },
  estudianteTexto: { flex: 1, minWidth: 260, gap: Spacing.one },
});
