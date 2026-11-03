import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BloqueInfoWeb, NotaInfoWeb, PaginaInfoWeb, estilosInfo } from '@/components/web/InfoWeb';
import { Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';

export const PUNTOS_CONTRATO: { titulo: string; texto: string }[] = [
  { titulo: 'Depósito', texto: 'Cuánto es, para qué sirve y cuándo y cómo te lo devuelven. Que quede escrito, con la fecha.' },
  { titulo: 'Duración', texto: 'Cuántos meses dura y qué pasa cuando termina: si se renueva, si hay que avisar, si cambia algo.' },
  { titulo: 'Aumento de renta', texto: 'Si la renta puede subir, cada cuánto y de cuánto. Mejor por escrito que de palabra.' },
  { titulo: 'Servicios', texto: 'Cuáles incluye la renta (agua, luz, internet, gas) y cuáles pagas aparte y a quién.' },
  { titulo: 'Reglas de la casa', texto: 'Visitas, mascotas, ruido y uso de áreas comunes. Lo que importa para ti, que esté dicho desde el principio.' },
  { titulo: 'Salida anticipada', texto: 'Cuánto aviso se pide si te quieres ir antes y si eso afecta el depósito.' },
];

/**
 * «Entiende tu contrato»: seis cosas que conviene que diga un contrato de renta, en palabras simples. Es orientación GENERAL, y lo dice: no cita leyes ni garantiza nada, no sustituye a una persona profesional y no es asesoría legal. Contenido fijo.
 */
export function ContratoWeb() {
  return (
    <PaginaInfoWeb titulo="Entiende tu contrato" subtitulo="Antes de firmar, que no te falte nada. Seis cosas que conviene revisar." actual={RutasWeb.contrato}>
      <View style={estilosInfo.rejilla}>
        {PUNTOS_CONTRATO.map((p) => (
          <View key={p.titulo} style={estilos.punto}>
            <BloqueInfoWeb titulo={p.titulo}>
              <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{p.texto}</ThemedText>
            </BloqueInfoWeb>
          </View>
        ))}
      </View>
      <BloqueInfoWeb titulo="Lo más importante">
        <ThemedText style={Texto.cuerpo}>Todo lo que se acuerde, por escrito y firmado por las dos partes. Lee el contrato completo antes de firmar y pide una copia.</ThemedText>
      </BloqueInfoWeb>
      <NotaInfoWeb>Es orientación general, no asesoría legal. Cuervo 360 no es parte de lo que acuerdes con otra persona. Si tienes dudas sobre un contrato, consulta a una persona profesional.</NotaInfoWeb>
    </PaginaInfoWeb>
  );
}

const estilos = StyleSheet.create({
  punto: { flexGrow: 1, flexBasis: 280, minWidth: 0, gap: Spacing.three },
});
