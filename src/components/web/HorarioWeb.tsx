import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lineasPorDia, recortarHora, type DiaIso } from '@/lib/horario';
import type { HorarioExplorar } from '@/services/explorar.service';

/** El horario día por día, de lunes a domingo, con el día de hoy en negritas (`hoy` es el día ISO: 1 = lunes … 7 = domingo). Un día sin turnos dice «Cerrado». */
export function HorarioWeb({ horario, hoy }: { horario: HorarioExplorar[]; hoy: number }) {
  const theme = useTheme();
  const turnos = horario.map((h) => ({ dia: h.dia as DiaIso, abre: recortarHora(h.abre), cierra: recortarHora(h.cierra) }));
  return (
    <View>
      {lineasPorDia(turnos).map((l, i) => {
        const esHoy = i + 1 === hoy;
        return (
          <View key={l.dia} accessible accessibilityLabel={`${l.dia}${esHoy ? ', hoy' : ''}: ${l.horas}`} style={[estilos.fila, { borderBottomColor: theme.filete }]}>
            <ThemedText style={esHoy ? Texto.pequenoFuerte : Texto.pequeno}>{l.dia}</ThemedText>
            <ThemedText style={esHoy ? Texto.pequenoFuerte : Texto.pequeno} themeColor={esHoy ? 'text' : 'textSecondary'}>{l.horas}</ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, paddingVertical: Spacing.two, borderBottomWidth: Filete.fino },
});
