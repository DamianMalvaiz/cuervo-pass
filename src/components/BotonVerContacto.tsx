import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet } from 'react-native';

import { Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';
import { CP, esCodigo } from '@/lib/erroresPostgres';
import { sello } from '@/lib/tacto';

interface Props {
  publicacionId: string;
  titulo: string;
  score?: number | null;
  /** Debe llamar a revelar_contacto() y devolver el número. */
  onRevelar: (publicacionId: string, score?: number | null) => Promise<string>;
  onError: (mensaje: string) => void;
}

// Documento maestro v5 · §25.
//
// Antes esto era un botón de WhatsApp siempre visible, con el número ya
// incrustado en la publicación que el cliente se había bajado. Eso significaba
// que un solo `select` sobre `publicaciones` bajaba la base de teléfonos
// completa.
//
// Ahora el número NO viaja con la publicación: la vista pública no trae esa
// columna. Un toque lo pide a revelar_contacto(), que aplica la cuota diaria y
// deja registro, y recién entonces se abre el deep link. Cambia el modelo de
// privacidad completo y cuesta una llamada de más.
export function BotonVerContacto({ publicacionId, titulo, score, onRevelar, onError }: Props) {
  const theme = useTheme();
  const [cargando, setCargando] = useState(false);

  const abrir = async () => {
    if (cargando) return;
    setCargando(true);
    try {
      const whatsapp = await onRevelar(publicacionId, score);
      // END-37 · EL SELLO, y va aquí y no en el `onPress`. Se estampa cuando la
      // revelación ya ocurrió: quedó una fila en `contactos` y se gastó cuota.
      // Vibrar al tocar habría confirmado el toque, no el hecho — y si la
      // llamada falla, habría confirmado algo que no pasó.
      sello();
      const mensaje = encodeURIComponent(
        `Hola, vi tu publicación "${titulo}" en Cuervo Pass y me interesa.`
      );
      // AUD-17: el prefijo 52 fija México. Es una decisión de alcance declarada
      // en el README y en docs/modelo-amenazas.md, no un descuido.
      await Linking.openURL(`https://wa.me/52${whatsapp.replace(/\D/g, '')}?text=${mensaje}`);
    } catch (e) {
      // END-27 · Por CÓDIGO y no por subcadena. `includes('cuota')` dependía
      // del texto del error, que cambia por versión y por locale — y además
      // habría coincidido con cualquier mensaje que mencionara la palabra.
      onError(
        esCodigo(e, CP.CUOTA_AGOTADA)
          ? 'Llegaste al límite de contactos por hoy. Vuelve mañana.'
          : 'No pudimos obtener el contacto de esta publicación. Intenta de nuevo en un momento.'
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pressable
      style={[styles.boton, { backgroundColor: theme.sello }]}
      onPress={abrir}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel="Ver contacto"
      accessibilityHint="Muestra el WhatsApp de quien publicó y abre la conversación"
      accessibilityState={{ disabled: cargando, busy: cargando }}
    >
      {cargando ? (
        <ActivityIndicator color={theme.selloTexto} />
      ) : (
        <>
          {/* El glifo va en TINTA, no en verde de WhatsApp. Se intentó dejarlo
              verde para conservar la pista del destino, y la medición lo
              descartó: verde #25D366 sobre ámbar #E8A33D da 1.09:1, invisible.
              La pista del destino la sigue dando la FORMA del logotipo, que se
              reconoce en cualquier color; lo que no se recupera es un glifo que
              no se ve. */}
          <Ionicons name="logo-whatsapp" size={20} color={theme.selloTexto} />
          <ThemedText style={[styles.texto, { color: theme.selloTexto }]}>Ver contacto</ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    // EL SELLO. Es la única acción de toda la app que compromete algo —revela
    // un teléfono ajeno y consume cuota— así que es la única con `theme.sello`
    // (carbón en claro, blanco hueso en oscuro), que no se parece al botón primario lima.
    // Antes iba en verde de WhatsApp: prestaba el color del destino, pero dejaba
    // la acción que de verdad compromete sin la tinta que la marca, y ponía un
    // segundo color de marca en el lugar exacto que el sello reserva.
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
  },
  texto: { ...Texto.pesoFuerte },
});
