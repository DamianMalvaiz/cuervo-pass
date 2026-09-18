import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OPCION_OTRA_UNIVERSIDAD, UNIVERSIDADES } from '@/lib/universidades';
import { Casilla } from './Casilla';
import { ThemedText } from './themed-text';

// Documento maestro v5 · §25 (pantallas) y §29 (consentimiento para la IA).

const NIVELES_RUIDO = [
  { valor: 'bajo', etiqueta: 'Silencio', ayuda: 'Necesito tranquilidad casi siempre' },
  { valor: 'medio', etiqueta: 'Normal', ayuda: 'Ruido de convivencia, sin fiestas' },
  { valor: 'alto', etiqueta: 'Animado', ayuda: 'Me da igual el ruido, hay visitas seguido' },
] as const;

const esquema = z
  .object({
    universidadId: z.string().min(1, 'Elige tu universidad'),
    universidadOtroNombre: z.string().optional(),
    presupuestoMin: z.string().regex(/^\d+$/, 'Solo números'),
    presupuestoMax: z.string().regex(/^\d+$/, 'Solo números'),
    // §17: el radio de búsqueda dejó de estar fijo en 5 km dentro del código.
    // Es del usuario, y el filtro duro de las sugerencias lo usa como corte real.
    distanciaMaxKm: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'Solo números')
      .refine((v) => Number(v) > 0 && Number(v) <= 50, 'Entre 1 y 50 km'),
    mascotas: z.boolean(),
    fuma: z.boolean(),
    nivelRuido: z.enum(['bajo', 'medio', 'alto']),
    buscaRoomie: z.boolean(),
    textoLibre: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
    consienteIa: z.boolean(),
  })
  .refine((v) => Number(v.presupuestoMax) >= Number(v.presupuestoMin), {
    message: 'El máximo debe ser mayor o igual al mínimo',
    path: ['presupuestoMax'],
  })
  .refine((v) => v.universidadId !== OPCION_OTRA_UNIVERSIDAD || (v.universidadOtroNombre?.trim().length ?? 0) >= 3, {
    message: 'Escribe el nombre completo de tu universidad',
    path: ['universidadOtroNombre'],
  });

type FormCuestionario = z.infer<typeof esquema>;

export interface RespuestasCuestionario {
  universidad: string;
  // Coordenadas ya verificadas (universidad conocida) — si es null, hay que
  // geocodificar `universidad` como texto libre (con las limitaciones de eso).
  universidadCoords: { lat: number; lng: number } | null;
  presupuestoMin: number;
  presupuestoMax: number;
  distanciaMaxKm: number;
  mascotas: boolean;
  fuma: boolean;
  // Se pregunta directo, además de inferirse del texto libre. v3 solo lo
  // infería, así que quien no escribía texto no tenía nivel de ruido — y ese
  // sumando del score valía cero para esa persona de por vida.
  nivelRuido: 'bajo' | 'medio' | 'alto';
  buscaRoomie: boolean;
  textoLibre?: string;
  // §29 · AUD-23: sin esto marcado no se llama al modelo, no se genera el
  // vector, y las sugerencias se calculan solo con el cuestionario.
  consienteIa: boolean;
}

interface Props {
  valoresIniciales?: Partial<RespuestasCuestionario>;
  textoBoton?: string;
  onCompletar: (respuestas: RespuestasCuestionario) => Promise<void>;
}

export function FormularioCuestionario({ valoresIniciales, textoBoton = 'Guardar y continuar', onCompletar }: Props) {
  const theme = useTheme();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const universidadInicial =
    UNIVERSIDADES.find((u) => u.nombre === valoresIniciales?.universidad)?.id ?? UNIVERSIDADES[0]?.id;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormCuestionario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      universidadId: universidadInicial,
      presupuestoMin: valoresIniciales?.presupuestoMin?.toString(),
      presupuestoMax: valoresIniciales?.presupuestoMax?.toString(),
      distanciaMaxKm: (valoresIniciales?.distanciaMaxKm ?? 5).toString(),
      mascotas: valoresIniciales?.mascotas ?? false,
      fuma: valoresIniciales?.fuma ?? false,
      nivelRuido: valoresIniciales?.nivelRuido ?? 'medio',
      buscaRoomie: valoresIniciales?.buscaRoomie ?? false,
      textoLibre: valoresIniciales?.textoLibre,
      // NO viene premarcada: §29. Una casilla premarcada no es consentimiento.
      consienteIa: valoresIniciales?.consienteIa ?? false,
    },
  });

  const universidadIdSeleccionada = watch('universidadId');
  const esOtra = universidadIdSeleccionada === OPCION_OTRA_UNIVERSIDAD;

  const onSubmit = async (valores: FormCuestionario) => {
    setError(null);
    setEnviando(true);
    try {
      const universidadConocida = UNIVERSIDADES.find((u) => u.id === valores.universidadId);
      await onCompletar({
        universidad: universidadConocida?.nombre ?? valores.universidadOtroNombre?.trim() ?? '',
        universidadCoords: universidadConocida ? { lat: universidadConocida.lat, lng: universidadConocida.lng } : null,
        presupuestoMin: Number(valores.presupuestoMin),
        presupuestoMax: Number(valores.presupuestoMax),
        distanciaMaxKm: Number(valores.distanciaMaxKm),
        mascotas: valores.mascotas,
        fuma: valores.fuma,
        nivelRuido: valores.nivelRuido,
        buscaRoomie: valores.buscaRoomie,
        textoLibre: valores.textoLibre?.trim() || undefined,
        consienteIa: valores.consienteIa,
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
      <ThemedText type="small" style={styles.etiqueta}>
        Tu universidad
      </ThemedText>
      <Controller
        control={control}
        name="universidadId"
        render={({ field: { onChange, value } }) => (
          <View style={styles.listaUniversidades}>
            {UNIVERSIDADES.map((u) => {
              const seleccionado = value === u.id;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => onChange(u.id)}
                  style={[styles.opcionUniversidad, { borderColor: theme.border }, seleccionado && styles.opcionSeleccionada]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: seleccionado }}
                  accessibilityLabel={u.nombre}
                >
                  <ThemedText style={seleccionado ? styles.textoSeleccionado : undefined}>{u.nombre}</ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => onChange(OPCION_OTRA_UNIVERSIDAD)}
              style={[styles.opcionUniversidad, { borderColor: theme.border }, esOtra && styles.opcionSeleccionada]}
              accessibilityRole="radio"
              accessibilityState={{ selected: esOtra }}
              accessibilityLabel="Otra universidad"
            >
              <ThemedText style={esOtra ? styles.textoSeleccionado : undefined}>Otra (escribir)</ThemedText>
            </Pressable>
          </View>
        )}
      />
      {errors.universidadId && <ThemedText style={styles.error}>{errors.universidadId.message}</ThemedText>}

      {esOtra && (
        <Controller
          control={control}
          name="universidadOtroNombre"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={estiloInput}
              placeholder="Nombre completo de tu universidad"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Nombre de tu universidad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
      )}
      {errors.universidadOtroNombre && <ThemedText style={styles.error}>{errors.universidadOtroNombre.message}</ThemedText>}

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

      <ThemedText type="small" style={styles.etiqueta}>
        ¿Qué tan lejos de tu universidad aceptas vivir?
      </ThemedText>
      <Controller
        control={control}
        name="distanciaMaxKm"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={estiloInput}
            placeholder="Kilómetros (ej. 5)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            accessibilityLabel="Distancia máxima en kilómetros"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        No te mostramos publicaciones más lejos que esto.
      </ThemedText>
      {errors.distanciaMaxKm && <ThemedText style={styles.error}>{errors.distanciaMaxKm.message}</ThemedText>}

      <ThemedText type="small" style={styles.etiqueta}>
        ¿Cómo te gusta tu casa?
      </ThemedText>
      <Controller
        control={control}
        name="nivelRuido"
        render={({ field: { onChange, value } }) => (
          <View style={styles.listaUniversidades}>
            {NIVELES_RUIDO.map((n) => {
              const seleccionado = value === n.valor;
              return (
                <Pressable
                  key={n.valor}
                  onPress={() => onChange(n.valor)}
                  style={[styles.opcionUniversidad, { borderColor: theme.border }, seleccionado && styles.opcionSeleccionada]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: seleccionado }}
                  accessibilityLabel={`${n.etiqueta}. ${n.ayuda}`}
                >
                  <ThemedText style={seleccionado ? styles.textoSeleccionado : undefined}>{n.etiqueta}</ThemedText>
                  <ThemedText
                    type="small"
                    style={seleccionado ? styles.textoSeleccionado : { color: theme.textSecondary }}
                  >
                    {n.ayuda}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
      />

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

      <ThemedText type="small" style={styles.etiqueta}>
        Cuéntanos de ti (opcional)
      </ThemedText>
      <Controller
        control={control}
        name="textoLibre"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[estiloInput, styles.textoLibreInput]}
            placeholder="Ej. soy tranquilo, tengo un gato, estudio en las mañanas..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Cuéntanos de ti, texto libre opcional"
            multiline
            maxLength={2000}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.textoLibre && <ThemedText style={styles.error}>{errors.textoLibre.message}</ThemedText>}

      <Controller
        control={control}
        name="consienteIa"
        render={({ field: { onChange, value } }) => (
          <Casilla
            valor={value}
            onCambiar={onChange}
            etiqueta="Quiero que la app analice mi descripción con inteligencia artificial para sugerirme mejores opciones."
            ayuda="Si no la marcas, tus sugerencias se calculan solo con el cuestionario y tu texto no sale de esta app."
          />
        )}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={styles.boton}
        onPress={handleSubmit(onSubmit)}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel={textoBoton}
        accessibilityState={{ disabled: enviando, busy: enviando }}
      >
        {enviando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.botonTexto}>{textoBoton}</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  inputMitad: { flex: 1 },
  textoLibreInput: { minHeight: 80, textAlignVertical: 'top' },
  filaPresupuesto: { flexDirection: 'row', gap: Spacing.two },
  etiqueta: { marginTop: Spacing.two },
  error: { color: AppColors.destructiveRed },
  filaSwitch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.one },
  listaUniversidades: { gap: Spacing.two },
  opcionUniversidad: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.half },
  opcionSeleccionada: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  textoSeleccionado: { color: '#fff', fontWeight: '600' },
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
