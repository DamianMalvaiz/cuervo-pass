import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export interface RespuestasCuestionario {
  presupuestoMin: number;
  presupuestoMax: number;
  mascotas: boolean;
  fuma: boolean;
  nivelRuido: 'bajo' | 'medio' | 'alto';
  textoLibre?: string;
}

interface Props {
  onCompletar: (respuestas: RespuestasCuestionario) => void;
}

// TODO (Semana 4): sliders de presupuesto, checkboxes de mascotas/fuma, selector de nivel de
// ruido y campo de texto libre opcional (que dispara POST /parsear-perfil, sección 11-12).
export function FormularioCuestionario({ onCompletar: _onCompletar }: Props) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small">Cuestionario pendiente — Semana 4.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
});
