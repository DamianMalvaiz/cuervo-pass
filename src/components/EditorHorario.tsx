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
const TURNO_NUEVO = { abre: '09:00', cierra: '18:00' } as const;

const desdeDia = (turnos: readonly Turno[], dia: DiaIso) => turnos.filter((t) => t.dia === dia);

/**
 * El horario semanal de un negocio · migración 0070. Cada día tiene hasta tres turnos («cerrado» = ninguno); si «cierra» es
 * menor que «abre», el turno cruza la medianoche. Las horas se escriben en 24 h («18:30») y se normalizan al salir del
 * campo; lo que no sea una hora válida lo rechaza `validarTurnos` al guardar. Sin ningún turno, el negocio queda «sin
 * horario»: no aparece como abierto ni como cerrado, y NO se inventa uno.
 */
export function EditorHorario({ turnos, onChange, error }: { turnos: Turno[]; onChange: (t: Turno[]) => void; error?: string }) {
  const theme = useTheme();

  const reemplazarDia = (dia: DiaIso, nuevos: Turno[]) => onChange([...turnos.filter((t) => t.dia !== dia), ...nuevos].sort((a, b) => a.dia - b.dia));
  const cambiar = (dia: DiaIso, i: number, campo: 'abre' | 'cierra', valor: string) =>
    reemplazarDia(dia, desdeDia(turnos, dia).map((t, k) => (k === i ? { ...t, [campo]: valor } : t)));
  const agregar = (dia: DiaIso) => reemplazarDia(dia, [...desdeDia(turnos, dia), { dia, ...TURNO_NUEVO }]);
  const quitar = (dia: DiaIso, i: number) => reemplazarDia(dia, desdeDia(turnos, dia).filter((_, k) => k !== i));

  // Copia los turnos del primer día que tenga a los días indicados (los demás días se reemplazan).
  const copiarPrimero = (dias: DiaIso[]) => {
    const origen = DIAS.map((d) => desdeDia(turnos, d.dia)).find((t) => t.length > 0);
    if (!origen) return;
    onChange(dias.flatMap((dia) => origen.map((t) => ({ ...t, dia }))));
  };

  const atajos: { etiqueta: string; dias: DiaIso[] }[] = [
    { etiqueta: 'Mismo horario lun a vie', dias: [1, 2, 3, 4, 5] },
    { etiqueta: 'Mismo horario lun a sáb', dias: [1, 2, 3, 4, 5, 6] },
    { etiqueta: 'Mismo horario todos los días', dias: [1, 2, 3, 4, 5, 6, 7] },
  ];

  return (
    <View style={estilos.contenedor}>
      <ThemedText type="smallBold" themeColor="textSecondary">Horario (opcional)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Con horario, tu negocio puede aparecer en «Abierto ahora». Horas en formato 24 h (por ejemplo 18:30).
      </ThemedText>

      <View style={estilos.atajos}>
        {atajos.map((a) => (
          <Pulsable
            key={a.etiqueta}
            onPress={() => copiarPrimero(a.dias)}
            accessibilityRole="button"
            accessibilityLabel={`${a.etiqueta}: copia el primer día que tenga horas`}
            style={[estilos.atajo, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}
          >
            <ThemedText type="small" style={Texto.pesoFuerte}>{a.etiqueta}</ThemedText>
          </Pulsable>
        ))}
      </View>

      {DIAS.map(({ dia, nombre }) => {
        const delDia = desdeDia(turnos, dia);
        return (
          <View key={dia} style={[estilos.dia, { borderColor: theme.filete }]}>
            <View style={estilos.cabeceraDia}>
              <ThemedText style={Texto.pesoFuerte}>{nombre}</ThemedText>
              {delDia.length === 0 ? <ThemedText type="small" themeColor="textSecondary">Cerrado</ThemedText> : null}
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
            {delDia.length < MAX_POR_DIA ? (
              <Pulsable
                onPress={() => agregar(dia)}
                accessibilityRole="button"
                accessibilityLabel={`Añadir horario al ${nombre}`}
                style={estilos.agregar}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.bosque} />
                <ThemedText type="small" style={Texto.pesoFuerte}>{delDia.length === 0 ? 'Añadir horario' : 'Añadir otro turno'}</ThemedText>
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
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  atajo: { minHeight: 44, paddingHorizontal: Spacing.three, borderWidth: Filete.fino, borderRadius: Radios.full, justifyContent: 'center' },
  dia: { borderTopWidth: Filete.fino, paddingTop: Spacing.two, gap: Spacing.one },
  cabeceraDia: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  turno: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hora: { ...Texto.cuerpo, minHeight: 44, minWidth: 84, borderWidth: Filete.fino, borderRadius: Radios.control, paddingHorizontal: Spacing.three, textAlign: 'center' },
  quitar: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
});
