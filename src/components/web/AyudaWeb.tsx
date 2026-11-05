import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { BloqueInfoWeb, PaginaInfoWeb } from '@/components/web/InfoWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CORREO_RESPONSABLE } from '@/lib/avisoPrivacidad';
import { RutasWeb } from '@/lib/rutasWeb';

/** Cada respuesta dice lo que la app HACE hoy (las frases salen del aviso de privacidad, los términos y las pantallas); nada que no se cumpla. */
export const PREGUNTAS: { p: string; r: string }[] = [
  { p: '¿Cómo contacto a quien publica?', r: 'Inicia sesión y, en la ficha, toca «Escribir». La conversación se queda dentro de Cuervo 360 y nadie recibe tu teléfono antes de tiempo.' },
  { p: '¿Por qué no veo la dirección exacta?', r: 'Sin cuenta solo se muestra la zona. La dirección exacta se muestra al iniciar sesión.' },
  { p: '¿Qué significa «correo verificado»?', r: 'Que el correo existe y que esa persona lo controla. No es una verificación de identidad.' },
  { p: '¿Qué significa «compatible contigo»?', r: 'Es una guía a partir de lo que tú declaraste: presupuesto, distancia y hábitos. Se dice en palabras y solo cuando se cumple. No es una decisión: tú eliges con quién hablar y qué rentar.' },
  { p: '¿Cómo reporto una publicación, una persona o una reseña?', r: 'En la web, desde el perfil de una persona o desde una reseña; en la app, también desde la ficha de una publicación. Al tercer reporte de cuentas distintas, un perfil se suspende y deja de aparecer.' },
  { p: '¿Cuánto cuesta publicar?', r: 'Empezar con una cuenta de vendedor es gratis, y hay una prueba gratis de 15 días con todo lo de un plan. Los pagos son con Mercado Pago (tarjeta u OXXO) y, por ahora, funcionan en modo de pruebas.' },
  { p: '¿Qué hacen con mis datos?', r: 'No los usamos para publicidad ni prospección comercial, y no los vendemos ni los cedemos a nadie. El detalle está en el aviso de privacidad.' },
  {
    p: Platform.OS === 'web' ? '¿Dónde se guardan mis favoritos, vistos y búsquedas?' : '¿Dónde se guardan mis favoritos y lo que comparo?',
    r: Platform.OS === 'web' ? 'Los favoritos y las búsquedas guardadas, en tu cuenta. Lo que viste y lo que quieres comparar, solo en este navegador.' : 'Tus favoritos, en tu cuenta: los ves en cualquier teléfono donde inicies sesión. Lo que viste y lo que quieres comparar, solo en este teléfono.',
  },
  { p: '¿Cómo borro mi cuenta?', r: 'En Configuración, «Eliminar mi cuenta». Se borra todo y no se puede deshacer.' },
];

// El campo vive dentro de la píldora: el anillo de foco lo dibuja la píldora (redondeada), no un rectángulo suelto dentro de ella. Ver global.css.
const EMBEBIDO = (Platform.OS === 'web' ? { dataSet: { campoEmbebido: '1' } } : {}) as object;

/** Sin acentos ni mayúsculas: «direccion» encuentra «dirección». */
const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarPreguntas(consulta: string, lista = PREGUNTAS) {
  const q = plano(consulta.trim());
  return q === '' ? lista : lista.filter((x) => plano(`${x.p} ${x.r}`).includes(q));
}

/**
 * Ayuda y contacto: preguntas frecuentes que se buscan (sin acentos ni mayúsculas) y el correo para escribirnos. Contenido fijo, igual con o sin cuenta. Si nada coincide lo dice, con salida: escribirnos. El correo se muestra como texto (un enlace
 * de correo puede no abrir nada según el navegador) y el botón lo intenta.
 */
export function AyudaWeb() {
  const theme = useTheme();
  const [consulta, setConsulta] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const lista = filtrarPreguntas(consulta);

  return (
    <PaginaInfoWeb titulo="Ayuda y contacto" subtitulo="Lo que más nos preguntan, y cómo escribirnos." actual={RutasWeb.ayuda}>
      <View style={[estilos.busca, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
        <TextInput
          value={consulta}
          onChangeText={setConsulta}
          placeholder="Busca una pregunta"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Busca una pregunta"
          style={[Texto.cuerpo, estilos.campo, { color: theme.text }]}
          {...EMBEBIDO}
        />
      </View>
      <View style={estilos.columnas}>
        <View style={estilos.preguntas}>
          {lista.length === 0 ? (
            <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Ninguna pregunta coincide con lo que escribiste. Escríbenos y te respondemos.</ThemedText>
          ) : (
            lista.map((x) => {
              const abierto = abierta === x.p;
              return (
                <View key={x.p} style={[estilos.pregunta, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }]}>
                  <Pulsable onPress={() => setAbierta(abierto ? null : x.p)} accessibilityRole="button" accessibilityLabel={x.p} accessibilityState={{ expanded: abierto }} aria-expanded={abierto} style={estilos.cabeza}>
                    <ThemedText style={[Texto.cuerpo, Texto.pesoFuerte, estilos.texto]}>{x.p}</ThemedText>
                    <Ionicons name={abierto ? 'remove' : 'add'} size={22} color={theme.text} />
                  </Pulsable>
                  {abierto ? <ThemedText style={[Texto.cuerpo, estilos.respuesta]} themeColor="textSecondary">{x.r}</ThemedText> : null}
                </View>
              );
            })
          )}
        </View>
        <View style={estilos.contacto}>
          <BloqueInfoWeb titulo="¿No lo encuentras?">
            <ThemedText style={Texto.cuerpo} themeColor="textSecondary">Escríbenos y respondemos por correo.</ThemedText>
            <ThemedText selectable style={[Texto.cuerpo, Texto.pesoFuerte]}>{CORREO_RESPONSABLE}</ThemedText>
            <BotonWeb onPress={() => void Linking.openURL(`mailto:${CORREO_RESPONSABLE}`).catch(() => {})} accessibilityLabel="Escribir al equipo">Escribir al equipo</BotonWeb>
          </BloqueInfoWeb>
        </View>
      </View>
    </PaginaInfoWeb>
  );
}

const estilos = StyleSheet.create({
  busca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: Filete.fino, maxWidth: 720 },
  campo: { flex: 1, minHeight: 48 },
  columnas: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, alignItems: 'flex-start' },
  preguntas: { flexGrow: 2, flexBasis: 420, flexShrink: 1, maxWidth: '100%', minWidth: 0, gap: Spacing.two },
  contacto: { flexGrow: 1, flexBasis: 300, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
  pregunta: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56, paddingHorizontal: Spacing.four },
  texto: { flex: 1, minWidth: 0 },
  respuesta: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
});
