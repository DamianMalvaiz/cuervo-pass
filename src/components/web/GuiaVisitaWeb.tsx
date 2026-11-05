import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { BotonWeb } from '@/components/web/BotonWeb';
import { BloqueInfoWeb, NotaInfoWeb, PaginaInfoWeb, estilosInfo } from '@/components/web/InfoWeb';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';

export const QUE_MIRAR = [
  'Humedad en paredes y techos',
  'Presión del agua y que el calentador funcione',
  'Cerraduras y ventanas',
  'Ruido a distintas horas (pregunta cómo es de noche)',
  'Señal de celular y de internet',
  'Instalación eléctrica: contactos y focos que sí sirven',
];
export const QUE_PREGUNTAR = [
  '¿Qué servicios incluye la renta y cuáles pago aparte?',
  '¿Cuánto es el depósito y cuándo y cómo se devuelve?',
  '¿Hay contrato por escrito?',
  '¿Quién más vive aquí?',
  '¿Se permiten visitas y mascotas?',
  '¿Cuándo se paga la renta y a quién?',
];

/**
 * Guía para visitar un lugar: dos listas para ir marcando (qué mirar y qué preguntar). Es contenido fijo: nada de datos de nadie. Lo que se marca vive solo en esta página (no se guarda: es para llevarla en el momento). Si no se puede ir,
 * se dice que pidas una videollamada y recorras lo mismo.
 */
export function GuiaVisitaWeb() {
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (t: string) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  const total = QUE_MIRAR.length + QUE_PREGUNTAR.length;
  return (
    <PaginaInfoWeb titulo="Guía para visitar un lugar" subtitulo="Qué mirar y qué preguntar cuando vas, o cuando pides una videollamada." actual={RutasWeb.guiaDeVisita}>
      <View style={estilos.cuenta}>
        <ThemedText style={Texto.pequenoFuerte}>{`${marcadas.size} de ${total} revisadas`}</ThemedText>
        {marcadas.size > 0 ? <BotonWeb compacto variante="contorno" onPress={() => setMarcadas(new Set())} accessibilityLabel="Quitar todas las marcas">Quitar marcas</BotonWeb> : null}
      </View>
      <View style={estilosInfo.rejilla}>
        <View style={estilosInfo.mitad}>
          <BloqueInfoWeb titulo="Qué mirar">{QUE_MIRAR.map((t) => <Casilla key={t} texto={t} marcada={marcadas.has(t)} alTocar={() => alternar(t)} />)}</BloqueInfoWeb>
        </View>
        <View style={estilosInfo.mitad}>
          <BloqueInfoWeb titulo="Qué preguntar">{QUE_PREGUNTAR.map((t) => <Casilla key={t} texto={t} marcada={marcadas.has(t)} alTocar={() => alternar(t)} />)}</BloqueInfoWeb>
        </View>
      </View>
      <NotaInfoWeb>Si no puedes ir en persona, pide una videollamada y recorre lo mismo. No pagues nada antes de ver el lugar y tener el acuerdo por escrito.</NotaInfoWeb>
    </PaginaInfoWeb>
  );
}

function Casilla({ texto, marcada, alTocar }: { texto: string; marcada: boolean; alTocar: () => void }) {
  const theme = useTheme();
  return (
    <Pulsable onPress={alTocar} accessibilityRole="checkbox" accessibilityLabel={texto} accessibilityState={{ checked: marcada }} aria-checked={marcada} style={estilos.fila}>
      <View style={[estilos.caja, { borderColor: marcada ? theme.bosque : theme.border, backgroundColor: marcada ? theme.bosque : 'transparent' }]}>
        {marcada ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
      </View>
      <ThemedText style={[Texto.cuerpo, estilos.texto, marcada && { color: theme.textSecondary, textDecorationLine: 'line-through' }]}>{texto}</ThemedText>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 44, borderTopWidth: Filete.fino, borderTopColor: 'transparent' },
  caja: { width: 24, height: 24, borderRadius: Radios.control - Spacing.two, borderWidth: Filete.grueso, alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1, minWidth: 0 },
});
