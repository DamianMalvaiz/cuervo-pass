import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizarHora, type DiaIso, type Turno } from '@/lib/horario';

const DIAS: { dia: DiaIso; nombre: string }[] = [
  { dia: 1, nombre: 'Lunes' }, { dia: 2, nombre: 'Martes' }, { dia: 3, nombre: 'Miércoles' }, { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' }, { dia: 6, nombre: 'Sábado' }, { dia: 7, nombre: 'Domingo' },
];
const MAX_POR_DIA = 3;
// Sin horas inventadas: al abrir un día se escriben a mano.
const TURNO_NUEVO = { abre: '', cierra: '' } as const;

const desdeDia = (turnos: readonly Turno[], dia: DiaIso) => turnos.filter((t) => t.dia === dia);

export interface EstadoHorario {
  turnos: Turno[];
  /** Los días marcados «cerrado» a propósito. Un día sin turnos y fuera de aquí está «sin decidir». */
  cerrados: DiaIso[];
}

/**
 * El horario semanal de un negocio · migración 0070. OBLIGATORIO y a mano: cada día se marca «Abierto» o «Cerrado», sin atajos y sin horas inventadas
 * (al abrir un día los campos nacen vacíos). Un día puede tener hasta tres turnos; si «cierra» es menor que «abre», el turno cruza la medianoche. Las horas
 * se escriben en 24 h («18:30») y se normalizan al salir del campo; `validarHorarioCompleto` decide al guardar si falta algo.
 */
export function EditorHorario({ turnos, cerrados, onChange, error }: EstadoHorario & { onChange: (e: EstadoHorario) => void; error?: string }) {
  const theme = useTheme();

  const cambiarDia = (dia: DiaIso, nuevos: Turno[], cerrado: boolean) =>
    onChange({
      turnos: [...turnos.filter((t) => t.dia !== dia), ...nuevos].sort((a, b) => a.dia - b.dia),
      cerrados: cerrado ? [...cerrados.filter((d) => d !== dia), dia] : cerrados.filter((d) => d !== dia),
    });
  const cambiar = (dia: DiaIso, i: number, campo: 'abre' | 'cierra', valor: string) =>
    cambiarDia(dia, desdeDia(turnos, dia).map((t, k) => (k === i ? { ...t, [campo]: valor } : t)), false);
  const abrir = (dia: DiaIso) => {
    if (desdeDia(turnos, dia).length === 0) cambiarDia(dia, [{ dia, ...TURNO_NUEVO }], false);
  };
  const cerrar = (dia: DiaIso) => cambiarDia(dia, [], true);
  const agregar = (dia: DiaIso) => cambiarDia(dia, [...desdeDia(turnos, dia), { dia, ...TURNO_NUEVO }], false);
  // Quitar el único turno devuelve el día a «sin decidir»: no se asume que cerró.
  const quitar = (dia: DiaIso, i: number) => cambiarDia(dia, desdeDia(turnos, dia).filter((_, k) => k !== i), false);

  return (
    <View style={estilos.contenedor}>
      <ThemedText type="smallBold" themeColor="textSecondary">Horario</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Marca cada día como abierto o cerrado. Si abres, escribe a qué hora, en formato 24 h (por ejemplo 18:30).
      </ThemedText>

      {DIAS.map(({ dia, nombre }) => {
        const delDia = desdeDia(turnos, dia);
        const abierto = delDia.length > 0;
        const cerrado = !abierto && cerrados.includes(dia);
        return (
          <View key={dia} style={[estilos.dia, { borderColor: theme.filete }]}>
            <View style={estilos.cabeceraDia}>
              <ThemedText style={[estilos.nombreDia, Texto.pesoFuerte]}>{nombre}</ThemedText>
              <Pulsable
                onPress={() => abrir(dia)}
                accessibilityRole="button"
                accessibilityLabel={`${nombre}: abierto`}
                accessibilityState={{ selected: abierto }}
                style={[estilos.estado, { backgroundColor: abierto ? theme.lima : theme.backgroundElement, borderColor: abierto ? theme.lima : theme.filete }]}
              >
                <ThemedText type="small" style={[Texto.pesoFuerte, abierto && { color: theme.limaTexto }]}>Abierto</ThemedText>
              </Pulsable>
              <Pulsable
                onPress={() => cerrar(dia)}
                accessibilityRole="button"
                accessibilityLabel={`${nombre}: cerrado`}
                accessibilityState={{ selected: cerrado }}
                style={[estilos.estado, { backgroundColor: cerrado ? theme.backgroundSelected : theme.backgroundElement, borderColor: cerrado ? theme.text : theme.filete }]}
              >
                <ThemedText type="small" style={Texto.pesoFuerte}>Cerrado</ThemedText>
              </Pulsable>
            </View>
            {delDia.map((t, i) => (
              <View key={i} style={estilos.turno}>
                {(['abre', 'cierra'] as const).map((campo) => (
                  <TextInput
                    key={campo}
                    value={t[campo]}
                    onChangeText={(v) => cambiar(dia, i, campo, v)}
                    onEndEditing={() => cambiar(dia, i, campo, normalizarHora(t[campo]))}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    accessibilityLabel={`${nombre}, turno ${i + 1}, ${campo === 'abre' ? 'abre' : 'cierra'}`}
                    placeholder={campo === 'abre' ? '09:00' : '18:00'}
                    placeholderTextColor={theme.textSecondary}
                    style={[estilos.hora, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}
                  />
                ))}
                <Pulsable
                  onPress={() => quitar(dia, i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar el turno ${i + 1} del ${nombre}`}
                  style={estilos.quitar}
                >
                  <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
                </Pulsable>
              </View>
            ))}
            {abierto && delDia.length < MAX_POR_DIA ? (
              <Pulsable
                onPress={() => agregar(dia)}
                accessibilityRole="button"
                accessibilityLabel={`Añadir otro turno al ${nombre}`}
                style={estilos.agregar}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.bosque} />
                <ThemedText type="small" style={Texto.pesoFuerte}>Añadir otro turno</ThemedText>
              </Pulsable>
            ) : null}
          </View>
        );
      })}

      {error ? <ThemedText type="small" style={{ color: theme.error }}>{error}</ThemedText> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: Spacing.two },
  dia: { borderTopWidth: Filete.fino, paddingTop: Spacing.two, gap: Spacing.one },
  cabeceraDia: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nombreDia: { flex: 1 },
  estado: { minHeight: 44, minWidth: 84, paddingHorizontal: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  turno: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hora: { ...Texto.cuerpo, minHeight: 44, minWidth: 84, borderWidth: Filete.fino, borderRadius: Radios.control, paddingHorizontal: Spacing.three, textAlign: 'center' },
  quitar: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
});
