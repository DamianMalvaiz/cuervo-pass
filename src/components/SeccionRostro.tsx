import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Casilla } from '@/components/Casilla';
import { Sello } from '@/components/ficha/Sello';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BIOMETRIA_HABILITADA, GUIA_SELFIE, TEXTO_CONSENTIMIENTO, type ResultadoRostro } from '@/lib/rostro';
import { prepararSelfie } from '@/lib/selfie';
import { VERSION_AVISO, type RolVendedor } from '@/lib/verificacion';
import { enviarSelfie } from '@/services/rostro.service';

type Estado = { fase: 'libre' } | { fase: 'enviando' } | { fase: 'aviso'; texto: string } | { fase: 'fin'; texto: string };

const intentos = (n: number) => (n === 1 ? '1 intento' : `${n} intentos`);

/** Lo que se le dice a la persona de cada desenlace: nunca cifras ni la causa (serían un oráculo para afinar una suplantación). */
function textoDe(r: ResultadoRostro): Estado {
  switch (r.tipo) {
    case 'recibida':
      return { fase: 'fin', texto: 'Recibimos tu selfie. Quien revise tu verificación verá el resultado de la comparación.' };
    case 'repetir':
      return { fase: 'aviso', texto: `No pudimos usar esa foto. Toma otra siguiendo la guía. Te quedan ${intentos(r.intentosRestantes)}.` };
    case 'sin_intentos':
      return { fase: 'fin', texto: 'Ya usaste tus intentos. Tu verificación sigue su curso con la revisión de una persona.' };
    case 'no_disponible':
      return { fase: 'fin', texto: 'La comparación de rostro no está disponible ahora. Tu verificación sigue igual, con revisión de una persona.' };
    default:
      return { fase: 'aviso', texto: 'No pudimos enviar tu selfie. Revisa tu conexión e intenta de nuevo.' };
  }
}

/**
 * Verificación de rostro (fase 6): opcional, con un consentimiento APARTE del de los documentos.
 *
 * Solo aparece cuando el aviso de privacidad ya cubre la biometría (`BIOMETRIA_HABILITADA`). La selfie sale de la cámara
 * frontal en el momento —no de la galería— y se manda sin guardarse. Es una ayuda para quien revisa; no aprueba nada.
 */
export function SeccionRostro({ rol }: { rol: RolVendedor }) {
  const theme = useTheme();
  const [consiente, setConsiente] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: 'libre' });

  if (!BIOMETRIA_HABILITADA) return null;

  const tomar = async () => {
    setEstado({ fase: 'enviando' });
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setEstado({ fase: 'aviso', texto: 'Necesitamos el permiso de la cámara para tomar la selfie. Puedes darlo en los Ajustes del teléfono.' });
      return;
    }
    const foto = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: false,
      quality: 0.9,
    });
    if (foto.canceled || !foto.assets[0]?.uri) {
      setEstado({ fase: 'libre' });
      return;
    }
    let base64: string;
    try {
      base64 = await prepararSelfie(foto.assets[0].uri);
    } catch {
      setEstado({ fase: 'aviso', texto: 'No pudimos preparar la foto. Intenta de nuevo.' });
      return;
    }
    setEstado(textoDe(await enviarSelfie(rol, base64, VERSION_AVISO)));
  };

  const terminado = estado.fase === 'fin';

  return (
    <View style={[estilos.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <View style={estilos.encabezado}>
        <Ionicons name="scan-outline" size={22} color={theme.bosque} />
        <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte]}>Verifica tu rostro (opcional)</ThemedText>
      </View>
      {terminado ? (
        <ThemedText type="small" themeColor="textSecondary" style={estilos.texto} accessibilityLiveRegion="polite">
          {estado.texto}
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={estilos.texto}>
            Compararemos una selfie con la foto de tu INE para ayudar a quien revisa tu verificación. Puedes omitirlo.
          </ThemedText>
          {GUIA_SELFIE.map((linea) => (
            <ThemedText key={linea} type="small" themeColor="textSecondary" style={estilos.texto}>
              {`• ${linea}`}
            </ThemedText>
          ))}
          <Casilla valor={consiente} onCambiar={setConsiente} etiqueta={TEXTO_CONSENTIMIENTO.etiqueta} ayuda={TEXTO_CONSENTIMIENTO.ayuda} />
          {estado.fase === 'aviso' ? (
            <ThemedText type="small" style={{ color: theme.error }} accessibilityLiveRegion="polite">
              {estado.texto}
            </ThemedText>
          ) : null}
          <Sello
            onPress={() => void tomar()}
            icono="camera-outline"
            cargando={estado.fase === 'enviando'}
            deshabilitado={!consiente}
            variante="contorno"
            accessibilityLabel="Tomar selfie"
          >
            Tomar selfie
          </Sello>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  panel: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.three, gap: Spacing.two },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  texto: { lineHeight: 22 },
});
