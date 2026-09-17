import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

const esquema = z
  .object({
    universidad: z.string().min(2, 'Escribe tu universidad'),
    presupuestoMin: z.string().regex(/^\d+$/, 'Solo números'),
    presupuestoMax: z.string().regex(/^\d+$/, 'Solo números'),
    mascotas: z.boolean(),
    fuma: z.boolean(),
    buscaRoomie: z.boolean(),
  })
  .refine((v) => Number(v.presupuestoMax) >= Number(v.presupuestoMin), {
    message: 'El máximo debe ser mayor o igual al mínimo',
    path: ['presupuestoMax'],
  });

type FormCuestionario = z.infer<typeof esquema>;

export interface RespuestasCuestionario {
  universidad: string;
  presupuestoMin: number;
  presupuestoMax: number;
  mascotas: boolean;
  fuma: boolean;
  // Informativo por ahora (sin efecto en la app todavía) — se usará cuando se
  // construya el matching de roomings, Semana 6/10.
  buscaRoomie: boolean;
  // TODO (Semana 8): texto libre opcional -> POST /parsear-perfil (sección 11-12).
  // Se deja fuera por ahora porque su almacenamiento cifrado depende del
  // microservicio de IA (perfil_texto_cifrado, sección 18), que no existe todavía.
  // TODO: nivel_ruido se quitó del cuestionario inicial (no quedaba claro para qué
  // servía) — si se retoma, debe explicarse cómo se usa antes de volver a pedirlo.
}

interface Props {
  onCompletar: (respuestas: RespuestasCuestionario) => Promise<void>;
}

export function FormularioCuestionario({ onCompletar }: Props) {
  const theme = useTheme();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormCuestionario>({
    resolver: zodResolver(esquema),
    defaultValues: { mascotas: false, fuma: false, buscaRoomie: false },
  });

  const onSubmit = async (valores: FormCuestionario) => {
    setError(null);
    setEnviando(true);
    try {
      await onCompletar({
        universidad: valores.universidad,
        presupuestoMin: Number(valores.presupuestoMin),
        presupuestoMax: Number(valores.presupuestoMax),
        mascotas: valores.mascotas,
        fuma: valores.fuma,
        buscaRoomie: valores.buscaRoomie,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cuestionario');
    } finally {
      setEnviando(false);
    }
  };

  const estiloInput = [styles.input, { borderColor: theme.border, color: theme.text }];

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="universidad"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Tu universidad"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Universidad"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.universidad && <ThemedText style={styles.error}>{errors.universidad.message}</ThemedText>}

      <ThemedText type="small" style={styles.etiqueta}>
        Presupuesto mensual (MXN)
      </ThemedText>
      <View style={styles.filaPresupuesto}>
        <Controller
          control={control}
          name="presupuestoMin"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[estiloInput, styles.inputMitad]}
              placeholder="Mínimo"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              accessibilityLabel="Presupuesto mínimo mensual"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="presupuestoMax"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[estiloInput, styles.inputMitad]}
              placeholder="Máximo"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              accessibilityLabel="Presupuesto máximo mensual"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
      </View>
      {errors.presupuestoMin && <ThemedText style={styles.error}>{errors.presupuestoMin.message}</ThemedText>}
      {errors.presupuestoMax && <ThemedText style={styles.error}>{errors.presupuestoMax.message}</ThemedText>}

      <View style={styles.filaSwitch}>
        <ThemedText>¿Tienes mascotas?</ThemedText>
        <Controller
          control={control}
          name="mascotas"
          render={({ field: { onChange, value } }) => (
            <Switch value={value} onValueChange={onChange} accessibilityLabel="¿Tienes mascotas?" />
          )}
        />
      </View>

      <View style={styles.filaSwitch}>
        <ThemedText>¿Fumas?</ThemedText>
        <Controller
          control={control}
          name="fuma"
          render={({ field: { onChange, value } }) => (
            <Switch value={value} onValueChange={onChange} accessibilityLabel="¿Fumas?" />
          )}
        />
      </View>

      <View style={styles.filaSwitch}>
        <ThemedText>¿Ya tienes depa y buscas roomie?</ThemedText>
        <Controller
          control={control}
          name="buscaRoomie"
          render={({ field: { onChange, value } }) => (
            <Switch value={value} onValueChange={onChange} accessibilityLabel="¿Ya tienes depa y buscas roomie?" />
          )}
        />
      </View>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={styles.boton}
        onPress={handleSubmit(onSubmit)}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel="Guardar y continuar"
        accessibilityState={{ disabled: enviando, busy: enviando }}
      >
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>Guardar y continuar</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  inputMitad: { flex: 1 },
  filaPresupuesto: { flexDirection: 'row', gap: Spacing.two },
  etiqueta: { marginTop: Spacing.two },
  error: { color: AppColors.destructiveRed },
  filaSwitch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.one },
  boton: {
    backgroundColor: AppColors.primary,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonTexto: { color: '#fff', fontWeight: '600' },
});
