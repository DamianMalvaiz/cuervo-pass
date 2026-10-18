import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Campo } from '@/components/Campo';
import { Casilla } from '@/components/Casilla';
import { SeccionRostro } from '@/components/SeccionRostro';
import { Pulsable } from '@/components/ficha/Pulsable';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useMisRoles } from '@/hooks/queries/useRoles';
import { useEnviarVerificacion, useMiVerificacion } from '@/hooks/queries/useVerificacion';
import { useTamanoPantalla } from '@/hooks/use-tamano-pantalla';
import { useTheme } from '@/hooks/use-theme';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { avisarPermisoDeFotosDenegado } from '@/lib/permisos';
import { toast } from '@/lib/toast';
import {
  MAX_FOTOS_LUGAR,
  esRolVendedor,
  validarVerificacion,
  type ErroresVerificacion,
  type RolVendedor,
} from '@/lib/verificacion';
import { useAuthStore } from '@/store/useAuthStore';

/** Abre la galería y devuelve la URI elegida, o `null` si se canceló o no hay permiso. */
async function elegirFoto(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    avisarPermisoDeFotosDenegado(permiso.canAskAgain);
    return null;
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
}

function SelectorFoto({
  etiqueta,
  uri,
  error,
  onElegir,
}: {
  etiqueta: string;
  uri: string | null;
  error?: string;
  onElegir: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={estilos.bloque}>
      <Pulsable
        onPress={onElegir}
        accessibilityRole="button"
        accessibilityLabel={uri ? `Cambiar: ${etiqueta}` : `Elegir: ${etiqueta}`}
        style={[estilos.selector, { borderColor: error ? theme.error : theme.filete, backgroundColor: theme.backgroundElement }]}
      >
        {uri ? (
          <Image source={{ uri }} style={estilos.miniatura} contentFit="cover" />
        ) : (
          <View style={[estilos.miniatura, estilos.sinMiniatura, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="camera-outline" size={22} color={theme.textSecondary} />
          </View>
        )}
        <View style={estilos.textos}>
          <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>{etiqueta}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {uri ? 'Toca para cambiarla' : 'Toca para elegirla de tu galería'}
          </ThemedText>
        </View>
      </Pulsable>
      {error ? (
        <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Verificación de vendedor · Cuervo 360 (migración 0049).
 *
 * Quien agregó la función de comerciante o arrendador entrega aquí su nombre legal, dirección, INE (frente y reverso) y
 * fotos del lugar. Un admin la revisa a mano. Hasta que la apruebe, la función existe pero no da acceso a publicar. La
 * pantalla dice en qué estado va (en revisión, rechazada con su motivo, verificada) y solo muestra el formulario
 * cuando se puede enviar.
 */
export default function VerificacionScreen() {
  const theme = useTheme();
  const { rol: rolParam } = useLocalSearchParams<{ rol: string }>();
  const { anchoContenido, clase } = useTamanoPantalla();
  const miId = useAuthStore((s) => s.session?.user.id);

  const rolValido = esRolVendedor(rolParam);
  const rol = (rolValido ? rolParam : 'comerciante') as RolVendedor;
  const { roles, cargando: cargandoRoles, fallo: falloRoles, reintentar } = useMisRoles(miId);
  const { verificacion } = useMiVerificacion(miId, rol);
  const enviar = useEnviarVerificacion(miId);

  const [nombreLegal, setNombreLegal] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ineFrente, setIneFrente] = useState<string | null>(null);
  const [ineReverso, setIneReverso] = useState<string | null>(null);
  const [fotosLugar, setFotosLugar] = useState<string[]>([]);
  const [consiente, setConsiente] = useState(false);
  const [errores, setErrores] = useState<ErroresVerificacion>({});

  const envoltura = (hijos: React.ReactNode) => (
    <ThemedView style={estilos.pantalla}>
      <ScrollView
        contentContainerStyle={[estilos.desplazable, clase === 'amplia' && estilos.centradoAmplio]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[estilos.columna, { maxWidth: anchoContenido }]}>{hijos}</View>
      </ScrollView>
    </ThemedView>
  );

  if (!rolValido) {
    return envoltura(<ThemedText themeColor="textSecondary">Esta pantalla no existe.</ThemedText>);
  }

  const titulo = rol === 'comerciante' ? 'Verificación de comerciante' : 'Verificación de arrendador';
  const etiquetaDireccion = rol === 'comerciante' ? 'Dirección de tu negocio' : 'Dirección del inmueble';

  if (cargandoRoles) {
    return envoltura(
      <ThemedText type="small" themeColor="textSecondary" accessibilityLabel="Cargando">
        Cargando…
      </ThemedText>
    );
  }

  if (falloRoles) {
    return envoltura(
      <>
        <ThemedText type="small" themeColor="textSecondary">
          No pudimos cargar tus funciones. Revisa tu conexión e intenta de nuevo.
        </ThemedText>
        <Sello onPress={reintentar} icono="refresh" accessibilityLabel="Reintentar">
          Reintentar
        </Sello>
      </>
    );
  }

  const miRol = roles.find((r) => r.rol === rol);
  if (!miRol) {
    return envoltura(
      <>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Primero agrega esta función desde tu perfil, en «Tus funciones».
        </ThemedText>
      </>
    );
  }

  if (miRol.estado === 'pendiente') {
    return envoltura(
      <>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <View style={[estilos.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <Ionicons name="time-outline" size={24} color={theme.bosque} />
          <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>En revisión</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={estilos.texto}>
            Recibimos tus documentos y una persona del equipo los revisa a mano. Mientras tanto no puedes publicar.
          </ThemedText>
        </View>
        <SeccionRostro rol={rol} />
      </>
    );
  }

  if (miRol.estado === 'aprobado') {
    return envoltura(
      <>
        <ThemedText type="subtitle">{titulo}</ThemedText>
        <View style={[estilos.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
          <Ionicons name="checkmark-circle" size={24} color={theme.bosque} />
          <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>
            {miRol.origen === 'migracion' ? 'Función heredada' : 'Verificada'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={estilos.texto}>
            {miRol.origen === 'migracion'
              ? 'Ya publicabas antes de que existiera la verificación, así que conservas el acceso. No pasó por una revisión.'
              : 'Ya puedes publicar. Tu INE se borra de nuestros servidores 30 días después de la aprobación.'}
          </ThemedText>
        </View>
      </>
    );
  }

  const elegir = async (poner: (uri: string) => void) => {
    const uri = await elegirFoto();
    if (uri) poner(uri);
  };

  const onEnviar = () => {
    const e = validarVerificacion({ nombreLegal, direccion, ineFrente, ineReverso, fotosLugar, consiente }, rol);
    setErrores(e);
    if (Object.keys(e).length > 0 || !ineFrente || !ineReverso) return;
    enviar.mutate(
      { rol, nombreLegal, direccion, ineFrente, ineReverso, fotosLugar },
      {
        onSuccess: () => {
          toast.exito('Enviamos tu verificación. La revisamos a mano.');
          router.back();
        },
        onError: (err) =>
          toast.error(
            esCodigo(err, CP.VERIFICACION_NO_ENVIABLE)
              ? 'Esta verificación ya no se puede enviar. Revisa su estado en tu perfil.'
              : 'No pudimos enviar tu verificación. Revisa tu conexión e intenta de nuevo.'
          ),
      }
    );
  };

  return envoltura(
    <>
      <ThemedText type="subtitle">{titulo}</ThemedText>
      <ThemedText themeColor="textSecondary" style={estilos.texto}>
        Para publicar necesitamos confirmar quién eres. Revisamos tus documentos a mano, una sola vez.
      </ThemedText>

      {miRol.estado === 'rechazado' ? (
        <View style={[estilos.panel, { borderColor: theme.error, backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte, { color: theme.error }]}>
            Tu verificación fue rechazada
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={estilos.texto}>
            {verificacion?.motivo_rechazo
              ? `Motivo: ${verificacion.motivo_rechazo}`
              : 'Corrige lo que haga falta y vuelve a enviarla.'}
          </ThemedText>
        </View>
      ) : null}

      <Campo
        etiqueta="Nombre completo (como en tu INE)"
        value={nombreLegal}
        onChangeText={setNombreLegal}
        error={errores.nombreLegal}
        autoCapitalize="words"
        maxLength={120}
      />
      <Campo
        etiqueta={etiquetaDireccion}
        value={direccion}
        onChangeText={setDireccion}
        error={errores.direccion}
        maxLength={200}
      />

      <SelectorFoto
        etiqueta="Foto del frente de tu INE"
        uri={ineFrente}
        error={errores.ineFrente}
        onElegir={() => void elegir(setIneFrente)}
      />
      <SelectorFoto
        etiqueta="Foto del reverso de tu INE"
        uri={ineReverso}
        error={errores.ineReverso}
        onElegir={() => void elegir(setIneReverso)}
      />

      <View style={estilos.bloque}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {rol === 'comerciante' ? 'Fotos de tu negocio' : 'Fotos del inmueble'} ({fotosLugar.length}/{MAX_FOTOS_LUGAR})
        </ThemedText>
        {fotosLugar.map((uri, i) => (
          <View key={uri} style={estilos.filaFoto}>
            <Image source={{ uri }} style={estilos.miniatura} contentFit="cover" />
            <ThemedText style={estilos.textos}>Foto {i + 1}</ThemedText>
            <Pulsable
              onPress={() => setFotosLugar((f) => f.filter((x) => x !== uri))}
              accessibilityRole="button"
              accessibilityLabel={`Quitar la foto ${i + 1}`}
              style={estilos.quitar}
            >
              <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
            </Pulsable>
          </View>
        ))}
        {fotosLugar.length < MAX_FOTOS_LUGAR ? (
          <Pulsable
            onPress={() => void elegir((uri) => setFotosLugar((f) => [...f, uri]))}
            accessibilityRole="button"
            accessibilityLabel="Agregar una foto del lugar"
            style={[estilos.agregar, { borderColor: errores.fotosLugar ? theme.error : theme.filete, backgroundColor: theme.backgroundElement }]}
          >
            <Ionicons name="add" size={20} color={theme.bosque} />
            <ThemedText style={Texto.pesoFuerte}>Agregar foto</ThemedText>
          </Pulsable>
        ) : null}
        {errores.fotosLugar ? (
          <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="polite">
            {errores.fotosLugar}
          </ThemedText>
        ) : null}
      </View>

      <Casilla
        valor={consiente}
        onCambiar={setConsiente}
        etiqueta="Acepto que revisen mis documentos para verificar mi identidad"
        ayuda="Tu INE se borra de nuestros servidores 30 días después de aprobada."
      />
      {errores.consiente ? (
        <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="polite">
          {errores.consiente}
        </ThemedText>
      ) : null}
      <Pulsable
        onPress={() => router.push('/aviso-privacidad')}
        accessibilityRole="link"
        accessibilityLabel="Leer el aviso de privacidad"
        style={estilos.enlace}
      >
        <ThemedText type="small" themeColor="acento">
          Leer el aviso de privacidad
        </ThemedText>
      </Pulsable>

      <Sello onPress={onEnviar} cargando={enviar.isPending} accessibilityLabel="Enviar a revisión">
        Enviar a revisión
      </Sello>
    </>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  desplazable: { padding: Spacing.three, paddingBottom: Spacing.six },
  centradoAmplio: { alignItems: 'center' },
  columna: { width: '100%', gap: Spacing.three },
  bloque: { gap: Spacing.two },
  texto: { lineHeight: 22 },
  textos: { flex: 1, gap: Spacing.half },
  panel: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.three, gap: Spacing.two },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 72,
    padding: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.tarjeta,
  },
  miniatura: { width: 56, height: 56, borderRadius: Radios.control },
  sinMiniatura: { alignItems: 'center', justifyContent: 'center' },
  filaFoto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  quitar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  agregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 48,
    borderWidth: Filete.fino,
    borderRadius: Radios.control,
  },
  enlace: { minHeight: 44, justifyContent: 'center' },
});
